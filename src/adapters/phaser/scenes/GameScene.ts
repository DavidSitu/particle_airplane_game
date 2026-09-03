import Phaser from 'phaser';
import type {
  EnemySnapshot,
  GameEvent,
  PlaneShooterSnapshot,
  Vector2,
} from '../../../systems/gameplay';
import type { RuntimeMountInput, RuntimeTextureSource } from '../../../app/runtimePort';
import {
  PhaserInputAdapter,
  TOUCH_FIRE_RADIUS,
  TOUCH_JOYSTICK_RADIUS,
} from '../input/PhaserInputAdapter';
import { EffectsView } from '../views/EffectsView';
import { ScrollingBackgroundView } from '../views/ScrollingBackgroundView';

const BACKGROUND_TEXTURE = 'runtime.background';
const BACKGROUND_FALLBACK_TEXTURE = 'runtime.background-fallback';
const PLAYER_TEXTURE = 'runtime.player';
const PROJECTILE_TEXTURE = 'runtime.projectile';

export class GameScene extends Phaser.Scene {
  private readonly appearanceTextures = new Map<string, string>();
  private inputAdapter?: PhaserInputAdapter;
  private effects?: EffectsView;
  private background?: ScrollingBackgroundView;
  private playerView?: Phaser.GameObjects.Image;
  private readonly projectileViews = new Map<string, Phaser.GameObjects.Image>();
  private readonly enemyViews = new Map<string, Phaser.GameObjects.Image>();
  private touchGraphics?: Phaser.GameObjects.Graphics;
  private touchFireLabel?: Phaser.GameObjects.Text;
  private touchControlsVisible = false;
  private snapshot: PlaneShooterSnapshot;
  private accumulatorMs = 0;
  private runtimePaused = true;
  private projectileSpawnedTotal = 0;
  private failed = false;
  private preferredBackgroundFailed = false;
  private fallbackBackgroundFailed = false;

  public constructor(private readonly mountInput: RuntimeMountInput) {
    super({ key: `preston-game-${mountInput.initialSnapshot.sessionId}` });
    this.snapshot = mountInput.initialSnapshot;
  }

  public preload(): void {
    this.load.image(BACKGROUND_TEXTURE, this.mountInput.textures.background.url);
    if (this.mountInput.textures.backgroundFallback) {
      this.load.image(BACKGROUND_FALLBACK_TEXTURE, this.mountInput.textures.backgroundFallback.url);
    }
    this.load.image(PLAYER_TEXTURE, this.mountInput.textures.player.url);
    this.load.image(PROJECTILE_TEXTURE, this.mountInput.textures.projectile.url);
    this.appearanceTextures.set(this.mountInput.textures.player.appearanceKey, PLAYER_TEXTURE);
    this.mountInput.textures.enemies.forEach((source, index) => {
      this.loadAppearance(source, `runtime.enemy.${index}`);
    });
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      if (file.key === BACKGROUND_TEXTURE && this.mountInput.textures.backgroundFallback) {
        this.preferredBackgroundFailed = true;
        return;
      }
      if (file.key === BACKGROUND_FALLBACK_TEXTURE) {
        this.fallbackBackgroundFailed = true;
        return;
      }
      this.fail(new Error(`Unable to load runtime asset: ${file.key}`));
    });
  }

  public create(): void {
    if (this.failed) return;
    if (this.preferredBackgroundFailed && this.fallbackBackgroundFailed) {
      this.fail(new Error('Unable to load either gameplay background.'));
      return;
    }
    this.cameras.main.setBackgroundColor('#08030d');
    const backgroundTexture = this.preferredBackgroundFailed
      ? BACKGROUND_FALLBACK_TEXTURE
      : BACKGROUND_TEXTURE;
    this.background = new ScrollingBackgroundView(
      this,
      backgroundTexture,
      this.mountInput.logicalWidth,
      this.mountInput.logicalHeight,
      this.mountInput.backgroundScrollSpeeds,
      this.mountInput.logicalHeight /
        (this.mountInput.cameraBounds.maxY - this.mountInput.cameraBounds.minY),
    );

    const playerPoint = this.worldToScreen(this.snapshot.player.position);
    this.playerView = this.add.image(playerPoint.x, playerPoint.y, PLAYER_TEXTURE).setDepth(5);
    this.fitTexture(this.playerView, 92, 108);
    this.touchGraphics = this.add.graphics().setDepth(20);
    this.touchControlsVisible = this.sys.game.device.input.touch;
    this.inputAdapter = new PhaserInputAdapter(this);
    this.effects = new EffectsView(this, (point) => this.worldToScreen(point));
    this.renderSnapshot(this.snapshot);
    this.renderTouchControls();
    this.runtimePaused = false;
    this.game.canvas.setAttribute('role', 'img');
    this.game.canvas.setAttribute('aria-label', 'Preston vs Particles vertical plane-shooter arena');
    this.game.canvas.dataset.testid = 'game-canvas';
    this.game.canvas.style.touchAction = 'none';
    this.mountInput.onReady?.();
    this.scale.refresh();
  }

  public override update(_time: number, delta: number): void {
    if (this.runtimePaused || this.failed || !this.inputAdapter) return;
    try {
      const fixedStepMs = 1_000 / this.mountInput.fixedStepHz;
      this.accumulatorMs = Math.min(this.accumulatorMs + Math.min(delta, 100), fixedStepMs * 5);
      const frameEvents: GameEvent[] = [];
      let steps = 0;
      while (this.accumulatorMs + Number.EPSILON >= fixedStepMs && steps < 5) {
        const result = this.mountInput.step(this.inputAdapter.readFrame());
        this.snapshot = result.snapshot;
        frameEvents.push(...result.events);
        for (const event of result.events) {
          if (event.type === 'ProjectileSpawned') this.projectileSpawnedTotal += 1;
        }
        this.accumulatorMs -= fixedStepMs;
        steps += 1;
        if (this.snapshot.lifecycle !== 'running') break;
      }
      if (steps > 0) this.background?.update(steps / this.mountInput.fixedStepHz);
      if (frameEvents.length > 0 && this.playerView && this.effects) {
        this.effects.consume(frameEvents, this.enemyViews, this.playerView);
      }
      this.renderSnapshot(this.snapshot);
      this.renderTouchControls();
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  public pauseRuntime(): void {
    this.runtimePaused = true;
  }

  public resumeRuntime(): void {
    if (!this.failed) {
      this.accumulatorMs = 0;
      this.runtimePaused = false;
    }
  }

  public disposeRuntime(): void {
    this.runtimePaused = true;
    this.inputAdapter?.dispose();
    this.effects?.dispose();
    this.background?.destroy();
    this.projectileViews.clear();
    this.enemyViews.clear();
  }

  private loadAppearance(source: RuntimeTextureSource, textureKey: string): void {
    this.appearanceTextures.set(source.appearanceKey, textureKey);
    this.load.image(textureKey, source.url);
  }

  private renderSnapshot(snapshot: PlaneShooterSnapshot): void {
    if (!this.playerView) return;
    const playerPoint = this.worldToScreen(snapshot.player.position);
    this.playerView.setPosition(playerPoint.x, playerPoint.y).setRotation(0);

    const activeProjectiles = new Set<string>();
    for (const projectile of snapshot.projectiles) {
      activeProjectiles.add(projectile.id);
      const point = this.worldToScreen(projectile.position);
      let view = this.projectileViews.get(projectile.id);
      if (!view) {
        view = this.add.image(point.x, point.y, PROJECTILE_TEXTURE).setDepth(4);
        this.fitTexture(view, 22, 32);
        this.projectileViews.set(projectile.id, view);
      }
      view.setPosition(point.x, point.y).setRotation(0);
    }
    this.removeMissing(this.projectileViews, activeProjectiles);

    const activeEnemies = new Set<string>();
    for (const enemy of snapshot.enemies) {
      activeEnemies.add(enemy.id);
      const point = this.worldToScreen(enemy.position);
      let view = this.enemyViews.get(enemy.id);
      const textureKey =
        this.appearanceTextures.get(enemy.appearanceKey) ?? this.fallbackEnemyTexture(enemy);
      if (!view) {
        view = this.add.image(point.x, point.y, textureKey).setDepth(3);
        this.enemyViews.set(enemy.id, view);
      } else if (view.texture.key !== textureKey) {
        view.setTexture(textureKey);
      }
      view.setPosition(point.x, point.y)
        .setRotation(Phaser.Math.DegToRad(enemy.rotationDegrees));
      this.fitTexture(view, 46 * enemy.scale, 52 * enemy.scale);
    }
    this.removeMissing(this.enemyViews, activeEnemies);
    this.publishDiagnostics(snapshot);
  }

  private fallbackEnemyTexture(enemy: EnemySnapshot): string {
    const definitionIndex = ['enemy.base', 'enemy.1', 'enemy.2', 'enemy.3']
      .indexOf(enemy.definitionId);
    return this.appearanceTextures.get(`enemy.0${definitionIndex + 1}`) ??
      [...this.appearanceTextures.values()][definitionIndex + 1] ??
      PLAYER_TEXTURE;
  }

  private worldToScreen(point: Vector2): Vector2 {
    const bounds = this.mountInput.cameraBounds;
    return {
      x: ((point.x - bounds.minX) / (bounds.maxX - bounds.minX)) * this.mountInput.logicalWidth,
      y: ((bounds.maxY - point.y) / (bounds.maxY - bounds.minY)) * this.mountInput.logicalHeight,
    };
  }

  private fitTexture(view: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
    const source = view.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const sourceWidth = Math.max(1, source.width);
    const sourceHeight = Math.max(1, source.height);
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
    view.setDisplaySize(sourceWidth * scale, sourceHeight * scale);
  }

  private removeMissing(
    views: Map<string, Phaser.GameObjects.Image>,
    activeIds: ReadonlySet<string>,
  ): void {
    for (const [id, view] of views) {
      if (activeIds.has(id)) continue;
      view.destroy();
      views.delete(id);
    }
  }

  private renderTouchControls(): void {
    if (!this.touchGraphics || !this.inputAdapter) return;
    if (!this.touchControlsVisible) {
      this.touchGraphics.clear().setVisible(false);
      this.touchFireLabel?.setVisible(false);
      return;
    }
    this.touchGraphics.setVisible(true);
    const controls = this.inputAdapter.touchControls();
    this.touchGraphics.clear();
    this.touchGraphics
      .lineStyle(3, 0xffffff, controls.joystick.active ? 0.7 : 0.32)
      .fillStyle(0x08030d, controls.joystick.active ? 0.42 : 0.22)
      .fillCircle(controls.joystick.centerX, controls.joystick.centerY, TOUCH_JOYSTICK_RADIUS)
      .strokeCircle(controls.joystick.centerX, controls.joystick.centerY, TOUCH_JOYSTICK_RADIUS)
      .fillStyle(0xffffff, controls.joystick.active ? 0.68 : 0.38)
      .fillCircle(controls.joystick.knobX, controls.joystick.knobY, 25)
      .lineStyle(3, 0xffe45c, controls.fireButton.active ? 0.9 : 0.48)
      .fillStyle(0x08030d, controls.fireButton.active ? 0.52 : 0.24)
      .fillCircle(controls.fireButton.centerX, controls.fireButton.centerY, TOUCH_FIRE_RADIUS)
      .strokeCircle(controls.fireButton.centerX, controls.fireButton.centerY, TOUCH_FIRE_RADIUS);
    if (!this.touchFireLabel) {
      this.touchFireLabel = this.add.text(
        controls.fireButton.centerX,
        controls.fireButton.centerY,
        'FIRE',
        { fontFamily: 'Arial, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#ffe45c' },
      ).setOrigin(0.5).setDepth(21).setAlpha(0.72);
    }
    this.touchFireLabel.setAlpha(controls.fireButton.active ? 1 : 0.72);
  }

  private publishDiagnostics(snapshot: PlaneShooterSnapshot): void {
    const canvas = this.game.canvas;
    canvas.dataset.playerX = snapshot.player.x.toFixed(4);
    canvas.dataset.playerY = snapshot.player.y.toFixed(4);
    canvas.dataset.projectileCount = String(snapshot.projectiles.length);
    canvas.dataset.projectileSpawnedTotal = String(this.projectileSpawnedTotal);
    canvas.dataset.enemyCount = String(snapshot.enemies.length);
    const offsets = this.background?.offsets() ?? [0, 0];
    canvas.dataset.backgroundOffsetSlow = offsets[0].toFixed(3);
    canvas.dataset.backgroundOffsetFast = offsets[1].toFixed(3);
  }

  private fail(error: Error): void {
    if (this.failed) return;
    this.failed = true;
    this.runtimePaused = true;
    this.mountInput.onFatal(error);
  }
}

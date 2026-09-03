import Phaser from 'phaser';
import type {
  EnemySnapshot,
  GameEvent,
  GameSnapshot,
} from '../../../systems/gameplay';
import type { RuntimeMountInput, RuntimeTextureSource } from '../../../app/runtimePort';
import { PhaserInputAdapter } from '../input/PhaserInputAdapter';
import { EffectsView } from '../views/EffectsView';

const BACKGROUND_TEXTURE = 'runtime.background';
const BACKGROUND_FALLBACK_TEXTURE = 'runtime.background-fallback';
const PLAYER_TEXTURE = 'runtime.player';
const PROJECTILE_TEXTURE = 'runtime.projectile';
const KNOB_TEXTURE = 'runtime.knob';

export class GameScene extends Phaser.Scene {
  private readonly appearanceTextures = new Map<string, string>();
  private inputAdapter?: PhaserInputAdapter;
  private effects?: EffectsView;
  private playerView?: Phaser.GameObjects.Image;
  private readonly bulletViews = new Map<string, Phaser.GameObjects.Image>();
  private readonly enemyViews = new Map<string, Phaser.GameObjects.Image>();
  private touchGraphics?: Phaser.GameObjects.Graphics;
  private snapshot: GameSnapshot;
  private accumulatorMs = 0;
  private runtimePaused = true;
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
    if (this.mountInput.textures.knob) this.load.image(KNOB_TEXTURE, this.mountInput.textures.knob.url);
    this.appearanceTextures.set(this.mountInput.textures.player.appearanceKey, PLAYER_TEXTURE);
    this.mountInput.textures.enemies.forEach((source, index) => this.loadAppearance(source, `runtime.enemy.${index}`));
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
    const backgroundTexture = this.preferredBackgroundFailed ? BACKGROUND_FALLBACK_TEXTURE : BACKGROUND_TEXTURE;
    const background = this.add.tileSprite(
      this.mountInput.worldWidth / 2,
      this.mountInput.worldHeight / 2,
      this.mountInput.worldWidth,
      this.mountInput.worldHeight,
      backgroundTexture,
    ).setDepth(-20);
    const backgroundSource = this.textures.get(backgroundTexture).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    background.setTileScale(
      this.mountInput.worldWidth / backgroundSource.width,
      this.mountInput.worldHeight / backgroundSource.height,
    );

    this.playerView = this.add.image(this.snapshot.player.x, this.snapshot.player.y, PLAYER_TEXTURE).setDepth(5);
    this.fitTexture(this.playerView, 118, 106);
    this.touchGraphics = this.add.graphics().setDepth(20);
    this.inputAdapter = new PhaserInputAdapter(this);
    this.effects = new EffectsView(this);
    this.renderSnapshot(this.snapshot);
    this.runtimePaused = false;
    this.game.canvas.setAttribute('role', 'img');
    this.game.canvas.setAttribute('aria-label', 'Preston vs Particles gameplay arena');
    this.game.canvas.dataset.testid = 'game-canvas';
    this.mountInput.onReady?.();
    // onReady publishes the playing state synchronously, making the formerly
    // hidden game layer measurable before Phaser refreshes its FIT scale.
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
        this.accumulatorMs -= fixedStepMs;
        steps += 1;
        if (this.snapshot.lifecycle !== 'running') break;
      }
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
    this.bulletViews.clear();
    this.enemyViews.clear();
  }

  private loadAppearance(source: RuntimeTextureSource, textureKey: string): void {
    this.appearanceTextures.set(source.appearanceKey, textureKey);
    this.load.image(textureKey, source.url);
  }

  private renderSnapshot(snapshot: GameSnapshot): void {
    if (!this.playerView) return;
    this.playerView.setPosition(snapshot.player.x, snapshot.player.y);
    this.playerView.setRotation(Math.atan2(snapshot.player.aimDirection.y, snapshot.player.aimDirection.x) + Math.PI / 2);
    this.playerView.setAlpha(snapshot.player.isInvulnerable ? 0.6 : 1);

    const activeBullets = new Set<string>();
    for (const bullet of snapshot.bullets) {
      activeBullets.add(bullet.id);
      let view = this.bulletViews.get(bullet.id);
      if (!view) {
        view = this.add.image(bullet.x, bullet.y, PROJECTILE_TEXTURE).setDepth(4);
        this.fitTexture(view, 34, 22);
        this.bulletViews.set(bullet.id, view);
      }
      view.setPosition(bullet.x, bullet.y);
      view.setRotation(Math.atan2(bullet.velocity.y, bullet.velocity.x) + Math.PI / 2);
    }
    this.removeMissing(this.bulletViews, activeBullets);

    const activeEnemies = new Set<string>();
    for (const enemy of snapshot.enemies) {
      activeEnemies.add(enemy.id);
      let view = this.enemyViews.get(enemy.id);
      const textureKey = this.appearanceTextures.get(enemy.appearanceKey) ?? this.fallbackEnemyTexture(enemy);
      if (!view) {
        view = this.add.image(enemy.x, enemy.y, textureKey).setDepth(3);
        this.enemyViews.set(enemy.id, view);
      } else if (view.texture.key !== textureKey) {
        view.setTexture(textureKey);
      }
      view.setPosition(enemy.x, enemy.y).setRotation(enemy.rotation);
      this.fitTexture(view, 78 * enemy.scale, 88 * enemy.scale);
    }
    this.removeMissing(this.enemyViews, activeEnemies);
  }

  private fallbackEnemyTexture(enemy: EnemySnapshot): string {
    const textures = [...this.appearanceTextures.entries()].filter(([appearanceKey]) => appearanceKey !== this.mountInput.textures.player.appearanceKey);
    return textures[enemy.variant % Math.max(1, textures.length)]?.[1] ?? PLAYER_TEXTURE;
  }

  private fitTexture(view: Phaser.GameObjects.Image, maxHeight: number, maxWidth: number): void {
    const source = view.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const sourceWidth = Math.max(1, source.width);
    const sourceHeight = Math.max(1, source.height);
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
    view.setDisplaySize(sourceWidth * scale, sourceHeight * scale);
  }

  private removeMissing(views: Map<string, Phaser.GameObjects.Image>, activeIds: ReadonlySet<string>): void {
    for (const [id, view] of views) {
      if (activeIds.has(id)) continue;
      view.destroy();
      views.delete(id);
    }
  }

  private renderTouchControls(): void {
    if (!this.touchGraphics || !this.inputAdapter) return;
    this.touchGraphics.clear();
    const controls = this.inputAdapter.touchControls();
    if (controls.movement) {
      this.touchGraphics.lineStyle(3, 0xffffff, 0.35).fillStyle(0x08030d, 0.26);
      this.touchGraphics.fillCircle(controls.movement.originX, controls.movement.originY, 72);
      this.touchGraphics.strokeCircle(controls.movement.originX, controls.movement.originY, 72);
      this.touchGraphics.fillStyle(0xffffff, 0.48);
      this.touchGraphics.fillCircle(controls.movement.currentX, controls.movement.currentY, 25);
    }
    if (controls.firing) {
      this.touchGraphics.lineStyle(3, 0xffe45c, 0.72);
      this.touchGraphics.strokeCircle(controls.firing.x, controls.firing.y, 26);
      this.touchGraphics.lineBetween(controls.firing.x - 34, controls.firing.y, controls.firing.x + 34, controls.firing.y);
      this.touchGraphics.lineBetween(controls.firing.x, controls.firing.y - 34, controls.firing.x, controls.firing.y + 34);
    }
  }

  private fail(error: Error): void {
    if (this.failed) return;
    this.failed = true;
    this.runtimePaused = true;
    this.mountInput.onFatal(error);
  }
}

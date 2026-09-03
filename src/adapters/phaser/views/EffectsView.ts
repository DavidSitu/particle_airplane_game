import Phaser from 'phaser';
import type { GameEvent, Vector2 } from '../../../systems/gameplay';

const MAX_PARTICLES = 96;

export class EffectsView {
  private readonly live = new Set<Phaser.GameObjects.Arc>();
  private readonly pool: Phaser.GameObjects.Arc[] = [];

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly toScreen: (point: Vector2) => Vector2,
  ) {}

  public consume(
    events: readonly GameEvent[],
    enemyViews: ReadonlyMap<string, Phaser.GameObjects.Image>,
    playerView: Phaser.GameObjects.Image,
  ): void {
    for (const event of events) {
      if (event.type === 'EnemyDestroyed') {
        const sprite = enemyViews.get(event.enemyId);
        if (sprite) this.burst(sprite.x, sprite.y, 0xffe45c);
      } else if (event.type === 'PlayerDamaged') {
        playerView.setTint(0xff3f58).setTintMode(Phaser.TintModes.FILL);
        this.scene.tweens.add({
          targets: playerView,
          alpha: 0.35,
          yoyo: true,
          repeat: 2,
          duration: 70,
          onComplete: () => playerView.clearTint().setAlpha(1),
        });
        this.scene.cameras.main.shake(110, 0.006);
      } else if (event.type === 'ProjectileSpawned') {
        const point = this.toScreen(event.projectile.position);
        this.spark(point.x, point.y);
      }
    }
  }

  public dispose(): void {
    for (const particle of this.live) particle.destroy();
    for (const particle of this.pool) particle.destroy();
    this.live.clear();
    this.pool.length = 0;
  }

  private burst(x: number, y: number, color: number): void {
    for (let index = 0; index < 9; index += 1) {
      const angle = (Math.PI * 2 * index) / 9;
      const distance = 28 + (index % 3) * 10;
      const particle = this.acquire(x, y, 3 + (index % 2) * 2, color, 0.95, 8);
      this.track(particle);
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.2,
        duration: 260,
        ease: 'Quad.Out',
        onComplete: () => this.release(particle),
      });
    }
  }

  private spark(x: number, y: number): void {
    const particle = this.acquire(x, y, 7, 0x34d5ff, 0.85, 7);
    this.track(particle);
    this.scene.tweens.add({
      targets: particle,
      alpha: 0,
      scale: 0.1,
      duration: 90,
      onComplete: () => this.release(particle),
    });
  }

  private track(particle: Phaser.GameObjects.Arc): void {
    while (this.live.size >= MAX_PARTICLES) {
      const oldest = this.live.values().next().value as Phaser.GameObjects.Arc | undefined;
      if (!oldest) break;
      this.release(oldest);
    }
    this.live.add(particle);
  }

  private acquire(
    x: number,
    y: number,
    radius: number,
    color: number,
    alpha: number,
    depth: number,
  ): Phaser.GameObjects.Arc {
    const particle = this.pool.pop() ?? this.scene.add.circle(0, 0, radius, color, alpha);
    particle
      .setPosition(x, y)
      .setRadius(radius)
      .setFillStyle(color, alpha)
      .setAlpha(alpha)
      .setScale(1)
      .setDepth(depth)
      .setActive(true)
      .setVisible(true);
    return particle;
  }

  private release(particle: Phaser.GameObjects.Arc): void {
    if (!this.live.delete(particle)) return;
    if (!particle.scene) return;
    this.scene.tweens.killTweensOf(particle);
    particle.setActive(false).setVisible(false);
    if (this.pool.length < MAX_PARTICLES) this.pool.push(particle);
    else particle.destroy();
  }
}

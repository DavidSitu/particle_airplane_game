import Phaser from 'phaser';
import type { GameEvent } from '../../../systems/gameplay';

const MAX_PARTICLES = 96;

export class EffectsView {
  private readonly live = new Set<Phaser.GameObjects.Arc>();

  public constructor(private readonly scene: Phaser.Scene) {}

  public consume(events: readonly GameEvent[], enemyViews: ReadonlyMap<string, Phaser.GameObjects.Image>, playerView: Phaser.GameObjects.Image): void {
    for (const event of events) {
      if (event.type === 'enemy-destroyed') {
        const sprite = enemyViews.get(event.enemyId);
        if (sprite) this.burst(sprite.x, sprite.y, 0xffe45c);
      } else if (event.type === 'player-damaged') {
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
      } else if (event.type === 'shot-fired') {
        this.spark(event.bullet.x, event.bullet.y);
      }
    }
  }

  public dispose(): void {
    for (const particle of this.live) particle.destroy();
    this.live.clear();
  }

  private burst(x: number, y: number, color: number): void {
    for (let index = 0; index < 9; index += 1) {
      const angle = (Math.PI * 2 * index) / 9;
      const distance = 28 + (index % 3) * 10;
      const particle = this.scene.add.circle(x, y, 3 + (index % 2) * 2, color, 0.95).setDepth(8);
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
    const particle = this.scene.add.circle(x, y, 7, 0x34d5ff, 0.85).setDepth(7);
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

  private release(particle: Phaser.GameObjects.Arc): void {
    this.live.delete(particle);
    if (particle.scene) particle.destroy();
  }
}

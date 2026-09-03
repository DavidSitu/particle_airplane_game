import Phaser from 'phaser';

/** Renderer-only, gapless two-speed flight illusion. */
export class ScrollingBackgroundView {
  private readonly slowLayer: Phaser.GameObjects.TileSprite;
  private readonly fastLayer: Phaser.GameObjects.TileSprite;
  private readonly tileScale: number;

  public constructor(
    scene: Phaser.Scene,
    textureKey: string,
    width: number,
    height: number,
    private readonly speeds: readonly [number, number],
    private readonly pixelsPerWorldUnit: number,
  ) {
    const source = scene.textures.get(textureKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    this.tileScale = width / Math.max(1, source.width);
    this.slowLayer = scene.add.tileSprite(width / 2, height / 2, width, height, textureKey)
      .setDepth(-30)
      .setTileScale(this.tileScale);
    this.fastLayer = scene.add.tileSprite(width / 2, height / 2, width, height, textureKey)
      .setDepth(-29)
      .setAlpha(0.12)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setTileScale(this.tileScale)
      .setTilePosition(source.width / 2, source.height / 2);
  }

  public update(deltaSeconds: number): void {
    // Moving texture downward while the camera remains fixed sells forward
    // flight. tilePosition is expressed in unscaled source-texture pixels.
    const scale = Math.max(Number.EPSILON, this.tileScale);
    this.slowLayer.tilePositionY -= this.speeds[0] * this.pixelsPerWorldUnit * deltaSeconds / scale;
    this.fastLayer.tilePositionY -= this.speeds[1] * this.pixelsPerWorldUnit * deltaSeconds / scale;
  }

  public offsets(): readonly [number, number] {
    return [this.slowLayer.tilePositionY, this.fastLayer.tilePositionY];
  }

  public destroy(): void {
    this.slowLayer.destroy();
    this.fastLayer.destroy();
  }
}

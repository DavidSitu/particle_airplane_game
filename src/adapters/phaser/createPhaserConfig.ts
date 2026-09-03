import Phaser from 'phaser';
import type { RuntimeMountInput } from '../../app/runtimePort';
import type { GameScene } from './scenes/GameScene';

export function createPhaserConfig(input: RuntimeMountInput, scene: GameScene): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: input.container,
    width: input.logicalWidth,
    height: input.logicalHeight,
    backgroundColor: '#08030d',
    transparent: false,
    antialias: true,
    scene: [scene],
    input: {
      activePointers: 3,
      smoothFactor: 0.15,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
      powerPreference: 'high-performance',
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: input.logicalWidth,
      height: input.logicalHeight,
      parent: input.container,
    },
    fps: {
      target: 60,
      forceSetTimeOut: false,
    },
  };
}

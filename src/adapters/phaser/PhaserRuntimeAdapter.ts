import Phaser from 'phaser';
import type {
  GameRuntimePort,
  RuntimeMountInput,
  RuntimeMountResult,
} from '../../app/runtimePort';
import { createPhaserConfig } from './createPhaserConfig';
import { GameScene } from './scenes/GameScene';

export class PhaserRuntimeAdapter implements GameRuntimePort {
  private game?: Phaser.Game;
  private scene?: GameScene;
  private mounting?: Promise<RuntimeMountResult>;

  public mount(input: RuntimeMountInput): Promise<RuntimeMountResult> {
    if (this.mounting) return this.mounting;
    if (this.game) return Promise.resolve({ ok: false, error: new Error('The Phaser runtime is already mounted.') });

    this.mounting = new Promise<RuntimeMountResult>((resolve) => {
      let settled = false;
      let ready = false;
      const finish = (result: RuntimeMountResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(result);
      };
      const timeout = setTimeout(() => {
        finish({ ok: false, error: new Error('Phaser runtime mount timed out after 15 seconds.') });
      }, 15_000);
      const scene = new GameScene({
        ...input,
        onReady: () => {
          ready = true;
          input.onReady?.();
          finish({ ok: true });
        },
        onFatal: (error) => {
          if (ready) input.onFatal(error);
          else finish({ ok: false, error });
        },
      });
      this.scene = scene;
      try {
        this.game = new Phaser.Game(createPhaserConfig(input, scene));
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        finish({ ok: false, error: normalized });
      }
    }).finally(() => {
      this.mounting = undefined;
    });
    return this.mounting;
  }

  public pause(): void {
    this.scene?.pauseRuntime();
  }

  public resume(): void {
    this.scene?.resumeRuntime();
  }

  public async dispose(): Promise<void> {
    await this.mounting;
    this.scene?.disposeRuntime();
    this.game?.destroy(true);
    this.scene = undefined;
    this.game = undefined;
  }
}

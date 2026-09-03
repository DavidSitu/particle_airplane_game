import Phaser from 'phaser';
import type { GameInputFrame } from '../../../systems/gameplay';

interface KeySet {
  readonly up: Phaser.Input.Keyboard.Key;
  readonly down: Phaser.Input.Keyboard.Key;
  readonly left: Phaser.Input.Keyboard.Key;
  readonly right: Phaser.Input.Keyboard.Key;
  readonly w: Phaser.Input.Keyboard.Key;
  readonly a: Phaser.Input.Keyboard.Key;
  readonly s: Phaser.Input.Keyboard.Key;
  readonly d: Phaser.Input.Keyboard.Key;
}

interface TouchPoint {
  readonly pointer: Phaser.Input.Pointer;
  readonly originX: number;
  readonly originY: number;
}

export interface TouchControlSnapshot {
  readonly movement?: {
    readonly originX: number;
    readonly originY: number;
    readonly currentX: number;
    readonly currentY: number;
  };
  readonly firing?: {
    readonly x: number;
    readonly y: number;
  };
}

const JOYSTICK_RADIUS = 72;

export class PhaserInputAdapter {
  private readonly keys: KeySet;
  private movementTouch?: TouchPoint;
  private firingTouch?: Phaser.Input.Pointer;
  private firePressed = false;
  private disposed = false;

  public constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input plugin is unavailable.');
    this.keys = keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
    }) as KeySet;

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp);
  }

  public readFrame(): GameInputFrame {
    if (this.disposed) return {};

    let moveX = Number(this.keys.right.isDown || this.keys.d.isDown) - Number(this.keys.left.isDown || this.keys.a.isDown);
    let moveY = Number(this.keys.down.isDown || this.keys.s.isDown) - Number(this.keys.up.isDown || this.keys.w.isDown);

    if (this.movementTouch?.pointer.isDown) {
      const dx = this.movementTouch.pointer.worldX - this.movementTouch.originX;
      const dy = this.movementTouch.pointer.worldY - this.movementTouch.originY;
      const magnitude = Math.max(JOYSTICK_RADIUS, Math.hypot(dx, dy));
      moveX = dx / magnitude;
      moveY = dy / magnitude;
    }

    const activePointer = this.firingTouch?.isDown
      ? this.firingTouch
      : this.scene.input.activePointer;
    activePointer.updateWorldPoint(this.scene.cameras.main);
    const usingMouse = !activePointer.wasTouch;
    const fireHeld = Boolean(this.firingTouch?.isDown) || (usingMouse && activePointer.isDown);
    const frame: GameInputFrame = {
      moveX,
      moveY,
      aimWorldX: activePointer.worldX,
      aimWorldY: activePointer.worldY,
      fireHeld,
      firePressed: this.firePressed,
    };
    this.firePressed = false;
    return frame;
  }

  public touchControls(): TouchControlSnapshot {
    const movement = this.movementTouch?.pointer.isDown
      ? {
          originX: this.movementTouch.originX,
          originY: this.movementTouch.originY,
          currentX: this.movementTouch.pointer.worldX,
          currentY: this.movementTouch.pointer.worldY,
        }
      : undefined;
    const firing = this.firingTouch?.isDown
      ? { x: this.firingTouch.worldX, y: this.firingTouch.worldY }
      : undefined;
    return {
      ...(movement ? { movement } : {}),
      ...(firing ? { firing } : {}),
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp);
    this.movementTouch = undefined;
    this.firingTouch = undefined;
  }

  private readonly onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    pointer.updateWorldPoint(this.scene.cameras.main);
    if (pointer.wasTouch) {
      if (pointer.worldX < this.scene.scale.gameSize.width / 2 && !this.movementTouch) {
        this.movementTouch = {
          pointer,
          originX: pointer.worldX,
          originY: pointer.worldY,
        };
      } else if (!this.firingTouch) {
        this.firingTouch = pointer;
        this.firePressed = true;
      }
      return;
    }
    this.firePressed = true;
  };

  private readonly onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.movementTouch?.pointer.id === pointer.id) this.movementTouch = undefined;
    if (this.firingTouch?.id === pointer.id) this.firingTouch = undefined;
  };
}

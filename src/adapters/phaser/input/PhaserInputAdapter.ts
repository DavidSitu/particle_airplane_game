import Phaser from 'phaser';
import type { PlaneShooterInputFrame } from '../../../systems/gameplay';

interface KeySet {
  readonly up: Phaser.Input.Keyboard.Key;
  readonly down: Phaser.Input.Keyboard.Key;
  readonly left: Phaser.Input.Keyboard.Key;
  readonly right: Phaser.Input.Keyboard.Key;
  readonly w: Phaser.Input.Keyboard.Key;
  readonly a: Phaser.Input.Keyboard.Key;
  readonly s: Phaser.Input.Keyboard.Key;
  readonly d: Phaser.Input.Keyboard.Key;
  readonly space: Phaser.Input.Keyboard.Key;
}

export interface TouchControlSnapshot {
  readonly joystick: {
    readonly centerX: number;
    readonly centerY: number;
    readonly knobX: number;
    readonly knobY: number;
    readonly active: boolean;
  };
  readonly fireButton: {
    readonly centerX: number;
    readonly centerY: number;
    readonly active: boolean;
  };
}

export const TOUCH_JOYSTICK_RADIUS = 72;
export const TOUCH_FIRE_RADIUS = 62;

export class PhaserInputAdapter {
  private readonly keys: KeySet;
  private movementTouch?: Phaser.Input.Pointer;
  private firingTouch?: Phaser.Input.Pointer;
  private touchFirePressed = false;
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
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
    }) as KeySet;

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp);
  }

  public readFrame(): PlaneShooterInputFrame {
    if (this.disposed) return {};

    let moveX =
      Number(this.keys.right.isDown || this.keys.d.isDown) -
      Number(this.keys.left.isDown || this.keys.a.isDown);
    // Simulation/world Y points upward; browser/canvas Y points downward.
    let moveY =
      Number(this.keys.up.isDown || this.keys.w.isDown) -
      Number(this.keys.down.isDown || this.keys.s.isDown);

    if (this.movementTouch?.isDown) {
      this.movementTouch.updateWorldPoint(this.scene.cameras.main);
      const { x, y } = this.joystickCenter();
      const dx = this.movementTouch.worldX - x;
      const dy = this.movementTouch.worldY - y;
      const magnitude = Math.max(TOUCH_JOYSTICK_RADIUS, Math.hypot(dx, dy));
      moveX = dx / magnitude;
      moveY = -dy / magnitude;
    }

    const firePressed = Phaser.Input.Keyboard.JustDown(this.keys.space) || this.touchFirePressed;
    this.touchFirePressed = false;
    return { moveX, moveY, firePressed };
  }

  public touchControls(): TouchControlSnapshot {
    const joystick = this.joystickCenter();
    let knobX = joystick.x;
    let knobY = joystick.y;
    if (this.movementTouch?.isDown) {
      this.movementTouch.updateWorldPoint(this.scene.cameras.main);
      const dx = this.movementTouch.worldX - joystick.x;
      const dy = this.movementTouch.worldY - joystick.y;
      const distance = Math.hypot(dx, dy);
      const scale = distance > TOUCH_JOYSTICK_RADIUS ? TOUCH_JOYSTICK_RADIUS / distance : 1;
      knobX += dx * scale;
      knobY += dy * scale;
    }
    const fire = this.fireCenter();
    return {
      joystick: {
        centerX: joystick.x,
        centerY: joystick.y,
        knobX,
        knobY,
        active: Boolean(this.movementTouch?.isDown),
      },
      fireButton: {
        centerX: fire.x,
        centerY: fire.y,
        active: Boolean(this.firingTouch?.isDown),
      },
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

  private joystickCenter(): { readonly x: number; readonly y: number } {
    return {
      x: this.scene.scale.gameSize.width * 0.2,
      y: this.scene.scale.gameSize.height * 0.85,
    };
  }

  private fireCenter(): { readonly x: number; readonly y: number } {
    return {
      x: this.scene.scale.gameSize.width * 0.8,
      y: this.scene.scale.gameSize.height * 0.85,
    };
  }

  private readonly onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!pointer.wasTouch) return;
    pointer.updateWorldPoint(this.scene.cameras.main);
    const joystick = this.joystickCenter();
    const fire = this.fireCenter();
    if (!this.movementTouch && Phaser.Math.Distance.Between(
      pointer.worldX,
      pointer.worldY,
      joystick.x,
      joystick.y,
    ) <= TOUCH_JOYSTICK_RADIUS + 28) {
      this.movementTouch = pointer;
      return;
    }
    if (!this.firingTouch && Phaser.Math.Distance.Between(
      pointer.worldX,
      pointer.worldY,
      fire.x,
      fire.y,
    ) <= TOUCH_FIRE_RADIUS + 18) {
      this.firingTouch = pointer;
      this.touchFirePressed = true;
    }
  };

  private readonly onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.movementTouch?.id === pointer.id) this.movementTouch = undefined;
    if (this.firingTouch?.id === pointer.id) this.firingTouch = undefined;
  };
}

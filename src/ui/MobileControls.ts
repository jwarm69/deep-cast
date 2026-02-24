import { Component, FishingState } from '../core/types';
import { InputManager } from '../core/InputManager';

/**
 * MobileControls — wires up the virtual joystick and action buttons
 * to feed input back into InputManager.
 * Only active on touch devices.
 */
export class MobileControls implements Component {
  private input: InputManager;
  private joystickZone: HTMLElement;
  private joystickThumb: HTMLElement;
  private actionBtn: HTMLElement;

  // Joystick state
  private joystickTouchId: number | null = null;
  private joystickCenterX = 0;
  private joystickCenterY = 0;
  private readonly joystickRadius = 40;

  // Action button
  private actionTouchId: number | null = null;

  // Callbacks for secondary buttons (set from main.ts)
  public onBoardPress: (() => void) | null = null;
  public onShopPress: (() => void) | null = null;
  public onJournalPress: (() => void) | null = null;

  // Bound handlers
  private handleJoystickStart: (e: TouchEvent) => void;
  private handleJoystickMove: (e: TouchEvent) => void;
  private handleJoystickEnd: (e: TouchEvent) => void;
  private handleActionStart: (e: TouchEvent) => void;
  private handleActionEnd: (e: TouchEvent) => void;

  constructor(input: InputManager) {
    this.input = input;
    this.joystickZone = document.getElementById('joystick-zone')!;
    this.joystickThumb = document.getElementById('joystick-thumb')!;
    this.actionBtn = document.getElementById('action-btn')!;

    // Joystick touch handlers
    this.handleJoystickStart = (e: TouchEvent) => {
      e.preventDefault();
      if (this.joystickTouchId !== null) return;
      const t = e.changedTouches[0];
      this.joystickTouchId = t.identifier;
      const rect = this.joystickZone.getBoundingClientRect();
      this.joystickCenterX = rect.left + rect.width / 2;
      this.joystickCenterY = rect.top + rect.height / 2;
      this.updateJoystick(t.clientX, t.clientY);
    };

    this.handleJoystickMove = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.joystickTouchId) {
          this.updateJoystick(t.clientX, t.clientY);
          break;
        }
      }
    };

    this.handleJoystickEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.joystickTouchId) {
          this.joystickTouchId = null;
          this.input.setJoystick(0, 0);
          this.joystickThumb.style.transform = 'translate(-50%, -50%)';
          break;
        }
      }
    };

    // Action button handlers
    this.handleActionStart = (e: TouchEvent) => {
      e.preventDefault();
      if (this.actionTouchId !== null) return;
      this.actionTouchId = e.changedTouches[0].identifier;
      this.input.setTouchAction(true);
      this.actionBtn.classList.add('active');
    };

    this.handleActionEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.actionTouchId) {
          this.actionTouchId = null;
          this.input.setTouchAction(false);
          this.actionBtn.classList.remove('active');
          break;
        }
      }
    };
  }

  init(): void {
    // Joystick
    this.joystickZone.addEventListener('touchstart', this.handleJoystickStart, { passive: false });
    this.joystickZone.addEventListener('touchmove', this.handleJoystickMove, { passive: false });
    this.joystickZone.addEventListener('touchend', this.handleJoystickEnd);
    this.joystickZone.addEventListener('touchcancel', this.handleJoystickEnd);

    // Action button
    this.actionBtn.addEventListener('touchstart', this.handleActionStart, { passive: false });
    this.actionBtn.addEventListener('touchend', this.handleActionEnd);
    this.actionBtn.addEventListener('touchcancel', this.handleActionEnd);

    // Secondary buttons
    document.getElementById('btn-board')!.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.onBoardPress?.();
    }, { passive: false });
    document.getElementById('btn-shop')!.addEventListener('click', () => {
      this.onShopPress?.();
    });
    document.getElementById('btn-journal')!.addEventListener('click', () => {
      this.onJournalPress?.();
    });
  }

  private updateJoystick(touchX: number, touchY: number): void {
    let dx = touchX - this.joystickCenterX;
    let dy = touchY - this.joystickCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Clamp to radius
    if (dist > this.joystickRadius) {
      dx = (dx / dist) * this.joystickRadius;
      dy = (dy / dist) * this.joystickRadius;
    }

    // Move thumb visually
    this.joystickThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    // Normalize to -1..1 and feed into input
    const nx = dx / this.joystickRadius;
    const nz = -dy / this.joystickRadius; // Y-up: drag up = forward (+z)
    this.input.setJoystick(nx, nz);
  }

  /** Update the action button label based on fishing state */
  setFishingState(state: FishingState): void {
    switch (state) {
      case FishingState.IDLE:
        this.actionBtn.textContent = 'CAST';
        break;
      case FishingState.CASTING:
        this.actionBtn.textContent = 'CAST';
        break;
      case FishingState.BITING:
        this.actionBtn.textContent = 'HOOK!';
        break;
      case FishingState.REELING:
        this.actionBtn.textContent = 'REEL';
        break;
      case FishingState.CAUGHT:
      case FishingState.ESCAPED:
        this.actionBtn.textContent = 'OK';
        break;
      default:
        this.actionBtn.textContent = 'CAST';
    }
  }

  update(_dt: number): void {}

  destroy(): void {
    this.joystickZone.removeEventListener('touchstart', this.handleJoystickStart);
    this.joystickZone.removeEventListener('touchmove', this.handleJoystickMove);
    this.joystickZone.removeEventListener('touchend', this.handleJoystickEnd);
    this.joystickZone.removeEventListener('touchcancel', this.handleJoystickEnd);
    this.actionBtn.removeEventListener('touchstart', this.handleActionStart);
    this.actionBtn.removeEventListener('touchend', this.handleActionEnd);
    this.actionBtn.removeEventListener('touchcancel', this.handleActionEnd);
  }
}

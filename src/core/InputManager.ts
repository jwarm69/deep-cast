import { Component, Events } from './types';
import { EventSystem } from './EventSystem';

export class InputManager implements Component {
  private events: EventSystem;
  private _mouseDown = false;
  private _mouseX = 0;
  private _mouseY = 0;
  private _mouseDeltaX = 0;
  private _mouseDeltaY = 0;
  private _scrollDelta = 0;

  // Keyboard state
  private keysDown = new Set<string>();

  // Touch state
  private _isMobile = false;
  private _joystickX = 0;
  private _joystickZ = 0;
  private _touchActionDown = false;

  // Touch camera orbit tracking
  private _cameraTouch: { id: number; lastX: number; lastY: number } | null = null;

  // Pinch zoom
  private _pinchDist = 0;

  // Bound handlers for cleanup
  private handleMouseDown: (e: MouseEvent) => void;
  private handleMouseUp: (e: MouseEvent) => void;
  private handleMouseMove: (e: MouseEvent) => void;
  private handleWheel: (e: WheelEvent) => void;
  private handleContextMenu: (e: Event) => void;
  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleKeyUp: (e: KeyboardEvent) => void;
  private handleTouchStart: (e: TouchEvent) => void;
  private handleTouchMove: (e: TouchEvent) => void;
  private handleTouchEnd: (e: TouchEvent) => void;

  constructor(events: EventSystem) {
    this.events = events;

    // Detect mobile/touch device
    this._isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    this.handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        this._mouseDown = true;
        this.events.emitImmediate(Events.MOUSE_DOWN, { x: e.clientX, y: e.clientY });
      }
    };

    this.handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        this._mouseDown = false;
        this.events.emitImmediate(Events.MOUSE_UP, { x: e.clientX, y: e.clientY });
      }
    };

    this.handleMouseMove = (e: MouseEvent) => {
      this._mouseDeltaX += e.movementX;
      this._mouseDeltaY += e.movementY;
      this._mouseX = e.clientX;
      this._mouseY = e.clientY;
    };

    this.handleWheel = (e: WheelEvent) => {
      this._scrollDelta += e.deltaY;
    };

    this.handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    this.handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      this.keysDown.add(key);
      // Prevent space from scrolling and tab from focus-switching
      if (key === ' ' || key === 'tab') e.preventDefault();
      this.events.emitImmediate(Events.KEY_DOWN, { key });
    };

    this.handleKeyUp = (e: KeyboardEvent) => {
      this.keysDown.delete(e.key.toLowerCase());
    };

    // Touch handlers — camera orbit via 1-finger drag on canvas
    this.handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;

      // Ignore touches on UI buttons (joystick, action buttons)
      if (target.closest('#mobile-controls')) return;

      if (e.touches.length === 2) {
        // Start pinch zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this._pinchDist = Math.sqrt(dx * dx + dy * dy);
        this._cameraTouch = null; // Cancel orbit during pinch
        return;
      }

      if (e.touches.length === 1 && !this._cameraTouch) {
        const t = e.touches[0];
        this._cameraTouch = { id: t.identifier, lastX: t.clientX, lastY: t.clientY };
        this._mouseDown = true;
        this.events.emitImmediate(Events.MOUSE_DOWN, { x: t.clientX, y: t.clientY });
      }
    };

    this.handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();

      // Pinch zoom
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (this._pinchDist > 0) {
          const delta = this._pinchDist - dist;
          this._scrollDelta += delta * 0.5;
          this._pinchDist = dist;
        }
        return;
      }

      // Camera orbit via single finger
      if (this._cameraTouch && e.touches.length === 1) {
        const t = e.touches[0];
        if (t.identifier === this._cameraTouch.id) {
          this._mouseDeltaX += (t.clientX - this._cameraTouch.lastX);
          this._mouseDeltaY += (t.clientY - this._cameraTouch.lastY);
          this._cameraTouch.lastX = t.clientX;
          this._cameraTouch.lastY = t.clientY;
        }
      }
    };

    this.handleTouchEnd = (e: TouchEvent) => {
      // Reset pinch
      if (e.touches.length < 2) {
        this._pinchDist = 0;
      }

      // Release camera orbit touch
      if (this._cameraTouch) {
        let found = false;
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === this._cameraTouch.id) {
            found = true;
            break;
          }
        }
        if (!found) {
          this._cameraTouch = null;
          this._mouseDown = false;
          this.events.emitImmediate(Events.MOUSE_UP, { x: 0, y: 0 });
        }
      }
    };
  }

  init(): void {
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('wheel', this.handleWheel, { passive: true });
    window.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    // Touch listeners on the canvas area
    window.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    window.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    window.addEventListener('touchend', this.handleTouchEnd);
    window.addEventListener('touchcancel', this.handleTouchEnd);
  }

  get isMobile(): boolean { return this._isMobile; }
  get mouseDown(): boolean { return this._mouseDown; }
  get mouseX(): number { return this._mouseX; }
  get mouseY(): number { return this._mouseY; }

  /** Whether the space bar is currently held */
  get spaceDown(): boolean { return this.keysDown.has(' ') || this._touchActionDown; }

  /** Check if a key is currently held */
  isKeyDown(key: string): boolean { return this.keysDown.has(key); }

  /** Set virtual joystick input (called from mobile controls) */
  setJoystick(x: number, z: number): void {
    this._joystickX = x;
    this._joystickZ = z;
  }

  /** Set touch action button state (replaces spacebar) */
  setTouchAction(down: boolean): void {
    this._touchActionDown = down;
  }

  consumeMouseDelta(): { dx: number; dy: number } {
    const dx = this._mouseDeltaX;
    const dy = this._mouseDeltaY;
    this._mouseDeltaX = 0;
    this._mouseDeltaY = 0;
    return { dx, dy };
  }

  consumeScrollDelta(): number {
    const d = this._scrollDelta;
    this._scrollDelta = 0;
    return d;
  }

  /** Get WASD / arrow key / virtual joystick movement vector (x = left/right, z = forward/back) */
  getMovementInput(): { x: number; z: number } {
    let x = this._joystickX;
    let z = this._joystickZ;
    if (this.keysDown.has('w') || this.keysDown.has('arrowup')) z += 1;
    if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) z -= 1;
    if (this.keysDown.has('a') || this.keysDown.has('arrowleft')) x -= 1;
    if (this.keysDown.has('d') || this.keysDown.has('arrowright')) x += 1;
    // Clamp to unit circle
    const len = Math.sqrt(x * x + z * z);
    if (len > 1) { x /= len; z /= len; }
    return { x, z };
  }

  update(_dt: number): void {}

  destroy(): void {
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('touchstart', this.handleTouchStart);
    window.removeEventListener('touchmove', this.handleTouchMove);
    window.removeEventListener('touchend', this.handleTouchEnd);
    window.removeEventListener('touchcancel', this.handleTouchEnd);
  }
}

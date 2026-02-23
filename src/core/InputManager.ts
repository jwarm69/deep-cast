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

  // Bound handlers for cleanup
  private handleMouseDown: (e: MouseEvent) => void;
  private handleMouseUp: (e: MouseEvent) => void;
  private handleMouseMove: (e: MouseEvent) => void;
  private handleWheel: (e: WheelEvent) => void;
  private handleContextMenu: (e: Event) => void;
  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleKeyUp: (e: KeyboardEvent) => void;

  constructor(events: EventSystem) {
    this.events = events;

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
  }

  init(): void {
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('wheel', this.handleWheel, { passive: true });
    window.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  get mouseDown(): boolean { return this._mouseDown; }
  get mouseX(): number { return this._mouseX; }
  get mouseY(): number { return this._mouseY; }

  /** Whether the space bar is currently held */
  get spaceDown(): boolean { return this.keysDown.has(' '); }

  /** Check if a key is currently held */
  isKeyDown(key: string): boolean { return this.keysDown.has(key); }

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

  /** Get WASD / arrow key movement vector (x = left/right, z = forward/back) */
  getMovementInput(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (this.keysDown.has('w') || this.keysDown.has('arrowup')) z += 1;
    if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) z -= 1;
    if (this.keysDown.has('a') || this.keysDown.has('arrowleft')) x -= 1;
    if (this.keysDown.has('d') || this.keysDown.has('arrowright')) x += 1;
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
  }
}

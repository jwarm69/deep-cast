import { Component } from './types';
import { Renderer } from './Renderer';
import { Camera } from './Camera';
import { EventSystem } from './EventSystem';
import { InputManager } from './InputManager';

export class Engine {
  public renderer: Renderer;
  public camera: Camera;
  public events: EventSystem;
  public input: InputManager;
  private components: Component[] = [];
  private lastFrameTime = 0;
  private isRunning = false;
  private animationFrameId: number | null = null;

  constructor(container: HTMLElement) {
    this.events = new EventSystem();
    this.input = new InputManager(this.events);
    this.renderer = new Renderer(container);
    this.camera = new Camera(this.input);

    // Core systems update in order
    this.addComponent(this.events);
    this.addComponent(this.input);
    this.addComponent(this.camera);
  }

  addComponent(component: Component): void {
    this.components.push(component);
  }

  removeComponent(component: Component): void {
    const i = this.components.indexOf(component);
    if (i !== -1) this.components.splice(i, 1);
  }

  async init(): Promise<void> {
    this.renderer.init();
    for (const c of this.components) {
      if (c.init) await c.init();
    }
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.loop();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;

    // Update all systems
    for (const c of this.components) {
      c.update(dt);
    }

    // Render
    this.renderer.render(this.camera.camera);

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  get scene() {
    return this.renderer.scene;
  }

  async destroy(): Promise<void> {
    this.stop();
    for (const c of this.components) {
      if (c.destroy) c.destroy();
    }
    this.components = [];
    this.renderer.destroy();
  }
}

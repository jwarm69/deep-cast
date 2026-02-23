import { GameEvent, EventCallback, Component } from './types';

export class EventSystem implements Component {
  private listeners = new Map<string, EventCallback[]>();
  private eventQueue: GameEvent[] = [];
  private isProcessing = false;

  on(eventType: string, callback: EventCallback): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  off(eventType: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    }
  }

  emit(eventType: string, data?: any): void {
    this.eventQueue.push({
      type: eventType,
      data,
      timestamp: Date.now(),
    });
  }

  emitImmediate(eventType: string, data?: any): void {
    this.processEvent({
      type: eventType,
      data,
      timestamp: Date.now(),
    });
  }

  update(_deltaTime: number): void {
    if (this.isProcessing || this.eventQueue.length === 0) return;
    this.isProcessing = true;

    const events = [...this.eventQueue];
    this.eventQueue = [];
    events.forEach((e) => this.processEvent(e));

    this.isProcessing = false;
  }

  private processEvent(event: GameEvent): void {
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.error(`Event error [${event.type}]:`, err);
        }
      });
    }
  }

  destroy(): void {
    this.listeners.clear();
    this.eventQueue = [];
  }
}

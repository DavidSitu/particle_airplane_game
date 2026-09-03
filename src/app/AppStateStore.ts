export type StateListener<T> = (state: Readonly<T>) => void;

export class AppStateStore<T> {
  private currentState: T;
  private readonly listeners = new Set<StateListener<T>>();

  constructor(initialState: T) {
    this.currentState = initialState;
  }

  get snapshot(): Readonly<T> {
    return this.currentState;
  }

  set(state: T): void {
    this.currentState = state;
    for (const listener of this.listeners) listener(this.currentState);
  }

  subscribe(listener: StateListener<T>): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    this.listeners.clear();
  }
}

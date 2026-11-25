import { EventEmitter } from "events";

export interface RealtimeChangeEvent {
  version: number;
  action: string;
  updated_at: string;
}

interface RealtimeBusStore {
  emitter: EventEmitter;
  version: number;
}

const globalRef = globalThis as typeof globalThis & {
  __civicledgerRealtimeBus?: RealtimeBusStore;
};

function getBus(): RealtimeBusStore {
  if (!globalRef.__civicledgerRealtimeBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(100);
    globalRef.__civicledgerRealtimeBus = {
      emitter,
      version: 1,
    };
  }
  return globalRef.__civicledgerRealtimeBus;
}

export function emitClearinghouseUpdate(action: string): RealtimeChangeEvent {
  const bus = getBus();
  bus.version += 1;
  const payload: RealtimeChangeEvent = {
    version: bus.version,
    action,
    updated_at: new Date().toISOString(),
  };
  bus.emitter.emit("state_changed", payload);
  return payload;
}

export function subscribeClearinghouseUpdates(
  listener: (ev: RealtimeChangeEvent) => void
): () => void {
  const bus = getBus();
  bus.emitter.on("state_changed", listener);
  return () => {
    bus.emitter.off("state_changed", listener);
  };
}

export function getRealtimeVersion(): number {
  return getBus().version;
}

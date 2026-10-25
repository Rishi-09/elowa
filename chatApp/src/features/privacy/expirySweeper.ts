import { localCache } from '@/services/localCache';
import { useMessageStore } from '@/stores/messageStore';

const SWEEP_INTERVAL_MS = 30_000;

let timer: ReturnType<typeof setInterval> | null = null;

async function sweep(): Promise<void> {
  const now = new Date();
  await localCache.deleteExpired(now).catch(() => {});

  const nowIso = now.toISOString();
  const state = useMessageStore.getState();
  const next: typeof state.byConv = {};
  let changed = false;
  for (const [convId, conv] of Object.entries(state.byConv)) {
    const kept = conv.messages.filter((m) => !m.expiresAt || m.expiresAt > nowIso);
    if (kept.length !== conv.messages.length) changed = true;
    next[convId] = { ...conv, messages: kept };
  }
  if (changed) {
    useMessageStore.setState({ byConv: next });
  }
}

export const expirySweeper = {
  start(): void {
    if (timer) return;
    void sweep();
    timer = setInterval(sweep, SWEEP_INTERVAL_MS);
  },
  stop(): void {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  },
  sweepNow: sweep,
};

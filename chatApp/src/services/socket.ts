import { io, Socket } from 'socket.io-client';
import { config } from '@/constants/config';
import { getAccessToken, refreshAccessToken } from './api';
import type { ClientToServerEvents, ServerToClientEvents } from './socketEvents';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type Status = 'disconnected' | 'connecting' | 'connected';
type StatusListener = (s: Status) => void;
type AnyHandler = (...args: never[]) => void;

/** Ack timeout for request/response emits, in ms. */
const ACK_TIMEOUT = 12_000;

class SocketClient {
  private socket: TypedSocket | null = null;
  private status: Status = 'disconnected';
  private statusListeners = new Set<StatusListener>();
  private joined = new Set<string>();
  /**
   * Handlers live here rather than on the socket instance, so subscribing
   * before `connect()` finishes — or across a disconnect/reconnect that
   * replaces the instance — never silently drops events.
   */
  private handlers = new Map<string, Set<AnyHandler>>();
  private connecting: Promise<void> | null = null;
  private reauthInFlight = false;

  async connect(): Promise<void> {
    if (this.socket?.connected) return;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const token = (await getAccessToken()) ?? (await refreshAccessToken());
      if (!token) {
        this.setStatus('disconnected');
        return;
      }

      this.setStatus('connecting');
      const socket = io(config.socketUrl, {
        transports: ['websocket'],
        auth: { token },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 8000,
        timeout: 10_000,
      }) as TypedSocket;

      this.socket = socket;
      this.bindAll(socket);

      socket.on('connect', () => {
        this.setStatus('connected');
        for (const id of this.joined) {
          socket.emit('conversation:join', { conversationId: id });
        }
      });

      socket.on('disconnect', () => this.setStatus('disconnected'));

      socket.on('connect_error', (err: Error) => {
        this.setStatus('disconnected');
        void this.handleConnectError(err);
      });
    })().finally(() => {
      this.connecting = null;
    });

    return this.connecting;
  }

  /**
   * The handshake rejects once the access token expires. Refresh it and feed
   * the new token to the existing socket so its own backoff keeps working.
   */
  private async handleConnectError(err: Error): Promise<void> {
    const message = String(err?.message ?? '').toLowerCase();
    const isAuth =
      message.includes('unauthor') || message.includes('token') || message.includes('auth');
    if (!isAuth || this.reauthInFlight) return;

    this.reauthInFlight = true;
    try {
      const token = await refreshAccessToken();
      if (token && this.socket) {
        this.socket.auth = { token };
      }
    } finally {
      this.reauthInFlight = false;
    }
  }

  disconnect(): void {
    this.socket?.off();
    this.socket?.disconnect();
    this.socket = null;
    this.joined.clear();
    this.setStatus('disconnected');
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }

  getStatus(): Status {
    return this.status;
  }

  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  on<K extends keyof ServerToClientEvents>(event: K, fn: ServerToClientEvents[K]): () => void {
    const key = event as string;
    let set = this.handlers.get(key);
    if (!set) {
      set = new Set();
      this.handlers.set(key, set);
    }
    set.add(fn as AnyHandler);
    this.socket?.on(event, fn as never);

    return () => {
      set?.delete(fn as AnyHandler);
      this.socket?.off(event, fn as never);
    };
  }

  emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): void {
    this.socket?.emit(event, ...(args as never));
  }

  /**
   * Emit and await the server ack. Rejects on timeout or when the socket is
   * down, so callers can queue instead of hanging.
   */
  emitWithAck<T>(event: keyof ClientToServerEvents, payload: unknown, timeout = ACK_TIMEOUT): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('offline'));
        return;
      }
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('ack_timeout'));
      }, timeout);

      const ack = (res: T) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(res);
      };
      (this.socket as unknown as { emit: (e: string, p: unknown, cb: unknown) => void }).emit(
        event as string,
        payload,
        ack,
      );
    });
  }

  joinConversation(conversationId: string): void {
    this.joined.add(conversationId);
    if (this.socket?.connected) {
      this.socket.emit('conversation:join', { conversationId });
    }
  }

  leaveConversation(conversationId: string): void {
    this.joined.delete(conversationId);
    if (this.socket?.connected) {
      this.socket.emit('conversation:leave', { conversationId });
    }
  }

  private bindAll(socket: TypedSocket): void {
    for (const [event, set] of this.handlers) {
      for (const fn of set) socket.on(event as never, fn as never);
    }
  }

  private setStatus(s: Status) {
    if (this.status === s) return;
    this.status = s;
    for (const fn of this.statusListeners) fn(s);
  }
}

export const socketClient = new SocketClient();

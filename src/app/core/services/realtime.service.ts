import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

/** Estado en vivo de una sala: quién está conectado y quién está escribiendo. */
export interface RoomLiveState {
  readonly onlineIds: Signal<string[]>;
  readonly typingNames: Signal<string[]>;
  notifyTyping(): void;
  disconnect(): void;
}

const TYPING_SEND_EVERY_MS = 2000;
const TYPING_VISIBLE_MS = 3500;

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly supabase = inject(SupabaseService).client;

  /**
   * Se une al canal privado "room:<roomId>".
   * - Presence: cada cliente "anuncia" que está en la sala; al cerrar la app, Realtime lo quita solo.
   * - Broadcast: mensajes efímeros (no se guardan) para el aviso "escribiendo…".
   */
  connect(roomId: string, me: { userId: string; name: string }): RoomLiveState {
    const onlineIds = signal<string[]>([]);
    const typing = signal<Record<string, { name: string; until: number }>>({});
    let channel: RealtimeChannel | null = null;
    let lastTypingSent = 0;
    let closed = false;

    const open = async () => {
      // Toma el token vigente de Firebase (vía accessToken) antes de entrar a un canal privado.
      await this.supabase.realtime.setAuth();
      if (closed) return;

      channel = this.supabase.channel(`room:${roomId}`, {
        config: { private: true, presence: { key: me.userId }, broadcast: { self: false } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          onlineIds.set(Object.keys(channel?.presenceState() ?? {}));
        })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          const { userId, name } = payload as { userId: string; name: string };
          typing.update((current) => ({ ...current, [userId]: { name, until: Date.now() + TYPING_VISIBLE_MS } }));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') await channel?.track({ name: me.name, since: new Date().toISOString() });
        });
    };
    void open();

    // Borra los avisos "escribiendo…" que ya vencieron.
    const sweeper = setInterval(() => {
      const now = Date.now();
      typing.update((current) =>
        Object.fromEntries(Object.entries(current).filter(([, entry]) => entry.until > now)),
      );
    }, 1000);

    return {
      onlineIds: onlineIds.asReadonly(),
      typingNames: computed(() => Object.values(typing()).map((entry) => entry.name)),
      notifyTyping: () => {
        const now = Date.now();
        if (!channel || now - lastTypingSent < TYPING_SEND_EVERY_MS) return;
        lastTypingSent = now;
        void channel.send({ type: 'broadcast', event: 'typing', payload: { userId: me.userId, name: me.name } });
      },
      disconnect: () => {
        closed = true;
        clearInterval(sweeper);
        if (channel) void this.supabase.removeChannel(channel);
      },
    };
  }
}

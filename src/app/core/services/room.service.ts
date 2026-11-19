import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { MemberProfile, Room, RoomListItem, RoomMember } from '../models/room';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

type RoomsRequest =
  | { action: 'create'; name: string; description: string; isPrivate: boolean }
  | { action: 'join'; roomId: string }
  | { action: 'leave'; roomId: string }
  | { action: 'add'; roomId: string; userId: string }
  | { action: 'direct'; otherUserId: string };

@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly authService = inject(AuthService);
  private readonly supabase = inject(SupabaseService).client;

  private readonly uid = computed(() => this.authService.user()?.uid ?? null);
  private readonly rooms = signal<RoomListItem[]>([]);
  readonly myRooms = this.rooms.asReadonly();

  constructor() {
    effect(() => {
      if (!this.uid()) untracked(() => this.rooms.set([]));
    });
  }

  // ---------- Lecturas (directas a Supabase, filtradas por RLS) ----------
  async loadMyRooms(): Promise<RoomListItem[]> {
    const uid = this.requireUid();
    const { data, error } = await this.supabase
      .from('rooms')
      .select('*, room_members!inner(user_id)')
      .eq('room_members.user_id', uid)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rooms = (data ?? []).map(({ room_members, ...room }) => room as Room);
    const directIds = rooms.filter((r) => r.type === 'direct').map((r) => r.id);
    const partners = await this.loadDirectPartners(directIds, uid);

    const items = rooms.map((r) => this.toListItem(r, partners.get(r.id)));
    this.rooms.set(items);
    return items;
  }

  async loadPublicRoomsNotJoined(): Promise<RoomListItem[]> {
    const { data, error } = await this.supabase
      .from('rooms')
      .select('*')
      .eq('type', 'group')
      .eq('is_private', false)
      .order('created_at', { ascending: false })
      .returns<Room[]>();
    if (error) throw error;

    const joined = new Set(this.rooms().map((r) => r.id));
    return (data ?? []).filter((r) => !joined.has(r.id)).map((r) => this.toListItem(r));
  }

  async getRoom(roomId: string): Promise<Room | null> {
    const { data, error } = await this.supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle<Room>();
    if (error) throw error;
    return data;
  }

  async getMembers(roomId: string): Promise<RoomMember[]> {
    const { data, error } = await this.supabase
      .from('room_members')
      .select('room_id, user_id, role, joined_at, profile:profiles(id, display_name, avatar_url)')
      .eq('room_id', roomId)
      .order('joined_at')
      .returns<RoomMember[]>();
    if (error) throw error;
    return data ?? [];
  }

  async listProfiles(): Promise<MemberProfile[]> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .order('display_name')
      .returns<MemberProfile[]>();
    if (error) throw error;
    return data ?? [];
  }

  // ---------- Escrituras (a través de la Edge Function) ----------
  async createRoom(name: string, description: string, isPrivate: boolean): Promise<string> {
    const { roomId } = await this.invoke({ action: 'create', name, description, isPrivate });
    await this.loadMyRooms();
    return roomId;
  }

  async join(roomId: string): Promise<void> {
    await this.invoke({ action: 'join', roomId });
    await this.loadMyRooms();
  }

  async leave(roomId: string): Promise<void> {
    await this.invoke({ action: 'leave', roomId });
    await this.loadMyRooms();
  }

  async addMember(roomId: string, userId: string): Promise<void> {
    await this.invoke({ action: 'add', roomId, userId });
  }

  async openDirect(otherUserId: string): Promise<string> {
    const { roomId } = await this.invoke({ action: 'direct', otherUserId });
    await this.loadMyRooms();
    return roomId;
  }

  // ---------- Auxiliares ----------
  private async invoke(body: RoomsRequest): Promise<{ roomId: string }> {
    const { data, error } = await this.supabase.functions.invoke('rooms', { body });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const detail = await error.context.json().catch(() => null);
        throw new Error(detail?.error ?? 'No se pudo completar la acción');
      }
      throw new Error('No hay conexión con el servidor');
    }
    return data;
  }

  private async loadDirectPartners(roomIds: string[], uid: string): Promise<Map<string, MemberProfile>> {
    const partners = new Map<string, MemberProfile>();
    if (roomIds.length === 0) return partners;

    const { data, error } = await this.supabase
      .from('room_members')
      .select('room_id, profile:profiles(id, display_name, avatar_url)')
      .in('room_id', roomIds)
      .neq('user_id', uid)
      .returns<{ room_id: string; profile: MemberProfile | null }[]>();
    if (error) throw error;

    for (const row of data ?? []) {
      if (row.profile) partners.set(row.room_id, row.profile);
    }
    return partners;
  }

  private toListItem(room: Room, partner?: MemberProfile): RoomListItem {
    if (room.type === 'direct') {
      return { ...room, title: partner?.display_name ?? 'Chat directo', avatar_url: partner?.avatar_url ?? null };
    }
    return { ...room, title: room.name ?? 'Sala', avatar_url: null };
  }

  private requireUid(): string {
    const uid = this.uid();
    if (!uid) throw new Error('No hay sesión iniciada');
    return uid;
  }
}
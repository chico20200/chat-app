import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { MemberProfile, Room, RoomMember } from '../models/room';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

type RoomsRequest =
  | { action: 'create'; name: string; description: string; isPrivate: boolean }
  | { action: 'join'; roomId: string }
  | { action: 'leave'; roomId: string }
  | { action: 'add'; roomId: string; userId: string };

@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly authService = inject(AuthService);
  private readonly supabase = inject(SupabaseService).client;

  private readonly uid = computed(() => this.authService.user()?.uid ?? null);
  private readonly rooms = signal<Room[]>([]);
  readonly myRooms = this.rooms.asReadonly();

  constructor() {
    effect(() => {
      if (!this.uid()) untracked(() => this.rooms.set([]));
    });
  }

  // ---------- Lecturas (directas a Supabase, filtradas por RLS) ----------
  async loadMyRooms(): Promise<Room[]> {
    const uid = this.requireUid();
    const { data, error } = await this.supabase
      .from('rooms')
      .select('*, room_members!inner(user_id)')
      .eq('room_members.user_id', uid)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rooms = (data ?? []).map(({ room_members, ...room }) => room as Room);
    this.rooms.set(rooms);
    return rooms;
  }

  async loadPublicRoomsNotJoined(): Promise<Room[]> {
    const { data, error } = await this.supabase
      .from('rooms')
      .select('*')
      .eq('type', 'group')
      .eq('is_private', false)
      .order('created_at', { ascending: false })
      .returns<Room[]>();
    if (error) throw error;

    const joined = new Set(this.rooms().map((r) => r.id));
    return (data ?? []).filter((r) => !joined.has(r.id));
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

  private requireUid(): string {
    const uid = this.uid();
    if (!uid) throw new Error('No hay sesión iniciada');
    return uid;
  }
}
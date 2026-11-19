import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { UserProfile } from '../models/user-profile';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { resizeImageToSquare } from '../utils/image';

export type ProfileChanges = Pick<UserProfile, 'display_name' | 'bio' | 'avatar_url'>;

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly authService = inject(AuthService);
  private readonly supabase = inject(SupabaseService).client;

  private readonly uid = computed(() => this.authService.user()?.uid ?? null);
  private readonly profile = signal<UserProfile | null>(null);
  readonly myProfile = this.profile.asReadonly();

  private seq = 0;

  constructor() {
    effect(() => {
      const uid = this.uid();
      untracked(() => void this.sync(uid));
    });
  }

  private async sync(uid: string | null): Promise<void> {
    const mySeq = ++this.seq;
    if (!uid) {
      this.profile.set(null);
      return;
    }

    const { error: insertError } = await this.supabase
      .from('profiles')
      .upsert({ id: uid, display_name: this.fallbackName() }, { onConflict: 'id', ignoreDuplicates: true });
    if (insertError) throw insertError;

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single<UserProfile>();
    if (error) throw error;

    if (mySeq === this.seq) this.profile.set(data);
  }

    async createMine(displayName: string): Promise<UserProfile> {
        const uid = this.uid();
        if (!uid) throw new Error('No hay sesión iniciada');
        const mySeq = ++this.seq;

        const { data, error } = await this.supabase
        .from('profiles')
        .upsert({ id: uid, display_name: displayName }, { onConflict: 'id' })
        .select()
        .single<UserProfile>();
        if (error) throw error;

        if (mySeq === this.seq) this.profile.set(data);
        return data;
    }

    async saveMine(changes: Partial<ProfileChanges>): Promise<UserProfile> {
        const uid = this.uid();
        if (!uid) throw new Error('No hay sesión iniciada');
        const mySeq = ++this.seq;

        const { data, error } = await this.supabase
        .from('profiles')
        .update(changes)
        .eq('id', uid)
        .select()
        .single<UserProfile>();
        if (error) throw error;

        if (mySeq === this.seq) this.profile.set(data);
        return data;
    }

    async uploadAvatar(file: File): Promise<void> {
    const uid = this.uid();
    if (!uid) throw new Error('No hay sesión iniciada');

    const blob = await resizeImageToSquare(file);
    const extension = blob.type === 'image/webp' ? 'webp' : 'png';
    const path = `${uid}/avatar.${extension}`;

    const bucket = this.supabase.storage.from('avatars');
    const { error } = await bucket.upload(path, blob, {
      upsert: true,
      contentType: blob.type,
      cacheControl: '3600',
    });
    if (error) throw error;

    const { data } = bucket.getPublicUrl(path);
    await this.saveMine({ avatar_url: `${data.publicUrl}?v=${Date.now()}` });
  }

  private fallbackName(): string {
    const user = this.authService.user();
    const name = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Usuario';
    return name.slice(0, 40);
  }
}
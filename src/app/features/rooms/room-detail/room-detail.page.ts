import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel,
  IonList, IonListHeader, IonNote, IonSpinner, IonText, IonTitle, IonToolbar, ToastController,
} from '@ionic/angular';
import { MemberProfile, Room, RoomMember } from '../../../core/models/room';
import { AuthService } from '../../../core/services/auth.service';
import { RoomService } from '../../../core/services/room.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-room-detail',
  templateUrl: './room-detail.page.html',
  styleUrls: ['./room-detail.page.scss'],
  imports: [
    AvatarComponent,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonButton,
    IonList, IonListHeader, IonItem, IonLabel, IonNote, IonBadge, IonSpinner, IonText,
  ],
})
export class RoomDetailPage {
  readonly roomId = input.required<string>();

  private readonly roomService = inject(RoomService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);

  protected readonly room = signal<Room | null>(null);
  protected readonly members = signal<RoomMember[]>([]);
  protected readonly candidates = signal<MemberProfile[] | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly myUid = computed(() => this.authService.user()?.uid ?? null);
  protected readonly isMember = computed(() => this.members().some((m) => m.user_id === this.myUid()));
  protected readonly isOwner = computed(() =>
    this.members().some((m) => m.user_id === this.myUid() && m.role === 'owner'),
  );

  constructor() {
    effect(() => {
      const id = this.roomId();
      untracked(() => void this.load(id));
    });
  }

  private async load(roomId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [room, members] = await Promise.all([
        this.roomService.getRoom(roomId),
        this.roomService.getMembers(roomId),
      ]);
      this.room.set(room);
      this.members.set(members);
      if (!room) this.error.set('La sala no existe o no tienes acceso.');
    } catch {
      this.error.set('No se pudo cargar la sala.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async join(): Promise<void> {
    await this.run(() => this.roomService.join(this.roomId()), 'Te uniste a la sala');
  }

  protected async leave(): Promise<void> {
    const ok = await this.run(() => this.roomService.leave(this.roomId()), 'Saliste de la sala');
    if (ok) await this.router.navigateByUrl('/rooms', { replaceUrl: true });
  }

  protected async showCandidates(): Promise<void> {
    const memberIds = new Set(this.members().map((m) => m.user_id));
    const all = await this.roomService.listProfiles();
    this.candidates.set(all.filter((p) => !memberIds.has(p.id)));
  }

  protected async add(userId: string): Promise<void> {
    const ok = await this.run(() => this.roomService.addMember(this.roomId(), userId), 'Miembro agregado');
    if (ok) this.candidates.set(null);
  }

  private async run(action: () => Promise<void>, successMessage: string): Promise<boolean> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
      await this.load(this.roomId());
      const t = await this.toast.create({ message: successMessage, duration: 1500, color: 'success' });
      await t.present();
      return true;
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Ocurrió un error.');
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
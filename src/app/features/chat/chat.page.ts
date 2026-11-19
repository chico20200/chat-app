import { Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ActionSheetController, AlertController, IonBackButton, IonButton, IonButtons, IonContent,
  IonFooter, IonHeader, IonIcon, IonSpinner, IonText, IonTextarea, IonTitle, IonToolbar, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { attach, informationCircleOutline, send } from 'ionicons/icons';
import { Message } from '../../core/models/message';
import { MemberProfile, Room, RoomMember } from '../../core/models/room';
import { AuthService } from '../../core/services/auth.service';
import { ChatService, MAX_TEXT_LENGTH } from '../../core/services/chat.service';
import { LocationService } from '../../core/services/location.service';
import { MediaService } from '../../core/services/media.service';
import { ProfileService } from '../../core/services/profile.service';
import { RealtimeService, RoomLiveState } from '../../core/services/realtime.service';
import { RoomService } from '../../core/services/room.service';
import { MAX_FILE_BYTES } from '../../core/utils/files';
import { MessageBubbleComponent } from '../../shared/components/message-bubble/message-bubble.component';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  imports: [
    RouterLink, MessageBubbleComponent,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonButton, IonIcon,
    IonContent, IonFooter, IonTextarea, IonSpinner, IonText,
  ],
})
export class ChatPage {
  readonly roomId = input.required<string>();

  private readonly roomService = inject(RoomService);
  private readonly chat = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly actionSheet = inject(ActionSheetController);
  private readonly alert = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly media = inject(MediaService);
  private readonly locationService = inject(LocationService);
  private readonly realtime = inject(RealtimeService);
  private readonly profileService = inject(ProfileService);
  private readonly content = viewChild(IonContent);
  private readonly imageInput = viewChild<ElementRef<HTMLInputElement>>('imageInput');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly room = signal<Room | null>(null);
  protected readonly members = signal<RoomMember[]>([]);
  protected readonly messages = signal<Message[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly uploading = signal(false);
  protected readonly locating = signal(false);
  private readonly live = signal<RoomLiveState | null>(null);
  protected readonly mediaUrls = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly maxLength = MAX_TEXT_LENGTH;

  protected readonly myUid = computed(() => this.authService.user()?.uid ?? null);
  protected readonly isMember = computed(() => this.members().some((m) => m.user_id === this.myUid()));
  protected readonly profiles = computed(
    () => new Map<string, MemberProfile | null>(this.members().map((m) => [m.user_id, m.profile])),
  );
  /** Otros miembros conectados ahora mismo a esta sala (sin contarme a mí). */
  protected readonly onlineOthers = computed(() => {
    const me = this.myUid();
    return (this.live()?.onlineIds() ?? []).filter((id) => id !== me);
  });
  protected readonly typingText = computed(() => {
    const names = this.live()?.typingNames() ?? [];
    if (names.length === 0) return '';
    if (names.length === 1) return `${names[0]} está escribiendo…`;
    return `${names.length} personas están escribiendo…`;
  });
  protected readonly subtitle = computed(() => {
    const room = this.room();
    if (!room || !this.isMember()) return '';
    const online = this.onlineOthers();
    if (room.type === 'direct') return online.length > 0 ? 'En línea' : '';
    return online.length > 0 ? `${online.length} en línea` : '';
  });

  protected readonly title = computed(() => {
    const room = this.room();
    if (!room) return 'Chat';
    if (room.type === 'group') return room.name ?? 'Sala';
    const other = this.members().find((m) => m.user_id !== this.myUid());
    return other?.profile?.display_name ?? 'Chat directo';
  });

  constructor() {
    addIcons({ attach, informationCircleOutline, send });

    // 1. Cargar la sala y sus miembros cada vez que cambia el roomId de la URL.
    effect(() => {
      const id = this.roomId();
      untracked(() => void this.loadRoom(id));
    });

    // 2. Escuchar los mensajes en tiempo real solo si soy miembro.
    //    onCleanup cancela la escucha anterior al cambiar de sala o al destruir la página.
    effect((onCleanup) => {
      const id = this.roomId();
      if (!this.isMember()) {
        untracked(() => this.messages.set([]));
        return;
      }
      const unsubscribe = this.chat.listen(
        id,
        (messages) => this.messages.set(messages),
        () => this.error.set('No se pudieron cargar los mensajes.'),
      );
      onCleanup(unsubscribe);
    });

    // 3. Unirse al canal en vivo de la sala (presencia + "escribiendo…") solo si soy miembro.
    effect((onCleanup) => {
      const id = this.roomId();
      const uid = this.myUid();
      if (!uid || !this.isMember()) return;
      const name = untracked(() => this.profileService.myProfile()?.display_name ?? 'Alguien');
      const live = this.realtime.connect(id, { userId: uid, name });
      untracked(() => this.live.set(live));
      onCleanup(() => {
        live.disconnect();
        this.live.set(null);
      });
    });

    // 4. Pedir URLs firmadas para las imágenes que todavía no tienen una.
    effect(() => {
      const images = this.messages().filter((m) => m.type === 'image' && !m.deleted && m.file);
      untracked(() => void this.resolveImageUrls(images));
    });

    // 5. Bajar al último mensaje cada vez que cambia la lista.
    effect(() => {
      this.messages();
      untracked(() => setTimeout(() => void this.content()?.scrollToBottom(200)));
    });
  }

  private async loadRoom(roomId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [room, members] = await Promise.all([
        this.roomService.getRoom(roomId),
        this.roomService.getMembers(roomId),
      ]);
      this.room.set(room);
      this.members.set(members);
    } catch {
      this.error.set('No se pudo cargar la sala.');
    } finally {
      this.loading.set(false);
    }
  }

  private async resolveImageUrls(images: Message[]): Promise<void> {
    const missing = images.filter((m) => !this.mediaUrls().has(m.file!.path));
    if (missing.length === 0) return;

    const entries = await Promise.all(
      missing.map(async (m) => {
        try {
          return [m.file!.path, await this.media.viewUrl(m.file!.path)] as const;
        } catch {
          return null;
        }
      }),
    );
    const next = new Map(this.mediaUrls());
    for (const entry of entries) if (entry) next.set(entry[0], entry[1]);
    this.mediaUrls.set(next);
  }

  protected urlFor(message: Message): string | null {
    return message.file ? (this.mediaUrls().get(message.file.path) ?? null) : null;
  }

  protected async attach(): Promise<void> {
    const sheet = await this.actionSheet.create({
      header: 'Adjuntar',
      buttons: [
        { text: 'Imagen', handler: () => this.imageInput()?.nativeElement.click() },
        { text: 'Archivo (PDF, Word, Excel…)', handler: () => this.fileInput()?.nativeElement.click() },
        { text: 'Mi ubicación actual', handler: () => void this.shareLocation() },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  protected async onFilePicked(event: Event, kind: 'image' | 'file'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (kind === 'file' && file.size > MAX_FILE_BYTES) {
      await this.showError(null, 'El archivo supera el límite de 10 MB.');
      return;
    }

    this.uploading.set(true);
    try {
      await this.chat.sendMedia(this.roomId(), kind, file);
    } catch (e) {
      await this.showError(e, 'No se pudo enviar el archivo.');
    } finally {
      this.uploading.set(false);
    }
  }

  private async shareLocation(): Promise<void> {
    if (this.locating()) return;
    this.locating.set(true);
    try {
      const location = await this.locationService.getCurrentPosition();
      await this.chat.sendLocation(this.roomId(), location);
    } catch (e) {
      await this.showError(e, 'No se pudo compartir tu ubicación.');
    } finally {
      this.locating.set(false);
    }
  }

  protected async openMedia(message: Message): Promise<void> {
    if (message.type === 'location' && message.location) {
      window.open(this.locationService.mapsUrl(message.location), '_blank');
      return;
    }
    if (!message.file) return;
    try {
      const url =
        message.type === 'image'
          ? await this.media.viewUrl(message.file.path)
          : await this.media.downloadUrl(message.file.path, message.file.name);
      window.open(url, '_blank');
    } catch (e) {
      await this.showError(e, 'No se pudo abrir el archivo.');
    }
  }

  protected showAuthor(index: number): boolean {
    const list = this.messages();
    return index === 0 || list[index - 1].authorId !== list[index].authorId;
  }

  protected onDraftInput(value: string): void {
    this.draft.set(value);
    if (value.trim()) this.live()?.notifyTyping();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  protected async send(): Promise<void> {
    const text = this.draft().trim();
    if (!text || this.sending()) return;
    this.sending.set(true);
    this.draft.set('');
    try {
      await this.chat.sendText(this.roomId(), text);
    } catch (e) {
      this.draft.set(text);
      await this.showError(e, 'No se pudo enviar el mensaje.');
    } finally {
      this.sending.set(false);
    }
  }

  protected async onSelect(message: Message): Promise<void> {
    const buttons = [
      ...(message.type === 'text' ? [{ text: 'Editar', handler: () => void this.edit(message) }] : []),
      { text: 'Eliminar', role: 'destructive', handler: () => void this.confirmDelete(message) },
      { text: 'Cancelar', role: 'cancel' },
    ];
    const sheet = await this.actionSheet.create({ header: 'Mensaje', buttons });
    await sheet.present();
  }

  private async edit(message: Message): Promise<void> {
    const dialog = await this.alert.create({
      header: 'Editar mensaje',
      inputs: [{ name: 'text', type: 'textarea', value: message.text, attributes: { maxlength: this.maxLength } }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', handler: (data: { text: string }) => void this.saveEdit(message, data.text) },
      ],
    });
    await dialog.present();
  }

  private async saveEdit(message: Message, text: string): Promise<void> {
    if (!text.trim() || text.trim() === message.text) return;
    try {
      await this.chat.editText(this.roomId(), message.id, text);
    } catch (e) {
      await this.showError(e, 'No se pudo editar el mensaje.');
    }
  }

  private async confirmDelete(message: Message): Promise<void> {
    const dialog = await this.alert.create({
      header: '¿Eliminar mensaje?',
      message: message.file
        ? 'Se mostrará como "Mensaje eliminado" para todos y el archivo se borrará.'
        : 'Se mostrará como "Mensaje eliminado" para todos.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => void this.chat.deleteMessage(message).catch((e) =>
            this.showError(e, 'No se pudo eliminar el mensaje.'),
          ),
        },
      ],
    });
    await dialog.present();
  }

  private async showError(error: unknown, fallback: string): Promise<void> {
    const message = error instanceof Error && error.message ? error.message : fallback;
    const t = await this.toast.create({ message, duration: 2500, color: 'danger' });
    await t.present();
  }
}

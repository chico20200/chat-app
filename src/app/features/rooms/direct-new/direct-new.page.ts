import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList,
  IonSearchbar, IonSpinner, IonText, IonTitle, IonToolbar,
} from '@ionic/angular';
import { MemberProfile } from '../../../core/models/room';
import { AuthService } from '../../../core/services/auth.service';
import { RoomService } from '../../../core/services/room.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-direct-new',
  templateUrl: './direct-new.page.html',
  styleUrls: ['./direct-new.page.scss'],
  imports: [
    AvatarComponent,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
    IonSearchbar, IonList, IonItem, IonLabel, IonSpinner, IonText,
  ],
})
export class DirectNewPage {
  private readonly roomService = inject(RoomService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly people = signal<MemberProfile[]>([]);
  protected readonly query = signal('');
  protected readonly loading = signal(true);
  protected readonly opening = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.people().filter((p) => p.display_name.toLowerCase().includes(q)) : this.people();
  });

  async ionViewWillEnter(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const myUid = this.authService.user()?.uid;
      const all = await this.roomService.listProfiles();
      this.people.set(all.filter((p) => p.id !== myUid));
    } catch {
      this.error.set('No se pudo cargar la lista de personas.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async open(person: MemberProfile): Promise<void> {
    if (this.opening()) return;
    this.opening.set(person.id);
    this.error.set(null);
    try {
      const roomId = await this.roomService.openDirect(person.id);
      await this.router.navigate(['/rooms', roomId], { replaceUrl: true });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo abrir el chat.');
    } finally {
      this.opening.set(null);
    }
  }
}

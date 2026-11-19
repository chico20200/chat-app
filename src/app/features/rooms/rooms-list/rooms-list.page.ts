import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon,
  IonItem, IonLabel, IonList, IonSegment, IonSegmentButton, IonSpinner, IonText, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, personAdd } from 'ionicons/icons';
import { RoomListItem } from '../../../core/models/room';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { RoomService } from '../../../core/services/room.service';

type Tab = 'mine' | 'explore';

@Component({
  selector: 'app-rooms-list',
  templateUrl: './rooms-list.page.html',
  styleUrls: ['./rooms-list.page.scss'],
  imports: [
    RouterLink, AvatarComponent,
    IonHeader, IonToolbar, IonButtons, IonButton, IonBackButton, IonTitle, IonContent,
    IonSegment, IonSegmentButton, IonLabel, IonList, IonItem, IonBadge,
    IonFab, IonFabButton, IonIcon, IonSpinner, IonText,
  ],
})
export class RoomsListPage {
  protected readonly roomService = inject(RoomService);

  protected readonly tab = signal<Tab>('mine');
  protected readonly publicRooms = signal<RoomListItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    addIcons({ add, personAdd });
  }

  ionViewWillEnter(): void {
    void this.refresh();
  }

  protected onTabChange(value: unknown): void {
    if (value === 'mine' || value === 'explore') this.tab.set(value);
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.roomService.loadMyRooms();
      this.publicRooms.set(await this.roomService.loadPublicRoomsNotJoined());
    } catch {
      this.error.set('No se pudieron cargar las salas.');
    } finally {
      this.loading.set(false);
    }
  }
}
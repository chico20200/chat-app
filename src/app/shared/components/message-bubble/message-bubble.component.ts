import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { documentOutline, locationOutline } from 'ionicons/icons';
import { Message } from '../../../core/models/message';
import { MemberProfile } from '../../../core/models/room';
import { formatBytes } from '../../../core/utils/files';
import { AvatarComponent } from '../avatar/avatar.component';
import { LocationMapComponent } from '../location-map/location-map.component';

@Component({
  selector: 'app-message-bubble',
  imports: [DatePipe, AvatarComponent, LocationMapComponent, IonIcon],
  template: `
    <div class="row" [class.mine]="mine()">
      @if (!mine()) {
        <div class="avatar-slot">
          @if (showAuthor()) {
            <app-avatar [src]="author()?.avatar_url ?? null" [name]="author()?.display_name ?? '?'" [size]="32" />
          }
        </div>
      }
      <div
        class="bubble"
        [class.deleted]="message().deleted"
        [class.clickable]="mine() && !message().deleted"
        (click)="onSelect()"
      >
        @if (!mine() && showAuthor()) {
          <div class="author">{{ author()?.display_name ?? 'Usuario' }}</div>
        }

        @if (message().deleted) {
          <em>Mensaje eliminado</em>
        } @else {
          @switch (message().type) {
            @case ('image') {
              @if (mediaUrl(); as url) {
                <img class="photo" [src]="url" [alt]="message().file?.name ?? 'Imagen'" (click)="onOpen($event)" />
              } @else {
                <div class="photo placeholder">Cargando imagen…</div>
              }
            }
            @case ('file') {
              <button type="button" class="file" (click)="onOpen($event)">
                <ion-icon name="document-outline"></ion-icon>
                <span class="file-info">
                  <span class="file-name">{{ message().file?.name }}</span>
                  <span class="file-size">{{ size() }}</span>
                </span>
              </button>
            }
            @case ('location') {
              @if (message().location; as loc) {
                <div class="location" (click)="onOpen($event)">
                  <app-location-map [lat]="loc.lat" [lng]="loc.lng" />
                  <span class="location-label">
                    <ion-icon name="location-outline"></ion-icon>
                    Ubicación · ±{{ loc.accuracy }} m
                  </span>
                </div>
              }
            }
            @default {
              <span class="text">{{ message().text }}</span>
            }
          }
        }

        <div class="meta">
          @if (message().editedAt && !message().deleted) { editado · }
          {{ message().createdAt | date: 'HH:mm' }}
          @if (message().pending) { · enviando… }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .row { display: flex; align-items: flex-end; gap: 8px; margin: 2px 0; }
    .row.mine { justify-content: flex-end; }
    .avatar-slot { width: 32px; flex: 0 0 32px; }
    .bubble {
      max-width: 75%;
      padding: 8px 12px;
      border-radius: 16px;
      background: var(--ion-color-step-150, #e9e9eb);
      color: var(--ion-text-color);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .mine .bubble { background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); }
    .bubble.deleted { opacity: 0.6; }
    .bubble.clickable { cursor: pointer; }
    .author { font-size: 12px; font-weight: 600; margin-bottom: 2px; color: var(--ion-color-primary); }
    .meta { font-size: 11px; opacity: 0.7; text-align: right; margin-top: 2px; }
    .photo { display: block; max-width: 240px; max-height: 320px; border-radius: 10px; cursor: zoom-in; }
    .photo.placeholder {
      width: 200px; height: 140px; display: flex; align-items: center; justify-content: center;
      font-size: 12px; opacity: 0.7; background: rgba(0, 0, 0, 0.08); cursor: default;
    }
    .file {
      display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 0; border-radius: 10px;
      background: rgba(0, 0, 0, 0.08); color: inherit; font: inherit; text-align: left; cursor: pointer;
    }
    .file ion-icon { font-size: 28px; flex: 0 0 auto; }
    .location { cursor: pointer; }
    .location-label { display: flex; align-items: center; gap: 4px; font-size: 12px; margin-top: 4px; }
    .file-info { display: flex; flex-direction: column; min-width: 0; }
    .file-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
    .file-size { font-size: 11px; opacity: 0.8; }
  `,
})
export class MessageBubbleComponent {
  readonly message = input.required<Message>();
  readonly mine = input(false);
  readonly author = input<MemberProfile | null>(null);
  readonly showAuthor = input(true);
  /** URL firmada de la imagen; la resuelve la página (este componente no habla con el backend). */
  readonly mediaUrl = input<string | null>(null);

  readonly selected = output<Message>();
  readonly openMedia = output<Message>();

  constructor() {
    addIcons({ documentOutline, locationOutline });
  }

  protected size(): string {
    return formatBytes(this.message().file?.size ?? 0);
  }

  protected onSelect(): void {
    if (this.mine() && !this.message().deleted) this.selected.emit(this.message());
  }

  protected onOpen(event: Event): void {
    event.stopPropagation();
    this.openMedia.emit(this.message());
  }
}

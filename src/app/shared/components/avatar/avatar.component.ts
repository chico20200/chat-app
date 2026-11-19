import { Component, computed, input } from '@angular/core';
import { IonAvatar } from '@ionic/angular';

@Component({
  selector: 'app-avatar',
  imports: [IonAvatar],
  template: `
    <ion-avatar [style.width.px]="size()" [style.height.px]="size()">
      @if (src()) {
        <img [src]="src()" [alt]="'Foto de ' + name()" />
      } @else {
        <div class="initials" [style.font-size.px]="size() * 0.4">{{ initials() }}</div>
      }
    </ion-avatar>
  `,
  styles: `
    :host { display: inline-block; }
    .initials {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--ion-color-primary);
      color: var(--ion-color-primary-contrast);
      font-weight: 600;
    }
  `,
})
export class AvatarComponent {
  readonly src = input<string | null>(null);
  readonly name = input('');
  readonly size = input(48);

  protected readonly initials = computed(() => {
    const letters = this.name()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('');
    return letters || '?';
  });
}
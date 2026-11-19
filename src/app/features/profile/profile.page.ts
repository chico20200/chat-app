import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonSpinner,
  IonText, IonTextarea, IonTitle, IonToolbar, ToastController,
} from '@ionic/angular';
import { ProfileService } from '../../core/services/profile.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';   // NUEVO
@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [
    ReactiveFormsModule,AvatarComponent,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
    IonInput, IonTextarea, IonButton, IonText, IonSpinner,
  ],
})
export class ProfilePage {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastController);
  protected readonly profileService = inject(ProfileService);

  readonly form = this.fb.nonNullable.group({
    display_name: ['', [Validators.required, Validators.maxLength(40)]],
    bio: ['', [Validators.maxLength(160)]],
  });
  readonly uploading = signal(false);                                                 // NUEVO (junto a saving)
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const profile = this.profileService.myProfile();
      if (profile && !this.form.dirty) {
        this.form.setValue({ display_name: profile.display_name, bio: profile.bio });
      }
    });
  }

    async onFileSelected(event: Event): Promise<void> {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        this.error.set('Elige un archivo de imagen.');
        return;
      }

      this.uploading.set(true);
      this.error.set(null);
      try {
        await this.profileService.uploadAvatar(file);
        const t = await this.toast.create({ message: 'Foto actualizada', duration: 1500, color: 'success' });
        await t.present();
      } catch {
        this.error.set('No se pudo subir la foto. Intenta de nuevo.');
      } finally {
        this.uploading.set(false);
      }
    }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const { display_name, bio } = this.form.getRawValue();
      await this.profileService.saveMine({ display_name: display_name.trim(), bio: bio.trim() });
      this.form.markAsPristine();
      const t = await this.toast.create({ message: 'Perfil guardado', duration: 1500, color: 'success' });
      await t.present();
    } catch {
      this.error.set('No se pudo guardar el perfil. Intenta de nuevo.');
    } finally {
      this.saving.set(false);
    }
  }
}
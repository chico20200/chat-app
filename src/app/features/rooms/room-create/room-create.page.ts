import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonSpinner,
  IonText, IonTextarea, IonTitle, IonToggle, IonToolbar,
} from '@ionic/angular';
import { RoomService } from '../../../core/services/room.service';

@Component({
  selector: 'app-room-create',
  templateUrl: './room-create.page.html',
  styleUrls: ['./room-create.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
    IonInput, IonTextarea, IonToggle, IonButton, IonSpinner, IonText,
  ],
})
export class RoomCreatePage {
  private readonly fb = inject(FormBuilder);
  private readonly roomService = inject(RoomService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(50)]],
    description: ['', [Validators.maxLength(200)]],
    isPrivate: [false],
  });

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, description, isPrivate } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    try {
      const roomId = await this.roomService.createRoom(name.trim(), description.trim(), isPrivate);
      await this.router.navigate(['/rooms', roomId], { replaceUrl: true });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo crear la sala.');
    } finally {
      this.saving.set(false);
    }
  }
}
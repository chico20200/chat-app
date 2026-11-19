import { Component, inject,signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { AuthService } from '../core/services/auth.service';
import { ProfileService } from '../core/services/profile.service';         // NUEVO
import { AvatarComponent } from '../shared/components/avatar/avatar.component';   // NUEVO

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [RouterLink,AvatarComponent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent],
})
export class HomePage {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly profileService = inject(ProfileService);              // NUEVO

  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
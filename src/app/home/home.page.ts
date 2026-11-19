import { Component, inject,signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { AuthService } from '../core/services/auth.service';
import { ProfileService } from '../core/services/profile.service';         // NUEVO
import { AvatarComponent } from '../shared/components/avatar/avatar.component';   // NUEVO
import { SupabaseService } from '../core/services/supabase.service';         // PRUEBA
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
  private readonly supabase = inject(SupabaseService).client;                 // PRUEBA
  protected readonly result = signal('');                                     // PRUEBA (importa signal de @angular/core)

   async callRooms(body: object): Promise<void> {                              // PRUEBA
    const { data, error } = await this.supabase.functions.invoke('rooms', { body });
    const detail = error ? await (error as { context?: Response }).context?.json?.() : data;
    this.result.set(JSON.stringify(detail ?? error, null, 2));
  }
  
  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
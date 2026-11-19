import { Component, inject,signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { AuthService } from '../core/services/auth.service';
import { SupabaseService } from '../core/services/supabase.service';  

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent],
})
export class HomePage {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly supabase = inject(SupabaseService).client;                  // PRUEBA
  protected readonly claims = signal<string>(''); 

  async whoami(): Promise<void> {                                              // PRUEBA
    const { data, error } = await this.supabase.rpc('whoami');
    this.claims.set(JSON.stringify(error ?? data, null, 2));
  }
  
  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
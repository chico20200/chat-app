import { Injectable, inject } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { FirebaseService } from './firebase.service';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly auth = inject(FirebaseService).auth;
  private roleClaimInFlight: Promise<void> | null = null;

  readonly client: SupabaseClient = createClient(
    environment.supabase.url,
    environment.supabase.publishableKey,
    { accessToken: () => this.getToken() },
  );

  private async getToken(): Promise<string | null> {
    const user = this.auth.currentUser;
    if (!user) return null;

    const result = await user.getIdTokenResult();
    if (result.claims['role'] === 'authenticated') {
      return result.token;
    }

    await this.ensureRoleClaim(result.token);
    return user.getIdToken(true);
  }

  private ensureRoleClaim(token: string): Promise<void> {
    this.roleClaimInFlight ??= this.callSetRoleClaim(token).finally(() => {
      this.roleClaimInFlight = null;
    });
    return this.roleClaimInFlight;
  }

  private async callSetRoleClaim(token: string): Promise<void> {
    const response = await fetch(`${environment.supabase.url}/functions/v1/set-role-claim`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: environment.supabase.publishableKey,
      },
    });
    if (!response.ok) {
      throw new Error(`set-role-claim falló (${response.status}): ${await response.text()}`);
    }
  }
}
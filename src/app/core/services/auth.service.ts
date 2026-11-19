import { Injectable, computed, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';                                  // NUEVO
import {
  GoogleAuthProvider,                                                         // NUEVO
  User,
  createUserWithEmailAndPassword,                                             // NUEVO
  onAuthStateChanged,
  sendPasswordResetEmail,                                                     // NUEVO
  signInWithEmailAndPassword,                                                 // NUEVO
  signInWithPopup,                                                            // NUEVO
  signOut,                                                                    // NUEVO
  updateProfile,                                                              // NUEVO
} from 'firebase/auth';
import { FirebaseService } from './firebase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(FirebaseService).auth;

  private readonly currentUser = signal<User | null>(null);
  readonly user = this.currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  constructor() {
    onAuthStateChanged(this.auth, (user) => this.currentUser.set(user));
  }

  async whenReady(): Promise<User | null> {
    await this.auth.authStateReady();
    return this.auth.currentUser;
  }

  // ---------- NUEVO ----------
  async register(name: string, email: string, password: string): Promise<void> {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    await updateProfile(credential.user, { displayName: name });
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async loginWithGoogle(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      throw new Error('google-native-not-ready');
    }
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  resetPassword(email: string): Promise<void> {
    return sendPasswordResetEmail(this.auth, email);
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }
}
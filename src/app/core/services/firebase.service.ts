import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly app: FirebaseApp = initializeApp(environment.firebase);

  readonly auth: Auth = Capacitor.isNativePlatform()
    ? initializeAuth(this.app, { persistence: indexedDBLocalPersistence })
    : getAuth(this.app);

  readonly db: Firestore = getFirestore(this.app);
}
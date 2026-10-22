import { Injectable, signal } from '@angular/core';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { environment } from '../../environments/environment';

/**
 * Servicio centralizado para la inicialización y acceso a Firebase (Firestore y Auth).
 * Expone Signals reactivos para el estado del usuario autenticado.
 */
@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  /** Instancia principal de la aplicación de Firebase */
  public readonly app: FirebaseApp;

  /** Instancia de Firestore Database */
  public readonly db: Firestore;

  /** Instancia del servicio de Autenticación de Firebase */
  public readonly auth: Auth;

  /** Signal que contiene el usuario autenticado actual o null si no hay sesión */
  public readonly currentUser = signal<FirebaseUser | null>(null);

  /** Signal que indica si el estado de autenticación ya fue verificado inicialmente */
  public readonly authInitialized = signal<boolean>(false);

  constructor() {
    this.app = getApps().length ? getApp() : initializeApp(environment.firebase);
    this.db = getFirestore(this.app);
    this.auth = getAuth(this.app);

    // Escuchar cambios de sesión de Firebase y actualizar el Signal
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser.set(user);
      this.authInitialized.set(true);
    });
  }
}

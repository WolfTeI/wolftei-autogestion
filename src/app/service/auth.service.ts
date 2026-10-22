import { Injectable, inject, signal } from '@angular/core';
import { Observable, from } from 'rxjs';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  updatePassword, 
  EmailAuthProvider, 
  reauthenticateWithCredential,
  User as FirebaseUser
} from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { FirebaseService } from './firebase.service';

export interface User {
  username: string;
  email?: string;
  uid?: string;
}

export interface AuthResponse {
  message: string;
  token?: string;
  user?: User;
  error?: string;
}

/**
 * Servicio de Autenticación integrado directamente con Firebase Auth y filtrado RBAC por colección Firestore.
 * Provee estado reactivo mediante Signals y compatibilidad con guards y componentes existentes.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private firebaseService = inject(FirebaseService);

  private readonly USER_KEY = 'wolftei_user';
  private readonly TOKEN_KEY = 'wolftei_token';
  private readonly USERS_COLLECTION = 'usuarios';

  /** Signal reactivo con el usuario actual */
  public currentUser = signal<User | null>(this.getStoredUser());

  /** Signal reactivo que indica si hay sesión activa */
  public isAuthenticated = signal<boolean>(!!this.getStoredUser());

  constructor() {
    // Sincronizar el estado de sesión si Firebase Auth detecta cambio de usuario
    if (this.firebaseService.auth) {
      this.firebaseService.auth.onAuthStateChanged(async (fbUser) => {
        if (fbUser) {
          try {
            const token = await fbUser.getIdToken();
            const colRef = collection(this.firebaseService.db, this.USERS_COLLECTION);
            const q = query(colRef, where('email', '==', fbUser.email));
            const snap = await getDocs(q);

            if (snap.empty) {
              await this.logout();
              return;
            }

            const userData = snap.docs[0].data();
            const user: User = {
              username: userData['username'] || fbUser.displayName || 'wolftei',
              email: fbUser.email || undefined,
              uid: fbUser.uid,
            };
            this.setSession(user, token);
          } catch (err) {
            console.warn('Error verificando usuario en onAuthStateChanged:', err);
          }
        } else if (!this.getStoredUser()) {
          this.clearSession();
        }
      });
    }
  }

  /**
   * Inicia sesión directamente en Firebase Authentication y valida pertenencia a la colección 'usuarios'.
   * Admite tanto email como nombre de usuario (wolftei -> info@wolftei.com.ar).
   */
  login(credentials: {
    username: string;
    password: string;
  }): Observable<AuthResponse> {
    return from(this.executeFirebaseLogin(credentials));
  }

  private async executeFirebaseLogin(credentials: {
    username: string;
    password: string;
  }): Promise<AuthResponse> {
    const rawUsername = credentials.username.trim();
    // Resolver email: si ya tiene '@' usarlo; si es 'wolftei' o similar mapear al dominio oficial
    let email = rawUsername;
    if (!rawUsername.includes('@')) {
      if (rawUsername.toLowerCase() === 'wolftei') {
        email = 'info@wolftei.com.ar';
      } else {
        email = `${rawUsername}@wolftei.com.ar`;
      }
    }
    const password = credentials.password;

    try {
      // 1. Validar credenciales criptográficas en Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        this.firebaseService.auth,
        email,
        password
      );

      const fbUser = userCredential.user;

      // 2. Control de Acceso (RBAC / Whitelist): verificar que el usuario esté autorizado en Firestore
      const colRef = collection(this.firebaseService.db, this.USERS_COLLECTION);
      const qEmail = query(colRef, where('email', '==', fbUser.email));
      let snap = await getDocs(qEmail);

      // Si no coincide por email, verificar por username
      if (snap.empty) {
        const qUsername = query(colRef, where('username', '==', rawUsername));
        snap = await getDocs(qUsername);
      }

      if (snap.empty) {
        await signOut(this.firebaseService.auth);
        throw {
          code: 'auth/user-not-authorized',
          message: 'Acceso denegado: el usuario no se encuentra dado de alta en la colección de usuarios autorizados.',
        };
      }

      const userData = snap.docs[0].data();
      const token = await fbUser.getIdToken();
      const user: User = {
        username: userData['username'] || rawUsername,
        email: fbUser.email || email,
        uid: fbUser.uid,
      };

      this.setSession(user, token);

      return {
        message: 'Login exitoso',
        token,
        user,
      };
    } catch (error: any) {
      console.warn('Error en autenticación Firebase:', error);
      let errorMsg = 'Error al iniciar sesión.';
      if (error.code === 'auth/configuration-not-found') {
        errorMsg = 'El método de autenticación Correo/Contraseña no está habilitado en Firebase Console.';
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMsg = 'Usuario o contraseña incorrectos.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMsg = 'Error de conexión con los servidores de Firebase.';
      } else if (error.code === 'auth/user-not-authorized' || error.message) {
        errorMsg = error.message;
      }

      throw {
        status: error.code === 'auth/user-not-authorized' ? 403 : 401,
        error: { error: errorMsg },
      };
    }
  }

  /**
   * Actualiza la contraseña del usuario en Firebase Auth.
   */
  changePassword(data: {
    oldPassword: string;
    newPassword: string;
  }): Observable<any> {
    return from(this.executeChangePassword(data));
  }

  private async executeChangePassword(data: {
    oldPassword: string;
    newPassword: string;
  }): Promise<any> {
    const currentUser = this.firebaseService.auth.currentUser;
    if (!currentUser || !currentUser.email) {
      throw { error: { error: 'No hay usuario autenticado en Firebase' } };
    }

    try {
      // Re-autenticar al usuario antes de actualizar la contraseña (requerimiento de Firebase)
      const credential = EmailAuthProvider.credential(currentUser.email, data.oldPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, data.newPassword);

      return { message: 'Contraseña actualizada correctamente en Firebase' };
    } catch (error: any) {
      console.error('Error al cambiar contraseña:', error);
      throw {
        error: {
          error: error.message || 'Error al actualizar contraseña en Firebase',
        },
      };
    }
  }

  /**
   * Cierra la sesión en Firebase y limpia el almacenamiento local.
   */
  async logout(): Promise<void> {
    try {
      await signOut(this.firebaseService.auth);
    } catch (e) {
      console.warn('Error cerrando sesión en Firebase:', e);
    } finally {
      this.clearSession();
    }
  }

  /**
   * Obtiene las cabeceras con el token actual si se requiere para APIs REST externas.
   */
  getAuthHeaders(): { [header: string]: string } {
    const token = localStorage.getItem(this.TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  getUser(): User | null {
    return this.currentUser();
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }

  private setSession(user: User, token: string): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    localStorage.setItem(this.TOKEN_KEY, token);
    this.currentUser.set(user);
    this.isAuthenticated.set(true);
  }

  private clearSession(): void {
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }

  private getStoredUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';

export type PlataformaApp = 'google_play' | 'microsoft_store' | 'web_app' | 'otra';
export type ModeloMonetizacion = 'gratis' | 'pago' | 'suscripcion' | 'freemium' | 'anuncios';
export type EstadoApp = 'publicada' | 'en_revision' | 'borrador' | 'descontinuada';

export interface AppStoreItem {
  id?: string;
  nombre: string;
  plataforma: PlataformaApp;
  paqueteId?: string;
  urlTienda?: string;
  version?: string;
  modeloMonetizacion: ModeloMonetizacion;
  precio: number;
  currency: 'USD' | 'ARS';
  descargasTotales: number;
  usuariosActivosMes: number;
  calificacionPromedio: number;
  totalResenas: number;
  ingresoMensualEstimado: number;
  monedaIngreso: 'USD' | 'ARS';
  estado: EstadoApp;
  fechaLanzamiento?: string;
  ultimaActualizacion?: string;
  notasEstrategicas?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AppsStoresService {
  private firebaseService = inject(FirebaseService);
  private readonly COLLECTION_NAME = 'apps_stores';

  /**
   * Escucha la lista de aplicaciones publicadas en tiendas ordenada cronológicamente.
   */
  listenApps(): Observable<AppStoreItem[]> {
    return new Observable<AppStoreItem[]>((observer) => {
      const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
      const q = query(colRef, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<AppStoreItem, 'id'>),
          }));
          observer.next(items);
        },
        (error) => {
          console.warn('Fallback sin orden en listenApps:', error);
          const unsubsFallback = onSnapshot(
            colRef,
            (snapFallback) => {
              const items = snapFallback.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<AppStoreItem, 'id'>),
              }));
              observer.next(items);
            },
            (err) => observer.error(err)
          );
          return () => unsubsFallback();
        }
      );

      return () => unsubscribe();
    });
  }

  /**
   * Registra una nueva aplicación en el catálogo de tiendas.
   */
  crearApp(app: Omit<AppStoreItem, 'id'>): Observable<string> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    const data: Omit<AppStoreItem, 'id'> = {
      ...app,
      createdAt: app.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return from(addDoc(colRef, data).then((docRef) => docRef.id));
  }

  /**
   * Actualiza las métricas o datos de una aplicación.
   */
  actualizarApp(id: string, app: Partial<AppStoreItem>): Observable<void> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    const data = {
      ...app,
      updatedAt: new Date().toISOString(),
    };
    return from(updateDoc(docRef, data));
  }

  /**
   * Elimina una aplicación del catálogo.
   */
  eliminarApp(id: string): Observable<void> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    return from(deleteDoc(docRef));
  }
}

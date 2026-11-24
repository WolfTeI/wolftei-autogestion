import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';

export type CategoriaGasto =
  | 'infraestructura'
  | 'licencias_software'
  | 'equipamiento_hardware'
  | 'servicios_profesionales'
  | 'impuestos'
  | 'marketing'
  | 'viaticos'
  | 'otro';

export type TipoDestinoGasto = 'gasto_operativo' | 'inversion';

export interface Gasto {
  id?: string;
  fecha: string;
  concepto: string;
  monto: number;
  currency: 'ARS' | 'USD';
  tipoCambio?: number;
  categoria: CategoriaGasto;
  tipoDestino: TipoDestinoGasto; // Gasto operativo (OPEX) vs Inversión de capital (CAPEX)
  metodoPago: 'tarjeta' | 'transferencia' | 'efectivo' | 'usdt' | 'mercadopago';
  comprobanteRef?: string;
  proyectoId?: string | null;
  proyectoTitulo?: string | null;
  notas?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root',
})
export class GastosService {
  private firebaseService = inject(FirebaseService);
  private readonly COLLECTION_NAME = 'expenses';

  /**
   * Registra un nuevo gasto o inversión de capital en Firestore.
   */
  registrar(gasto: Gasto): Observable<{ id: string; gasto: Gasto }> {
    return from(this.addGasto(gasto));
  }

  private async addGasto(gasto: Gasto): Promise<{ id: string; gasto: Gasto }> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    const now = new Date().toISOString();

    const payload = {
      fecha: gasto.fecha || now.split('T')[0],
      concepto: gasto.concepto.trim(),
      monto: Number(gasto.monto) || 0,
      currency: gasto.currency || 'USD',
      tipoCambio: Number(gasto.tipoCambio) || 1,
      categoria: gasto.categoria || 'otro',
      tipoDestino: gasto.tipoDestino || 'gasto_operativo',
      metodoPago: gasto.metodoPago || 'transferencia',
      comprobanteRef: gasto.comprobanteRef?.trim() || '',
      proyectoId: gasto.proyectoId || null,
      proyectoTitulo: gasto.proyectoTitulo || null,
      notas: gasto.notas?.trim() || '',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(colRef, payload);
    return {
      id: docRef.id,
      gasto: { id: docRef.id, ...payload },
    };
  }

  /**
   * Escucha todos los gastos y compras en tiempo real.
   */
  listenGastos(): Observable<Gasto[]> {
    return new Observable<Gasto[]>((observer) => {
      const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
      const q = query(colRef, orderBy('fecha', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Gasto, 'id'>),
          }));
          observer.next(items);
        },
        (error) => {
          console.warn('Fallback sin orden en listenGastos:', error);
          const unsubsFallback = onSnapshot(
            colRef,
            (snapFallback) => {
              const items = snapFallback.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<Gasto, 'id'>),
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
   * Elimina un registro de gasto por su ID.
   */
  eliminar(id: string): Observable<void> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    return from(deleteDoc(docRef));
  }
}

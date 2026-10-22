import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';

export interface Pago {
  id?: string;
  propuestaId?: string | null;
  clientId?: string | null;
  amount: number;
  currency: 'ARS' | 'USD';
  exchangeRate?: number;
  concept: 'anticipo' | 'saldo' | 'total' | 'cuota' | 'otro';
  paymentMethod: 'transferencia' | 'usdt' | 'efectivo' | 'mercadopago';
  receiptNumber?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Servicio de cobranzas y pagos conectado directamente a Firestore ('payments').
 */
@Injectable({
  providedIn: 'root',
})
export class PagosService {
  private firebaseService = inject(FirebaseService);
  private readonly COLLECTION_NAME = 'payments';

  /**
   * Genera un número de recibo secuencial único.
   */
  private generarNumeroRecibo(): string {
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const random = Math.floor(100 + Math.random() * 900);
    return `REC-${dateStr}-${random}`;
  }

  /**
   * Registra un nuevo cobro en Firestore.
   */
  registrar(pago: Pago): Observable<{ id: string; message: string; pago: Pago }> {
    return from(this.addPago(pago));
  }

  private async addPago(pago: Pago): Promise<{ id: string; message: string; pago: Pago }> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    const now = new Date().toISOString();
    const receiptNumber = pago.receiptNumber || this.generarNumeroRecibo();

    const payload = {
      propuestaId: pago.propuestaId || null,
      clientId: pago.clientId || null,
      amount: Number(pago.amount) || 0,
      currency: pago.currency || 'USD',
      exchangeRate: pago.exchangeRate || 1,
      concept: pago.concept || 'anticipo',
      paymentMethod: pago.paymentMethod || 'transferencia',
      receiptNumber,
      notes: pago.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(colRef, payload);
    const nuevoPago: Pago = { id: docRef.id, ...payload };

    return {
      id: docRef.id,
      message: 'Cobro registrado exitosamente',
      pago: nuevoPago,
    };
  }

  /**
   * Obtiene los pagos vinculados a una propuesta.
   */
  listarPorPropuesta(propuestaId: string): Observable<Pago[]> {
    return from(this.fetchPagosByField('propuestaId', propuestaId));
  }

  /**
   * Obtiene los pagos vinculados a un cliente.
   */
  listarPorCliente(clientId: string): Observable<Pago[]> {
    return from(this.fetchPagosByField('clientId', clientId));
  }

  private async fetchPagosByField(field: 'propuestaId' | 'clientId', value: string): Promise<Pago[]> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    let snapshot;
    try {
      const q = query(colRef, where(field, '==', value), orderBy('createdAt', 'desc'));
      snapshot = await getDocs(q);
    } catch {
      const q = query(colRef, where(field, '==', value));
      snapshot = await getDocs(q);
    }

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Pago, 'id'>),
    }));
  }

  /**
   * Elimina un registro de cobro por su ID.
   */
  eliminar(id: string): Observable<any> {
    return from(this.deletePagoById(id));
  }

  private async deletePagoById(id: string): Promise<any> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    await deleteDoc(docRef);
    return { message: 'Cobro eliminado exitosamente' };
  }
}

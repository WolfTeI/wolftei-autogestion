import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';

export interface Cliente {
  id?: string;
  name: string;
  taxId?: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
  notes?: string;
  reputationScore?: number;
  reviewsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Servicio para gestión del CRM y directorio de Clientes conectado directamente con Firestore.
 */
@Injectable({
  providedIn: 'root',
})
export class ClientesService {
  private firebaseService = inject(FirebaseService);
  private readonly COLLECTION_NAME = 'clients';

  /**
   * Escucha la lista completa de clientes en tiempo real.
   */
  listenClientes(): Observable<Cliente[]> {
    return new Observable<Cliente[]>((observer) => {
      const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
      const q = query(colRef, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const clientes = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Cliente, 'id'>),
          }));
          observer.next(clientes);
        },
        (error) => {
          console.warn('Fallback sin orden en listenClientes:', error);
          const unsubsFallback = onSnapshot(
            colRef,
            (snapFallback) => {
              const items = snapFallback.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<Cliente, 'id'>),
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
   * Obtiene la lista completa de clientes desde Firestore.
   */
  getClientes(): Observable<Cliente[]> {
    return from(this.fetchClientes());
  }

  private async fetchClientes(): Promise<Cliente[]> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    let snapshot;
    try {
      const q = query(colRef, orderBy('createdAt', 'desc'));
      snapshot = await getDocs(q);
    } catch {
      snapshot = await getDocs(colRef);
    }

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Cliente, 'id'>),
    }));
  }

  /**
   * Obtiene los datos de un cliente por su ID.
   */
  getCliente(id: string): Observable<Cliente> {
    return from(this.fetchClienteById(id));
  }

  private async fetchClienteById(id: string): Promise<Cliente> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Cliente no encontrado');
    }

    return {
      id: docSnap.id,
      ...(docSnap.data() as Omit<Cliente, 'id'>),
    };
  }

  /**
   * Registra un nuevo cliente en Firestore.
   */
  crearCliente(cliente: Cliente): Observable<any> {
    return from(this.addCliente(cliente));
  }

  private async addCliente(cliente: Cliente): Promise<any> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    const payload = {
      name: cliente.name,
      taxId: cliente.taxId || null,
      email: cliente.email,
      phone: cliente.phone || null,
      company: cliente.company || null,
      address: cliente.address || null,
      notes: cliente.notes || null,
      reputationScore: cliente.reputationScore ?? 0,
      reviewsCount: cliente.reviewsCount ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(colRef, payload);
    return {
      id: docRef.id,
      message: 'Cliente creado exitosamente',
      cliente: { id: docRef.id, ...payload },
    };
  }

  /**
   * Actualiza los datos de un cliente existente.
   */
  actualizarCliente(id: string, cliente: Partial<Cliente>): Observable<any> {
    return from(this.updateClienteById(id, cliente));
  }

  private async updateClienteById(id: string, cliente: Partial<Cliente>): Promise<any> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    const { id: _, ...datosActualizados } = cliente as any;
    const payload = {
      ...datosActualizados,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(docRef, payload);
    return { message: 'Cliente actualizado exitosamente' };
  }

  /**
   * Elimina un cliente de Firestore por su ID.
   */
  eliminarCliente(id: string): Observable<any> {
    return from(this.deleteClienteById(id));
  }

  private async deleteClienteById(id: string): Promise<any> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    await deleteDoc(docRef);
    return { message: 'Cliente eliminado exitosamente' };
  }
}

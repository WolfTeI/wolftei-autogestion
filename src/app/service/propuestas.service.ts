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
  where,
  limit,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';

/** Módulo del alcance funcional de la propuesta */
export interface Modulo {
  name: string;
  description: string;
}

/** Fase del cronograma de trabajo */
export interface Fase {
  label: string;
  weeks: string;
}

/** Ítem de infraestructura */
export interface InfraItem {
  name: string;
  price: number;
  currency: 'ARS' | 'USD';
}

export interface PricingDetails {
  baseRate: number;
  devHours: number;
  pmMarginPercent: number;
  riskMarginPercent: number;
  investigationMarginPercent: number;
  infrastructureCost: number;
}

/** Estructura completa de una Propuesta */
export interface Propuesta {
  id?: string;
  token?: string;
  clientId?: string;
  title: string;
  clientPreviewName: string;
  clientPreviewEmail?: string;
  objective: string;
  modules: Modulo[];
  techStack: string;
  platform: string;
  persistence: string;
  phases: Fase[];
  totalAmount: number;
  currency: 'ARS' | 'USD';
  paymentTerms: string;
  validDays: number;
  warrantyDays: number;
  notes?: string;
  discountPercent?: number;
  infrastructureItems?: InfraItem[];
  pricingDetails?: PricingDetails;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  viewedAt?: string;
  expiresAt?: string;
  // Datos que se completan al aceptar
  acceptedAt?: string;
  clientLegalName?: string;
  clientTaxId?: string;
  clientAddress?: string;
  clientEmail?: string;
}

/** Payload para aceptar una propuesta */
export interface AceptacionCliente {
  clientLegalName: string;
  clientTaxId: string;
  clientAddress: string;
  clientEmail: string;
}

/**
 * Servicio de gestión comercial y propuestas conectada directamente con Firestore ('proposals').
 */
@Injectable({
  providedIn: 'root',
})
export class PropuestasService {
  private firebaseService = inject(FirebaseService);
  private readonly COLLECTION_NAME = 'proposals';

  /**
   * Genera un token único y criptográficamente seguro (OWASP A02 - CSPRNG).
   */
  private generarTokenSeguro(): string {
    const arr = new Uint8Array(4);
    crypto.getRandomValues(arr);
    const hex = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    return `wlf-${hex}`;
  }

  /**
   * Crea una nueva propuesta directamente en Firestore.
   */
  crear(data: Partial<Propuesta>): Observable<{ id: string; token: string; link: string }> {
    return from(this.addPropuesta(data));
  }

  private async addPropuesta(data: Partial<Propuesta>): Promise<{ id: string; token: string; link: string }> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    const token = data.token || this.generarTokenSeguro();
    const now = new Date().toISOString();
    const validDays = data.validDays || 15;
    const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString();

    const payload = {
      token,
      clientId: data.clientId || null,
      title: data.title || 'Propuesta Comercial',
      clientPreviewName: data.clientPreviewName || 'Cliente',
      clientPreviewEmail: data.clientPreviewEmail || null,
      objective: data.objective || '',
      modules: data.modules || [],
      techStack: data.techStack || '',
      platform: data.platform || '',
      persistence: data.persistence || '',
      phases: data.phases || [],
      totalAmount: data.totalAmount || 0,
      currency: data.currency || 'USD',
      paymentTerms: data.paymentTerms || '',
      validDays,
      warrantyDays: data.warrantyDays || 30,
      notes: data.notes || '',
      discountPercent: data.discountPercent || 0,
      infrastructureItems: data.infrastructureItems || [],
      pricingDetails: data.pricingDetails || null,
      status: data.status || 'borrador',
      createdAt: now,
      expiresAt,
    };

    const docRef = await addDoc(colRef, payload);
    return {
      id: docRef.id,
      token,
      link: `/propuesta/${token}`,
    };
  }

  /**
   * Escucha el listado completo de propuestas en tiempo real.
   */
  listenPropuestas(): Observable<Propuesta[]> {
    return new Observable<Propuesta[]>((observer) => {
      const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
      const q = query(colRef, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const propuestas = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Propuesta, 'id'>),
          }));
          observer.next(propuestas);
        },
        (error) => {
          console.warn('Fallback sin orden en listenPropuestas:', error);
          const unsubsFallback = onSnapshot(
            colRef,
            (snapFallback) => {
              const items = snapFallback.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<Propuesta, 'id'>),
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
   * Obtiene el listado completo de propuestas desde Firestore.
   */
  listar(): Observable<Propuesta[]> {
    return from(this.fetchPropuestas());
  }

  private async fetchPropuestas(): Promise<Propuesta[]> {
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
      ...(docSnap.data() as Omit<Propuesta, 'id'>),
    }));
  }

  /**
   * Obtiene una propuesta por su ID de documento en Firestore.
   */
  getById(id: string): Observable<Propuesta> {
    return from(this.fetchPropuestaById(id));
  }

  private async fetchPropuestaById(id: string): Promise<Propuesta> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Propuesta no encontrada');
    }

    return {
      id: docSnap.id,
      ...(docSnap.data() as Omit<Propuesta, 'id'>),
    };
  }

  /**
   * Cambia el estado de una propuesta (ej: "en_desarrollo", "finalizado", "cancelado").
   */
  cambiarEstado(id: string, status: string): Observable<any> {
    return from(this.updatePropuestaField(id, { status }));
  }

  /**
   * Actualiza datos de una propuesta existente.
   */
  actualizar(id: string, data: Partial<Propuesta>): Observable<any> {
    return from(this.updatePropuestaField(id, data));
  }

  private async updatePropuestaField(id: string, data: Partial<Propuesta>): Promise<any> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    const { id: _, ...datosActualizados } = data as any;
    const payload = {
      ...datosActualizados,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(docRef, payload);
    return { message: 'Propuesta actualizada correctamente' };
  }

  /**
   * Elimina una propuesta por su ID.
   */
  eliminar(id: string): Observable<any> {
    return from(this.deletePropuestaById(id));
  }

  private async deletePropuestaById(id: string): Promise<any> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    await deleteDoc(docRef);
    return { message: 'Propuesta eliminada correctamente' };
  }

  /**
   * Obtiene una propuesta por su token público.
   */
  getByToken(token: string): Observable<Propuesta> {
    return from(this.fetchPropuestaByToken(token));
  }

  private async fetchPropuestaByToken(token: string): Promise<Propuesta> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    const q = query(colRef, where('token', '==', token), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error('Propuesta no encontrada');
    }

    const docSnap = snapshot.docs[0];
    return {
      id: docSnap.id,
      ...(docSnap.data() as Omit<Propuesta, 'id'>),
    };
  }

  /**
   * Registra la aceptación legal de la propuesta por el cliente.
   */
  aceptar(token: string, datos: AceptacionCliente): Observable<any> {
    return from(this.executeAceptar(token, datos));
  }

  private async executeAceptar(token: string, datos: AceptacionCliente): Promise<any> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    const q = query(colRef, where('token', '==', token), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error('Propuesta no encontrada');
    }

    const docSnap = snapshot.docs[0];
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, docSnap.id);

    await updateDoc(docRef, {
      status: 'aceptado',
      acceptedAt: new Date().toISOString(),
      clientLegalName: datos.clientLegalName,
      clientTaxId: datos.clientTaxId,
      clientAddress: datos.clientAddress,
      clientEmail: datos.clientEmail,
      updatedAt: new Date().toISOString(),
    });

    return { message: 'Propuesta aceptada con éxito' };
  }
}

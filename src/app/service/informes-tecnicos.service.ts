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
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';

/** Módulo o solución técnica detallada dentro del informe */
export interface ModuloSolucion {
  titulo: string;
  descripcion: string;
  impactoOValor: string;
  tiempoEstimadoSugerido?: string;
}

/** Estructura completa de una Propuesta Técnica / Informe Diagnóstico */
export interface InformeTecnico {
  id?: string;
  token?: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;
  title: string;
  
  // Diagnóstico & Problema
  situacionActual: string;
  problemasDetectados: string[];
  
  // Solución Propuesta & Valor
  resumenSolucion: string;
  modulosSolucion: ModuloSolucion[];
  beneficiosClave: string[];
  
  // Prospecto a Futuro & Escalabilidad
  prospectoFuturo?: string;
  tecnologiasRecomendadas?: string;
  
  // Estado del flujo
  status: 'borrador' | 'enviado' | 'en_revision' | 'aprobado' | 'presupuestado' | 'rechazado';
  presupuestoId?: string | null;
  
  notasInternas?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Servicio para la gestión de Propuestas Técnicas e Informes Diagnósticos.
 * Permite documentar problemáticas, justificar valor y soluciones sin precios fríos,
 * sirviendo como paso previo a la cotización/presupuesto.
 */
@Injectable({
  providedIn: 'root',
})
export class InformesTecnicosService {
  private firebaseService = inject(FirebaseService);
  private readonly COLLECTION_NAME = 'technical_proposals';

  /**
   * Genera un token aleatorio con CSPRNG seguro (OWASP A02).
   */
  private generarToken(): string {
    const arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    const hex = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    return `inf-${hex}`;
  }

  /**
   * Escucha en tiempo real la lista de informes técnicos ordenados cronológicamente.
   */
  listenInformes(): Observable<InformeTecnico[]> {
    return new Observable<InformeTecnico[]>((observer) => {
      const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
      const q = query(colRef, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<InformeTecnico, 'id'>),
          }));
          observer.next(items);
        },
        (error) => {
          console.warn('Fallback sin orden en listenInformes:', error);
          const unsubsFallback = onSnapshot(
            colRef,
            (snapFallback) => {
              const fallbackItems = snapFallback.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<InformeTecnico, 'id'>),
              }));
              observer.next(fallbackItems);
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
   * Obtiene todos los informes técnicos una sola vez.
   */
  getInformes(): Observable<InformeTecnico[]> {
    return from(this.fetchInformes());
  }

  private async fetchInformes(): Promise<InformeTecnico[]> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    let snapshot;
    try {
      const q = query(colRef, orderBy('createdAt', 'desc'));
      snapshot = await getDocs(q);
    } catch {
      snapshot = await getDocs(colRef);
    }

    return snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<InformeTecnico, 'id'>),
    }));
  }

  /**
   * Obtiene un informe por su ID de documento.
   */
  getInforme(id: string): Observable<InformeTecnico> {
    return from(this.fetchInformeById(id));
  }

  private async fetchInformeById(id: string): Promise<InformeTecnico> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      throw new Error('Informe técnico no encontrado');
    }

    return {
      id: snap.id,
      ...(snap.data() as Omit<InformeTecnico, 'id'>),
    };
  }

  /**
   * Obtiene un informe técnico a partir de su token público.
   */
  getInformeByToken(token: string): Observable<InformeTecnico | null> {
    return from(this.fetchInformeByToken(token));
  }

  private async fetchInformeByToken(token: string): Promise<InformeTecnico | null> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    const q = query(colRef, where('token', '==', token));
    const snap = await getDocs(q);

    if (snap.empty) {
      return null;
    }

    const docSnap = snap.docs[0];
    return {
      id: docSnap.id,
      ...(docSnap.data() as Omit<InformeTecnico, 'id'>),
    };
  }

  /**
   * Crea un nuevo informe técnico en Firestore.
   */
  crearInforme(informe: Omit<InformeTecnico, 'id' | 'token'>): Observable<{ id: string; token: string }> {
    return from(this.addInforme(informe));
  }

  private async addInforme(informe: Omit<InformeTecnico, 'id' | 'token'>): Promise<{ id: string; token: string }> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    const token = this.generarToken();
    const now = new Date().toISOString();

    const payload = {
      ...informe,
      token,
      status: informe.status || 'borrador',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(colRef, payload);
    return { id: docRef.id, token };
  }

  /**
   * Actualiza parcialmente un informe técnico.
   */
  actualizarInforme(id: string, parcial: Partial<InformeTecnico>): Observable<void> {
    return from(this.updateInformeById(id, parcial));
  }

  private async updateInformeById(id: string, parcial: Partial<InformeTecnico>): Promise<void> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    const { id: _, ...datos } = parcial as any;
    const payload = {
      ...datos,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(docRef, payload);
  }

  /**
   * Elimina un informe técnico de Firestore.
   */
  eliminarInforme(id: string): Observable<void> {
    return from(this.deleteInformeById(id));
  }

  private async deleteInformeById(id: string): Promise<void> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }
}

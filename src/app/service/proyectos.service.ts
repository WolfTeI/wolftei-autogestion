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

export interface CredencialBoveda {
  id: string;
  servicio: string;
  tipo: 'hosting' | 'dominio' | 'servidor' | 'base_de_datos' | 'otro';
  usuario: string;
  cipherTextHex: string;
  ivHex: string;
  saltHex: string;
  urlAcceso?: string;
  vencimientoFecha?: string;
  notas?: string;
  createdAt: string;
}

export interface Proyecto {
  id?: string;
  clientId: string;
  title: string;
  description?: string;
  status: 'pendiente' | 'en_progreso' | 'entregado' | 'cancelado';
  currentPhase: string;
  startDate?: string;
  endDate?: string;
  totalAmount: number;
  currency: string;
  reviewToken?: string;
  reviewCompleted?: boolean;
  reviewStars?: number;
  reviewComment?: string;
  // Bóveda de credenciales e infraestructura cifrada
  credenciales?: CredencialBoveda[];
  proveedorInfra?: string;
  cuentaInfra?: string;
  dominio?: string;
  vencimientoHosting?: string;
  vencimientoDominio?: string;
  // Constancia de Acta de Garantía
  actaGarantiaGenerada?: boolean;
  actaGarantiaFecha?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Servicio para la gestión del tablero de Proyectos directamente en Firestore ('projects').
 */
@Injectable({
  providedIn: 'root',
})
export class ProyectosService {
  private firebaseService = inject(FirebaseService);
  private readonly COLLECTION_NAME = 'projects';

  /**
   * Genera un token único de encuesta con CSPRNG (OWASP A02).
   */
  private generarTokenEncuesta(): string {
    const arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    const hex = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    return `srv-${hex}`;
  }

  /**
   * Escucha todos los proyectos en tiempo real desde Firestore.
   */
  listenProyectos(): Observable<Proyecto[]> {
    return new Observable<Proyecto[]>((observer) => {
      const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
      const q = query(colRef, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const proyectos = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Proyecto, 'id'>),
          }));
          observer.next(proyectos);
        },
        (error) => {
          console.warn('Fallback sin orden en listenProyectos:', error);
          const unsubsFallback = onSnapshot(
            colRef,
            (snapFallback) => {
              const items = snapFallback.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<Proyecto, 'id'>),
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
   * Obtiene todos los proyectos activos desde Firestore.
   */
  getProyectos(): Observable<Proyecto[]> {
    return from(this.fetchProyectos());
  }

  private async fetchProyectos(): Promise<Proyecto[]> {
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
      ...(docSnap.data() as Omit<Proyecto, 'id'>),
    }));
  }

  /**
   * Obtiene los proyectos vinculados a un cliente específico.
   */
  getProyectosPorCliente(clientId: string): Observable<Proyecto[]> {
    return from(this.fetchProyectosByCliente(clientId));
  }

  private async fetchProyectosByCliente(clientId: string): Promise<Proyecto[]> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    const q = query(colRef, where('clientId', '==', clientId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Proyecto, 'id'>),
    }));
  }

  /**
   * Obtiene un proyecto por su ID.
   */
  getProyecto(id: string): Observable<Proyecto> {
    return from(this.fetchProyectoById(id));
  }

  private async fetchProyectoById(id: string): Promise<Proyecto> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Proyecto no encontrado');
    }

    return {
      id: docSnap.id,
      ...(docSnap.data() as Omit<Proyecto, 'id'>),
    };
  }

  /**
   * Registra un nuevo proyecto en Firestore.
   */
  crearProyecto(proyecto: Proyecto): Observable<any> {
    return from(this.addProyecto(proyecto));
  }

  private async addProyecto(proyecto: Proyecto): Promise<any> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    const now = new Date().toISOString();

    const payload = {
      clientId: proyecto.clientId,
      title: proyecto.title,
      description: proyecto.description || null,
      status: proyecto.status || 'pendiente',
      currentPhase: proyecto.currentPhase || 'Inicio',
      startDate: proyecto.startDate || null,
      endDate: proyecto.endDate || null,
      totalAmount: proyecto.totalAmount || 0,
      currency: proyecto.currency || 'USD',
      reviewToken: null,
      reviewCompleted: false,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(colRef, payload);
    return {
      id: docRef.id,
      message: 'Proyecto creado exitosamente',
      proyecto: { id: docRef.id, ...payload },
    };
  }

  /**
   * Actualiza el estado o detalles de un proyecto.
   */
  actualizarProyecto(id: string, proyecto: Partial<Proyecto>): Observable<any> {
    return from(this.updateProyectoById(id, proyecto));
  }

  private async updateProyectoById(id: string, proyecto: Partial<Proyecto>): Promise<any> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    const { id: _, ...datosActualizados } = proyecto as any;
    const payload = {
      ...datosActualizados,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(docRef, payload);
    return { message: 'Proyecto actualizado exitosamente' };
  }

  /**
   * Elimina un proyecto por ID.
   */
  eliminarProyecto(id: string): Observable<any> {
    return from(this.deleteProyectoById(id));
  }

  private async deleteProyectoById(id: string): Promise<any> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    await deleteDoc(docRef);
    return { message: 'Proyecto eliminado exitosamente' };
  }

  /**
   * Genera el token y enlace único para la encuesta de satisfacción del cliente.
   */
  generarLinkEncuesta(id: string): Observable<{ reviewToken: string; link: string; message: string }> {
    return from(this.executeGenerarEncuesta(id));
  }

  private async executeGenerarEncuesta(id: string): Promise<{ reviewToken: string; link: string; message: string }> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Proyecto no encontrado');
    }

    const data = docSnap.data();
    if (data['reviewToken']) {
      return {
        message: 'El proyecto ya cuenta con enlace de encuesta.',
        reviewToken: data['reviewToken'],
        link: `/feedback/${data['reviewToken']}`,
      };
    }

    const reviewToken = this.generarTokenEncuesta();
    await updateDoc(docRef, {
      reviewToken,
      status: 'entregado',
      updatedAt: new Date().toISOString(),
    });

    return {
      message: 'Enlace de encuesta generado con éxito',
      reviewToken,
      link: `/feedback/${reviewToken}`,
    };
  }
}

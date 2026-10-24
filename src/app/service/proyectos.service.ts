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
  limit,
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
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientCompany?: string;
  clientTaxId?: string;
  propuestaId?: string;
  title: string;
  description?: string;
  status: 'esperando_anticipo' | 'en_progreso' | 'testing' | 'entregado' | 'archivado' | 'cancelado';
  currentPhase: string;
  startDate?: string | null;
  endDate?: string | null;
  deliveryDays?: number;
  totalAmount: number;
  currency: string;
  anticipoCobrado?: boolean;
  saldoCobrado?: boolean;
  archivadoFecha?: string | null;
  reviewToken?: string | null;
  reviewCompleted?: boolean;
  reviewStars?: number;
  reviewComment?: string;
  reviewPublicada?: boolean;
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

  /**
   * Modera una reseña alternando su visibilidad en el portal web público.
   */
  alternarPublicacionResena(proyectoId: string, publicada: boolean): Observable<void> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, proyectoId);
    return from(
      updateDoc(docRef, {
        reviewPublicada: publicada,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  /**
   * Crea o asegura la existencia de un Proyecto en la colección 'projects'
   * a partir de una propuesta comercial aceptada o enviada a desarrollo.
   * Evita duplicados si el proyecto ya fue generado.
   */
  crearOObtenerDesdePropuesta(propuesta: {
    id?: string;
    clientId?: string;
    title: string;
    objective?: string;
    notes?: string;
    totalAmount?: number;
    currency?: string;
  }): Observable<{ proyecto: Proyecto; creado: boolean }> {
    return from(this.executeCrearOObtenerDesdePropuesta(propuesta));
  }

  private async executeCrearOObtenerDesdePropuesta(propuesta: any): Promise<{ proyecto: Proyecto; creado: boolean }> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);

    // 1. Buscar si ya existe un proyecto vinculado por propuestaId
    if (propuesta.id) {
      const q = query(colRef, where('propuestaId', '==', propuesta.id), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        return {
          proyecto: { id: docSnap.id, ...(docSnap.data() as Omit<Proyecto, 'id'>) },
          creado: false,
        };
      }
    }

    // 2. Si no existe, asegurar cliente en la colección 'clients'
    const now = new Date().toISOString();
    const deliveryDays = Number(propuesta.deliveryTimeDays) || 20;
    const clientNombre = propuesta.clientLegalName || propuesta.clientPreviewName || 'Cliente';
    const clientEmail = propuesta.clientEmail || propuesta.clientPreviewEmail || '';
    const clientTaxId = propuesta.clientTaxId || '';

    let finalClientId = propuesta.clientId || '';

    // Si la propuesta no tenía clientId formal pero sí tiene nombre, buscar o crear el cliente en CRM
    if (!finalClientId && clientNombre && clientNombre !== 'Cliente') {
      try {
        const clientsCol = collection(this.firebaseService.db, 'clients');
        const qCli = query(clientsCol, where('name', '==', clientNombre), limit(1));
        const snapCli = await getDocs(qCli);
        if (!snapCli.empty) {
          finalClientId = snapCli.docs[0].id;
        } else {
          // Crear automáticamente el cliente para integrarlo formalmente al CRM
          const newCliRef = await addDoc(clientsCol, {
            name: clientNombre,
            email: clientEmail,
            taxId: clientTaxId,
            company: '',
            phone: '',
            address: '',
            notes: `Alta automática generada al pasar propuesta "${propuesta.title}" a desarrollo.`,
            createdAt: now,
            updatedAt: now,
          });
          finalClientId = newCliRef.id;
        }
      } catch (e) {
        console.warn('Error al auto-registrar cliente en CRM:', e);
      }
    }

    const payload = {
      clientId: finalClientId,
      clientName: clientNombre,
      clientEmail,
      clientTaxId,
      propuestaId: propuesta.id || null,
      title: propuesta.title || 'Nuevo Proyecto',
      description: propuesta.objective || propuesta.notes || 'Proyecto generado a partir de propuesta comercial.',
      status: 'esperando_anticipo' as const,
      currentPhase: 'Anticipo',
      startDate: now,
      endDate: null,
      deliveryDays,
      totalAmount: Number(propuesta.totalAmount) || 0,
      currency: propuesta.currency || 'USD',
      anticipoCobrado: false,
      saldoCobrado: false,
      archivadoFecha: null,
      reviewToken: null,
      reviewCompleted: false,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(colRef, payload);
    const nuevoProyecto: Proyecto = { id: docRef.id, ...payload };

    // 3. Vincular bidireccionalmente el proyectoId y clientId en la propuesta
    if (propuesta.id) {
      try {
        const propRef = doc(this.firebaseService.db, 'proposals', propuesta.id);
        const updateData: any = {
          proyectoId: docRef.id,
          updatedAt: now,
        };
        if (finalClientId && !propuesta.clientId) {
          updateData.clientId = finalClientId;
        }
        await updateDoc(propRef, updateData);
      } catch (err) {
        console.warn('No se pudo actualizar propuesta con proyectoId/clientId:', err);
      }
    }

    return { proyecto: nuevoProyecto, creado: true };
  }

  /**
   * Archiva un proyecto completado o cancelado y lo deriva a la sección Histórico.
   */
  archivarProyecto(id: string): Observable<void> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, id);
    const now = new Date().toISOString();
    return from(
      updateDoc(docRef, {
        status: 'archivado',
        archivadoFecha: now,
        updatedAt: now,
      })
    );
  }
}

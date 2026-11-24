import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
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
  fechaEntrega?: string | null;
  archivadoFecha?: string | null;
  // ── Calendario de Hitos y Entregas ──
  fechaVistaPrevia?: string | null;
  fechaDemo?: string | null;
  fechaMvp?: string | null;
  tieneSoporteActivo?: boolean;
  reviewToken?: string | null;
  reviewCompleted?: boolean;
  reviewStars?: number;
  reviewComment?: string;
  reviewPublicada?: boolean;

  // ── Jerarquía de Proyecto Madre, Versiones y Módulos Evolutivos ──
  esProyectoMadre?: boolean;
  parentProjectId?: string | null;
  parentProjectTitle?: string | null;
  versionTag?: string;
  tipoEvolucion?: 'inicial' | 'actualizacion_paradigma' | 'modulo_nuevo' | 'migracion' | 'mantenimiento';
  changelog?: string;

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

    const payload: any = {
      clientId: proyecto.clientId,
      clientName: proyecto.clientName || null,
      clientCompany: proyecto.clientCompany || null,
      clientPhone: proyecto.clientPhone || null,
      clientEmail: proyecto.clientEmail || null,
      clientTaxId: proyecto.clientTaxId || null,
      propuestaId: proyecto.propuestaId || null,
      title: proyecto.title,
      description: proyecto.description || null,
      status: proyecto.status || 'esperando_anticipo',
      currentPhase: proyecto.currentPhase || 'Planificación Inicial',
      startDate: proyecto.startDate || null,
      endDate: proyecto.endDate || null,
      deliveryDays: proyecto.deliveryDays || 20,
      totalAmount: Number(proyecto.totalAmount) || 0,
      currency: proyecto.currency || 'USD',
      anticipoCobrado: !!proyecto.anticipoCobrado,
      saldoCobrado: !!proyecto.saldoCobrado,
      fechaEntrega: proyecto.fechaEntrega || null,
      fechaVistaPrevia: proyecto.fechaVistaPrevia || null,
      fechaDemo: proyecto.fechaDemo || null,
      fechaMvp: proyecto.fechaMvp || null,
      tieneSoporteActivo: !!proyecto.tieneSoporteActivo,
      esProyectoMadre: proyecto.esProyectoMadre ?? true,
      parentProjectId: proyecto.parentProjectId || null,
      parentProjectTitle: proyecto.parentProjectTitle || null,
      versionTag: proyecto.versionTag || 'v1.0',
      tipoEvolucion: proyecto.tipoEvolucion || 'inicial',
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
    const now = new Date().toISOString();
    const payload: any = {
      ...datosActualizados,
      updatedAt: now,
    };

    // Si pasa a estado 'entregado' y no tiene estampada fechaEntrega, la registramos
    if (proyecto.status === 'entregado' && !proyecto.fechaEntrega) {
      payload.fechaEntrega = now;
    }

    await updateDoc(docRef, payload);
    return { message: 'Proyecto actualizado exitosamente' };
  }

  /**
   * Verifica los proyectos con estado 'entregado' y si transcurrieron más de 24 horas (al día siguiente),
   * los archiva automáticamente enviándolos al Histórico.
   */
  async verificarYArchivarEntregadosVencidos(): Promise<number> {
    try {
      const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
      const q = query(colRef, where('status', '==', 'entregado'));
      const snap = await getDocs(q);
      const now = Date.now();
      let archivados = 0;

      for (const docSnap of snap.docs) {
        const data = docSnap.data() as Proyecto;
        const fechaEntrega = data.fechaEntrega ? new Date(data.fechaEntrega).getTime() : (data.updatedAt ? new Date(data.updatedAt).getTime() : 0);
        // Si transcurrieron 24 horas (86.400.000 ms) o más desde que se entregó
        if (fechaEntrega && (now - fechaEntrega >= 24 * 60 * 60 * 1000)) {
          await updateDoc(doc(this.firebaseService.db, this.COLLECTION_NAME, docSnap.id), {
            status: 'archivado',
            archivadoFecha: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          archivados++;
        }
      }
      return archivados;
    } catch (e) {
      console.warn('Error al verificar entregados para archivar:', e);
      return 0;
    }
  }

  /**
   * Crea una nueva versión, actualización de paradigma o módulo evolutivo bajo un Proyecto Madre existente.
   */
  crearEvolucionProyecto(params: {
    parentProjectId: string;
    parentProjectTitle: string;
    clientId: string;
    versionTag: string;
    title: string;
    description: string;
    tipoEvolucion: 'actualizacion_paradigma' | 'modulo_nuevo' | 'migracion' | 'mantenimiento';
    changelog: string;
    totalAmount?: number;
    currency?: string;
  }): Observable<{ id: string; message: string }> {
    return from(this.executeCrearEvolucion(params));
  }

  private async executeCrearEvolucion(params: any): Promise<{ id: string; message: string }> {
    const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
    const now = new Date().toISOString();

    // 1. Asegurar que el proyecto padre quede marcado como Proyecto Madre
    const parentRef = doc(this.firebaseService.db, this.COLLECTION_NAME, params.parentProjectId);
    await updateDoc(parentRef, {
      esProyectoMadre: true,
      updatedAt: now,
    });

    // 2. Crear la iteración/módulo nuevo
    const payload = {
      clientId: params.clientId,
      parentProjectId: params.parentProjectId,
      parentProjectTitle: params.parentProjectTitle,
      esProyectoMadre: false,
      title: params.title,
      versionTag: params.versionTag,
      tipoEvolucion: params.tipoEvolucion,
      changelog: params.changelog || '',
      description: params.description || '',
      status: 'en_progreso',
      currentPhase: 'Desarrollo',
      totalAmount: params.totalAmount || 0,
      currency: params.currency || 'USD',
      startDate: now,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(colRef, payload);
    return { id: docRef.id, message: 'Nueva versión o módulo registrado exitosamente' };
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
    let reviewToken = data['reviewToken'];

    // Si no tiene reviewToken pero es un módulo hijo de un Proyecto Madre, heredar el token de la Madre
    if (!reviewToken && data['parentProjectId']) {
      try {
        const parentDoc = await getDoc(doc(this.firebaseService.db, this.COLLECTION_NAME, data['parentProjectId']));
        if (parentDoc.exists() && parentDoc.data()['reviewToken']) {
          reviewToken = parentDoc.data()['reviewToken'];
        }
      } catch (e) {
        console.warn('Error al heredar reviewToken del Proyecto Madre:', e);
      }
    }

    if (reviewToken) {
      if (data['status'] !== 'entregado' || !data['reviewToken']) {
        await updateDoc(docRef, {
          reviewToken,
          status: 'entregado',
          updatedAt: new Date().toISOString(),
        });
      }
      this.sincronizarVitrinaPublica();
      return {
        message: 'Enlace de encuesta unificado (permite actualizar la valoración anterior).',
        reviewToken,
        link: `/feedback/${reviewToken}`,
      };
    }

    reviewToken = this.generarTokenEncuesta();
    await updateDoc(docRef, {
      reviewToken,
      status: 'entregado',
      updatedAt: new Date().toISOString(),
    });

    this.sincronizarVitrinaPublica();

    return {
      message: 'Enlace de encuesta generado con éxito',
      reviewToken,
      link: `/feedback/${reviewToken}`,
    };
  }

  /**
   * Modera una reseña alternando su visibilidad en el portal web público y sincroniza la vitrina.
   */
  alternarPublicacionResena(proyectoId: string, publicada: boolean): Observable<void> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, proyectoId);
    return from(
      updateDoc(docRef, {
        reviewPublicada: publicada,
        updatedAt: new Date().toISOString(),
      }).then(() => this.sincronizarVitrinaPublica())
    );
  }

  /**
   * Sincroniza la vitrina pública (/showcase/home) para el portal web:
   * 1. Logos de empresas que tengan al menos 1 contrato cerrado/entregado ('entregado' o 'archivado') y posean logoUrl.
   *    (Sin ningún otro dato del cliente, solo el logo de la empresa).
   * 2. Reseñas aprobadas de proyectos entregados.
   * Protege estrictamente datos sensibles o PII (OWASP A01 / ISO 27001).
   */
  async sincronizarVitrinaPublica(): Promise<void> {
    try {
      const db = this.firebaseService.db;
      // 1. Buscar proyectos entregados o archivados
      const projectsCol = collection(db, this.COLLECTION_NAME);
      const snapP = await getDocs(projectsCol);

      const clientIdsConEntregas = new Set<string>();
      const clientNamesConEntregas = new Set<string>();
      const reviewsPublicadas: any[] = [];

      snapP.docs.forEach((docSnap) => {
        const p = docSnap.data() as Proyecto;
        if (p.status === 'entregado' || p.status === 'archivado') {
          if (p.clientId) {
            clientIdsConEntregas.add(p.clientId);
          }
          if (p.clientName) {
            clientNamesConEntregas.add(p.clientName.trim().toLowerCase());
          }
          if (p.reviewCompleted && p.reviewPublicada && p.reviewComment) {
            reviewsPublicadas.push({
              id: docSnap.id,
              stars: p.reviewStars || 5,
              comment: p.reviewComment,
              projectTitle: p.title || 'Desarrollo de Software',
            });
          }
        }
      });

      // 2. Obtener logos de esos clientes con entregas cumplidas
      const logos: { id: string; logoUrl: string }[] = [];
      const clientsCol = collection(db, 'clients');
      const snapC = await getDocs(clientsCol);

      snapC.docs.forEach((docSnap) => {
        const c = docSnap.data() as any;
        const nombreLower = (c.name || '').trim().toLowerCase();
        const tieneEntrega = clientIdsConEntregas.has(docSnap.id) || (nombreLower && clientNamesConEntregas.has(nombreLower));

        if (tieneEntrega && c.logoUrl && typeof c.logoUrl === 'string' && c.logoUrl.trim()) {
          // EXCLUSIVAMENTE el logo de la empresa, sin nombres ni datos personales
          logos.push({
            id: docSnap.id,
            logoUrl: c.logoUrl.trim(),
          });
        }
      });

      // 3. Escribir documento público /showcase/home
      const showcaseRef = doc(db, 'showcase', 'home');
      await setDoc(showcaseRef, {
        logos,
        reviews: reviewsPublicadas,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      console.log('✅ Vitrina pública sincronizada exitosamente:', {
        totalLogos: logos.length,
        totalReviews: reviewsPublicadas.length,
      });
    } catch (e) {
      console.warn('Error al sincronizar vitrina pública:', e);
    }
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
      }).then(() => this.sincronizarVitrinaPublica())
    );
  }

  /**
   * Rutina de Autocuración y Conciliación Inteligente:
   * Revisa proyectos en estado 'esperando_anticipo' que ya cuentan con pagos registrados
   * (de concepto anticipo o total) en la colección 'payments' y los mueve automáticamente
   * a 'en_progreso' ('En Desarrollo') con anticipoCobrado: true.
   */
  async autoHealProyectosConPagos(): Promise<number> {
    try {
      const colRef = collection(this.firebaseService.db, this.COLLECTION_NAME);
      const q = query(colRef, where('status', '==', 'esperando_anticipo'));
      const snap = await getDocs(q);
      if (snap.empty) return 0;

      const paymentsCol = collection(this.firebaseService.db, 'payments');
      let actualizados = 0;

      for (const docSnap of snap.docs) {
        const proj = docSnap.data() as Proyecto;
        if (!proj.propuestaId && !proj.clientId) continue;

        let pagosSnap;
        if (proj.propuestaId) {
          const qPagos = query(paymentsCol, where('propuestaId', '==', proj.propuestaId));
          pagosSnap = await getDocs(qPagos);
        } else {
          const qPagos = query(paymentsCol, where('clientId', '==', proj.clientId));
          pagosSnap = await getDocs(qPagos);
        }

        if (pagosSnap && !pagosSnap.empty) {
          const docsPagos = pagosSnap.docs.map(d => d.data());
          const tieneAnticipo = docsPagos.some(p => p['concept'] === 'anticipo' || p['concept'] === 'total');
          const totalPagado = docsPagos.reduce((acc, curr) => acc + (Number(curr['amount']) || 0), 0);

          if (tieneAnticipo || (proj.totalAmount > 0 && totalPagado >= proj.totalAmount * 0.3)) {
            const now = new Date().toISOString();
            await updateDoc(doc(this.firebaseService.db, this.COLLECTION_NAME, docSnap.id), {
              status: 'en_progreso',
              currentPhase: 'Desarrollo',
              anticipoCobrado: true,
              saldoCobrado: totalPagado >= proj.totalAmount,
              updatedAt: now,
            });
            actualizados++;
          }
        }
      }
      return actualizados;
    } catch (e) {
      console.warn('Error en autoHealProyectosConPagos:', e);
      return 0;
    }
  }
}

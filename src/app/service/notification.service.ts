import { Injectable, inject } from '@angular/core';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { ContactoService } from './contacto.service';
import { PropuestasService, Propuesta } from './propuestas.service';
import { ProyectosService, Proyecto } from './proyectos.service';
import { PagosService, Pago } from './pagos.service';

/**
 * Servicio encargado de gestionar las notificaciones nativas de Windows en segundo plano
 * al recibir acciones en vivo del cliente en la web:
 * - Aceptación de presupuestos / propuestas comerciales en vivo.
 * - Apertura y lectura de propuestas por parte del cliente.
 * - Nuevos mensajes en el formulario de contacto web.
 * - Reseñas y calificaciones de satisfacción post-entrega.
 * - Acreditación de cobros y pagos de anticipos/saldos.
 * - Monitoreo proactivo de plazos y fechas límite de entrega (Hitos de Calendario).
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private contactoService = inject(ContactoService);
  private propuestasService = inject(PropuestasService);
  private proyectosService = inject(ProyectosService);
  private pagosService = inject(PagosService);

  private mensajesVistos = new Set<string>();
  private estadosPropuestas = new Map<string, string>();
  private proyectosResenados = new Set<string>();
  private pagosVistos = new Set<string>();
  private notificacionesDisparadas = new Set<string>();

  private inicializadoMensajes = false;
  private inicializadoPropuestas = false;
  private inicializadoProyectos = false;
  private inicializadoPagos = false;
  private timerVerificacion?: any;

  /**
   * Inicializa los listeners nativos en segundo plano y solicita permisos a Windows si hace falta.
   */
  async init(): Promise<void> {
    try {
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }

      if (permissionGranted) {
        this.escucharMensajesNuevos();
        this.escucharPropuestas();
        this.escucharProyectosYResenas();
        this.escucharCobrosNuevos();
        this.iniciarMonitoreoPeriodico();
      }
    } catch (err) {
      console.warn('Las notificaciones nativas de Tauri no están disponibles en este entorno:', err);
    }
  }

  /**
   * Envía una notificación nativa de Windows con título y cuerpo.
   */
  async send(title: string, body: string): Promise<void> {
    try {
      if (await isPermissionGranted()) {
        sendNotification({ title, body });
      }
    } catch (err) {
      console.warn('Error al disparar notificación nativa:', err);
    }
  }

  /**
   * 1. Escucha mensajes nuevos entrantes desde el formulario de contacto de la web.
   */
  private escucharMensajesNuevos(): void {
    this.contactoService.listenMessages().subscribe({
      next: (mensajes) => {
        if (!this.inicializadoMensajes) {
          mensajes.forEach((m) => {
            if (m.id) this.mensajesVistos.add(m.id);
          });
          this.inicializadoMensajes = true;
          return;
        }

        for (const m of mensajes) {
          if (m.id && !this.mensajesVistos.has(m.id)) {
            this.mensajesVistos.add(m.id);
            this.send(
              '📩 Nuevo Mensaje Web',
              `${m.name} (${m.email || 'web'}): "${m.subject || m.message?.slice(0, 60)}..."`
            );
          }
        }
      },
      error: (err) => console.warn('Error en listener de contacto:', err),
    });
  }

  /**
   * 2. Escucha propuestas comerciales y detecta aceptación o visualización en vivo.
   */
  private escucharPropuestas(): void {
    this.propuestasService.listenPropuestas().subscribe({
      next: (propuestas) => {
        if (!this.inicializadoPropuestas) {
          propuestas.forEach((p) => {
            if (p.id) this.estadosPropuestas.set(p.id, p.status || '');
          });
          this.inicializadoPropuestas = true;
          return;
        }

        for (const p of propuestas) {
          if (p.id) {
            const estadoActual = p.status || '';
            const estadoAnterior = this.estadosPropuestas.get(p.id);
            this.estadosPropuestas.set(p.id, estadoActual);

            // Aceptación formal por el cliente
            if (estadoAnterior && estadoAnterior !== 'aceptado' && estadoActual === 'aceptado') {
              const clienteNombre = p.clientLegalName || p.clientPreviewName || 'El cliente';
              this.send(
                '🎉 ¡Presupuesto Aceptado!',
                `${clienteNombre} aceptó formalmente "${p.title}" (${p.currency} ${p.totalAmount}). ¡Listo para registrar cobro e iniciar desarrollo!`
              );
            }

            // Cliente abrió el presupuesto en la web (visto)
            if (estadoAnterior && estadoAnterior !== 'visto' && estadoActual === 'visto') {
              this.send(
                '👁️ Presupuesto en Revisión',
                `${p.clientPreviewName} abrió el enlace web y está revisando "${p.title}".`
              );
            }
          }
        }
      },
      error: (err) => console.warn('Error en listener de propuestas:', err),
    });
  }

  /**
   * 3. Escucha proyectos, reseñas de satisfacción post-entrega y plazos de entrega.
   */
  private escucharProyectosYResenas(): void {
    this.proyectosService.listenProyectos().subscribe({
      next: (proyectos) => {
        if (!this.inicializadoProyectos) {
          proyectos.forEach((pj) => {
            if (pj.id && pj.reviewCompleted) {
              this.proyectosResenados.add(pj.id);
            }
          });
          this.inicializadoProyectos = true;
          this.verificarVencimientosHitos(proyectos);
          return;
        }

        // Detectar nuevas opiniones de clientes enviadas desde la web
        for (const pj of proyectos) {
          if (pj.id && pj.reviewCompleted && !this.proyectosResenados.has(pj.id)) {
            this.proyectosResenados.add(pj.id);
            const stars = pj.reviewStars || 5;
            const estrellas = '⭐'.repeat(Math.min(5, Math.max(1, stars)));
            const cliente = pj.clientName || 'Un cliente';
            this.send(
              `⭐ ¡Nueva Calificación! (${estrellas})`,
              `${cliente} opinó sobre "${pj.title}": "${pj.reviewComment || 'Calificación registrada con éxito'}"`
            );
          }
        }

        // Monitoreo de fechas límite e hitos
        this.verificarVencimientosHitos(proyectos);
      },
      error: (err) => console.warn('Error en listener de proyectos:', err),
    });
  }

  /**
   * 4. Escucha cobros acreditados y recibos emitidos en tiempo real.
   */
  private escucharCobrosNuevos(): void {
    this.pagosService.listenPagos().subscribe({
      next: (pagos) => {
        if (!this.inicializadoPagos) {
          pagos.forEach((p) => {
            if (p.id) this.pagosVistos.add(p.id);
          });
          this.inicializadoPagos = true;
          return;
        }

        for (const p of pagos) {
          if (p.id && !this.pagosVistos.has(p.id)) {
            this.pagosVistos.add(p.id);
            this.send(
              '💰 Cobro Acreditado',
              `Acreditado ${p.currency} ${p.amount} (${p.concept?.toUpperCase()}) · Recibo ${p.receiptNumber || 'S/N'}.`
            );
          }
        }
      },
      error: (err) => console.warn('Error en listener de pagos:', err),
    });
  }

  /**
   * 5. Monitoreo de plazos y cumplimiento de tiempos de entrega (Hitos de Calendario).
   */
  private verificarVencimientosHitos(proyectos: Proyecto[]): void {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().slice(0, 10);
    const hoyTime = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();

    const activos = proyectos.filter(
      (p) => p.status === 'en_progreso' || p.status === 'testing' || p.status === 'esperando_anticipo'
    );

    for (const p of activos) {
      if (!p.id) continue;

      const hitos: { clave: string; nombre: string; fecha?: string | null }[] = [
        { clave: 'vista_previa', nombre: 'Vista Previa (Wireframe)', fecha: p.fechaVistaPrevia },
        { clave: 'demo', nombre: 'Demostración de Avance', fecha: p.fechaDemo },
        { clave: 'mvp', nombre: 'Entrega MVP Funcional', fecha: p.fechaMvp },
        { clave: 'entrega', nombre: 'Puesta en Producción / Cierre', fecha: p.fechaEntrega },
      ];

      for (const h of hitos) {
        if (!h.fecha) continue;

        const parts = h.fecha.split('-');
        if (parts.length < 3) continue;
        const fechaHito = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const diffMs = fechaHito.getTime() - hoyTime;
        const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

        const notifKeyHoy = `${p.id}-${h.clave}-${hoyStr}-0`;
        const notifKeyManana = `${p.id}-${h.clave}-${hoyStr}-1`;

        // Hito programado para HOY
        if (diffDias === 0 && !this.notificacionesDisparadas.has(notifKeyHoy)) {
          this.notificacionesDisparadas.add(notifKeyHoy);
          this.send(
            '⏰ ¡Hito para HOY!',
            `En "${p.title}" (${p.clientName || 'Cliente'}) tenés la entrega de ${h.nombre} prevista para HOY.`
          );
        }
        // Hito programado para MAÑANA
        else if (diffDias === 1 && !this.notificacionesDisparadas.has(notifKeyManana)) {
          this.notificacionesDisparadas.add(notifKeyManana);
          this.send(
            '⏳ Entrega Próxima (Mañana)',
            `En "${p.title}" (${p.clientName || 'Cliente'}) tenés la entrega de ${h.nombre} mañana (${h.fecha}).`
          );
        }
      }
    }
  }

  /**
   * 6. Timer de verificación periódica (cada 60 minutos) mientras la app está abierta.
   */
  private iniciarMonitoreoPeriodico(): void {
    if (this.timerVerificacion) {
      clearInterval(this.timerVerificacion);
    }
    this.timerVerificacion = setInterval(() => {
      this.proyectosService.getProyectos().subscribe({
        next: (proyectos: Proyecto[]) => this.verificarVencimientosHitos(proyectos),
        error: () => {},
      });
    }, 60 * 60 * 1000);
  }
}

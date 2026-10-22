import { Injectable, inject } from '@angular/core';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { ContactoService } from './contacto.service';
import { PropuestasService } from './propuestas.service';

/**
 * Servicio encargado de gestionar las notificaciones nativas de Windows en segundo plano
 * al recibir nuevos mensajes de contacto web o cuando un cliente formaliza una propuesta.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private contactoService = inject(ContactoService);
  private propuestasService = inject(PropuestasService);

  private mensajesVistos = new Set<string>();
  private estadosPropuestas = new Map<string, string>();
  private inicializadoMensajes = false;
  private inicializadoPropuestas = false;

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
        this.escucharPropuestasAceptadas();
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

  private escucharMensajesNuevos(): void {
    this.contactoService.listenMessages().subscribe({
      next: (mensajes) => {
        // En la primera carga, registrar los IDs existentes para no spamear
        if (!this.inicializadoMensajes) {
          mensajes.forEach((m) => {
            if (m.id) this.mensajesVistos.add(m.id);
          });
          this.inicializadoMensajes = true;
          return;
        }

        // Buscar mensajes que no estaban en la carga previa
        for (const m of mensajes) {
          if (m.id && !this.mensajesVistos.has(m.id)) {
            this.mensajesVistos.add(m.id);
            this.send(
              '📩 Nuevo Mensaje de Contacto',
              `${m.name} (${m.source || 'web'}): "${m.subject || m.message?.slice(0, 50)}"`
            );
          }
        }
      },
      error: (err) => console.warn('Error en listener de notificaciones de contacto:', err),
    });
  }

  private escucharPropuestasAceptadas(): void {
    this.propuestasService.listenPropuestas().subscribe({
      next: (propuestas) => {
        // En la primera carga, guardar los estados actuales
        if (!this.inicializadoPropuestas) {
          propuestas.forEach((p) => {
            if (p.id) this.estadosPropuestas.set(p.id, p.status || '');
          });
          this.inicializadoPropuestas = true;
          return;
        }

        // Detectar propuestas que cambiaron de estado a 'aceptado'
        for (const p of propuestas) {
          if (p.id) {
            const estadoActual = p.status || '';
            const estadoAnterior = this.estadosPropuestas.get(p.id);
            this.estadosPropuestas.set(p.id, estadoActual);

            if (estadoAnterior && estadoAnterior !== 'aceptado' && estadoActual === 'aceptado') {
              this.send(
                '🎉 ¡Propuesta Aceptada!',
                `${p.clientPreviewName} acaba de formalizar la propuesta por ${p.currency} ${p.totalAmount}.`
              );
            }
          }
        }
      },
      error: (err) => console.warn('Error en listener de notificaciones de propuestas:', err),
    });
  }
}

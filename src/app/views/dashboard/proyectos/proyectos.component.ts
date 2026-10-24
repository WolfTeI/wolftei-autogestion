import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { Router, RouterModule } from '@angular/router';
import { ProyectosService, Proyecto } from '../../../service/proyectos.service';
import { PropuestasService } from '../../../service/propuestas.service';
import { ClientesService, Cliente } from '../../../service/clientes.service';
import { WhatsAppService } from '../../../service/whatsapp.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError, map, take } from 'rxjs/operators';
import { generateContractPDF, generateNDAPDF, generateBothLegalPDFs } from '../../../utils/contract-pdf-generator';
import { generateActaGarantiaPDF } from '../../../utils/acta-garantia-pdf-generator';
import { BovedaCredencialesDialogComponent } from './boveda-dialog/boveda-dialog.component';
import { EditarClienteDialogComponent, EditarClienteDialogData } from '../clientes/editar-cliente-dialog/editar-cliente-dialog.component';

export interface ProyectoView extends Proyecto {
  clientName?: string;
  clientPhone?: string;
  cliente?: Cliente;
}

export const KANBAN_COLUMNS = [
  { id: 'esperando_anticipo', label: 'Esperando Anticipo', icon: 'pending_actions', color: '#f59e0b' },
  { id: 'en_progreso',        label: 'En Desarrollo',      icon: 'engineering',     color: '#3b82f6' },
  { id: 'testing',            label: 'QA / Testing',       icon: 'rule',            color: '#8b5cf6' },
  { id: 'entregado',          label: 'Entregado',          icon: 'task_alt',        color: '#10b981' }
];

@Component({
  selector: 'app-proyectos',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    RouterModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatMenuModule,
    MatButtonToggleModule,
    MatDividerModule,
    MatDialogModule
  ],
  templateUrl: './proyectos.component.html',
  styleUrls: ['./proyectos.component.scss']
})
export class ProyectosComponent implements OnInit, OnDestroy {
  private proyectosService = inject(ProyectosService);
  private propuestasService = inject(PropuestasService);
  private clientesService = inject(ClientesService);
  private whatsAppService = inject(WhatsAppService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private sub?: Subscription;

  proyectos = signal<ProyectoView[]>([]);
  isLoading = signal<boolean>(true);
  vistaModo: 'kanban' | 'tabla' = 'kanban';
  kanbanColumns = KANBAN_COLUMNS;
  displayedColumns: string[] = ['title', 'client', 'phase', 'status', 'actions'];

  ngOnInit(): void {
    this.sincronizarPropuestasAprobadas();
    this.iniciarEscuchaTiempoReal();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /**
   * Revisa si hay propuestas en estado 'en_desarrollo' o 'aceptado' que aún no tengan
   * su proyecto correspondiente en el Tablero Kanban y las da de alta automáticamente.
   */
  sincronizarPropuestasAprobadas() {
    this.propuestasService.listenPropuestas().pipe(take(1)).subscribe({
      next: (props) => {
        const enDesarrollo = props.filter(p => p.status === 'en_desarrollo' || p.status === 'aceptado');
        for (const prop of enDesarrollo) {
          this.proyectosService.crearOObtenerDesdePropuesta(prop).subscribe();
        }
      },
      error: (err) => console.warn('Error al verificar propuestas para sincronizar con Kanban:', err)
    });
  }

  iniciarEscuchaTiempoReal() {
    this.isLoading.set(true);
    this.sub = this.proyectosService.listenProyectos().subscribe({
      next: (proyectosData) => {
        if (proyectosData.length === 0) {
          this.proyectos.set([]);
          this.isLoading.set(false);
          return;
        }

        // Mapear IDs de clientes a sus nombres, teléfonos y datos completos
        const clientRequests = proyectosData.map(p => {
          const fallbackNombre = (!p.clientName || p.clientName === 'Desconocido') ? 'Cliente' : p.clientName;
          if (!p.clientId) {
            return of({
              ...p,
              clientName: fallbackNombre,
              clientPhone: p.clientPhone,
            } as ProyectoView);
          }
          return this.clientesService.getCliente(p.clientId).pipe(
            map(cliente => ({
              ...p,
              clientName: cliente.name || fallbackNombre,
              clientPhone: cliente.phone || p.clientPhone,
              cliente: cliente
            }) as ProyectoView),
            catchError(() => of({
              ...p,
              clientName: fallbackNombre,
              clientPhone: p.clientPhone,
            } as ProyectoView))
          );
        });

        forkJoin(clientRequests).subscribe(results => {
          this.proyectos.set(results);
          this.isLoading.set(false);
        });
      },
      error: (err) => {
        console.error('Error al escuchar proyectos en tiempo real:', err);
        this.isLoading.set(false);
      }
    });
  }

  cargarProyectos() {
    this.sub?.unsubscribe();
    this.iniciarEscuchaTiempoReal();
  }

  proyectosPorEstado(estadoId: string): ProyectoView[] {
    return this.proyectos().filter(p => {
      // Excluir proyectos archivados del tablero operativo (se visualizan en la sección Histórico)
      if (p.status === 'archivado') return false;

      if (estadoId === 'esperando_anticipo') {
        return p.status === 'esperando_anticipo' || (p.status as string) === 'pendiente';
      }
      if (estadoId === 'testing') {
        return p.status === ('testing' as any);
      }
      return p.status === estadoId;
    });
  }

  /**
   * Calcula el avance temporal y estado SLA según el plazo pactado en la propuesta.
   */
  calcularSla(p: ProyectoView): { diasTranscurridos: number; diasTotales: number; porcentaje: number; esAlerta: boolean } {
    const diasTotales = p.deliveryDays || 20;
    const fechaInicio = p.startDate ? new Date(p.startDate).getTime() : Date.now();
    const diasTranscurridos = Math.max(1, Math.floor((Date.now() - fechaInicio) / (1000 * 60 * 60 * 24)));
    const porcentaje = Math.min(100, Math.round((diasTranscurridos / diasTotales) * 100));
    const diasRestantes = diasTotales - diasTranscurridos;
    const esAlerta = diasRestantes <= 3 && p.status !== 'entregado' && p.status !== 'archivado';

    return { diasTranscurridos, diasTotales, porcentaje, esAlerta };
  }

  /**
   * Archiva un proyecto completado o cancelado y lo deriva a la sección Histórico.
   */
  archivarProyecto(proyecto: ProyectoView): void {
    if (!proyecto.id) return;
    const ok = confirm(`¿Deseás archivar el expediente de "${proyecto.title}" y derivarlo a la sección Histórico?`);
    if (!ok) return;

    this.proyectosService.archivarProyecto(proyecto.id).subscribe({
      next: () => {
        this.snackBar.open(`📦 Proyecto archivado en el Histórico de WolfTeI.`, 'Ver Histórico', { duration: 4000 })
          .onAction().subscribe(() => this.router.navigate(['/dashboard/historico']));
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Error al archivar el proyecto.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  /**
   * Abre el modal para completar o editar los datos de contacto y fiscales del cliente
   * desde la misma tarjeta o tabla del proyecto.
   */
  abrirEditarCliente(proyecto: ProyectoView): void {
    const nombreSugerido = (!proyecto.clientName || proyecto.clientName === 'Desconocido' || proyecto.clientName === 'Cliente')
      ? ''
      : proyecto.clientName;

    const dialogRef = this.dialog.open(EditarClienteDialogComponent, {
      width: '580px',
      data: {
        cliente: proyecto.cliente,
        nombreSugerido,
        emailSugerido: proyecto.clientEmail,
        telefonoSugerido: proyecto.clientPhone,
        cuitSugerido: proyecto.clientTaxId,
        proyectoId: proyecto.id,
        propuestaId: proyecto.propuestaId,
      } as EditarClienteDialogData,
    });

    dialogRef.afterClosed().subscribe((res: any) => {
      if (res) {
        this.proyectos.update(lista =>
          lista.map(p => p.id === proyecto.id ? {
            ...p,
            clientId: res.id || p.clientId,
            clientName: res.name || p.clientName,
            clientPhone: res.phone || p.clientPhone,
            cliente: res,
          } : p)
        );
      }
    });
  }

  moverEstado(proyecto: ProyectoView, nuevoEstado: string): void {
    if (!proyecto.id || proyecto.status === nuevoEstado) return;

    if (nuevoEstado === 'entregado') {
      this.entregarProyecto(proyecto);
      return;
    }

    // Actualización optimista inmediata (0ms)
    const estadoPrevio = proyecto.status;
    this.proyectos.update((lista) =>
      lista.map((p) => (p.id === proyecto.id ? { ...p, status: nuevoEstado as any } : p))
    );

    this.proyectosService.actualizarProyecto(proyecto.id, {
      status: nuevoEstado as any
    }).subscribe({
      next: () => {
        this.snackBar.open(`Proyecto movido a "${nuevoEstado.toUpperCase()}"`, '', { duration: 2500 });
      },
      error: (err) => {
        console.error('Error al actualizar estado:', err);
        // Rollback
        this.proyectos.update((lista) =>
          lista.map((p) => (p.id === proyecto.id ? { ...p, status: estadoPrevio } : p))
        );
        this.snackBar.open('Error al actualizar el estado del proyecto.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  entregarProyecto(proyecto: ProyectoView) {
    if (!proyecto.id) return;
    
    // Generar el link de la encuesta y pasarlo a "entregado"
    this.proyectosService.generarLinkEncuesta(proyecto.id).subscribe({
      next: (res) => {
        proyecto.status = 'entregado';
        proyecto.reviewToken = res.reviewToken;
        const fullLink = `https://wolftei.com.ar/feedback/${res.reviewToken}`;
        navigator.clipboard.writeText(fullLink).then(() => {
          this.snackBar.open(`✅ ¡Proyecto entregado! Link de reseña copiado al portapapeles.`, 'Cerrar', { duration: 5000 });
          this.cargarProyectos();
        });
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open(err.error?.error || 'Error al generar la encuesta', 'Cerrar', { duration: 3000 });
      }
    });
  }

  copiarEncuesta(proyecto: ProyectoView) {
    if (proyecto.reviewToken) {
      const fullLink = `https://wolftei.com.ar/feedback/${proyecto.reviewToken}`;
      navigator.clipboard.writeText(fullLink).then(() => {
        this.snackBar.open(`🔗 Link de feedback copiado al portapapeles.`, '', { duration: 3000 });
      });
    }
  }

  async enviarEncuestaWhatsApp(proyecto: ProyectoView) {
    if (!proyecto.reviewToken) return;
    const link = `https://wolftei.com.ar/feedback/${proyecto.reviewToken}`;
    const clienteNombre = proyecto.clientName || 'Cliente';
    const msg = `¡Hola ${clienteNombre}! 👋

Te escribo desde *WolfTeI*. Damos por formalmente entregado el proyecto *"${proyecto.title}"*. 🚀

¿Nos dejarías una breve reseña de tu experiencia trabajando juntos? Tu opinión nos ayuda muchísimo a seguir mejorando:

⭐ *Dejar Reseña:* ${link}

¡Muchas gracias por la confianza!

Saludos,
*WolfTeI*`;

    this.snackBar.open(`💬 Abriendo WhatsApp con ${clienteNombre} para solicitar reseña...`, 'Cerrar', { duration: 3500 });
    await this.whatsAppService.abrirChat(proyecto.clientPhone || '', msg);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'entregado': return 'primary';
      case 'en_progreso': return 'accent';
      case 'testing': return '#8b5cf6';
      case 'pendiente': return 'warn';
      default: return '';
    }
  }

  descargarContratoProyecto(p: ProyectoView) {
    const cli: Cliente = p.cliente || {
      id: p.clientId || '',
      name: p.clientName || 'Cliente',
      email: '',
      company: '',
      phone: p.clientPhone || '',
      address: '',
      taxId: ''
    };
    generateContractPDF(cli, {
      title: p.title,
      totalAmount: p.totalAmount,
      currency: p.currency
    } as any);
    this.snackBar.open('📄 Contrato de Desarrollo descargado con éxito.', 'Cerrar', { duration: 3000 });
  }

  descargarNDAProyecto(p: ProyectoView) {
    const cli: Cliente = p.cliente || {
      id: p.clientId || '',
      name: p.clientName || 'Cliente',
      email: '',
      company: '',
      phone: p.clientPhone || '',
      address: '',
      taxId: ''
    };
    generateNDAPDF(cli, {
      title: p.title
    } as any);
    this.snackBar.open('🔒 Acuerdo NDA descargado con éxito.', 'Cerrar', { duration: 3000 });
  }

  descargarCarpetaProyecto(p: ProyectoView) {
    this.descargarContratoProyecto(p);
    setTimeout(() => {
      this.descargarNDAProyecto(p);
    }, 450);
    this.snackBar.open('🖨️ Carpeta legal descargada (Contrato + NDA listos para imprimir).', 'Cerrar', { duration: 4000 });
  }

  /**
   * Abre el diálogo de Bóveda Segura de Credenciales cifradas con AES-256-GCM.
   */
  abrirBoveda(proyecto: ProyectoView) {
    this.dialog.open(BovedaCredencialesDialogComponent, {
      width: '680px',
      data: { proyecto },
    });
  }

  /**
   * Genera y descarga el Acta Oficial de Entrega y Garantía Técnica de 30 días en PDF.
   */
  descargarActaGarantia(p: ProyectoView) {
    generateActaGarantiaPDF({
      proyectoTitulo: p.title,
      clienteNombre: p.clientName || 'Cliente',
      clienteCuit: p.cliente?.taxId || 'No informado',
      proveedorInfra: p.proveedorInfra || 'Hostinger',
      cuentaInfra: p.cuentaInfra || p.cliente?.email || 'Cuenta directa del cliente',
      dominio: p.dominio || 'Dominio del cliente',
      fechaEntrega: p.endDate || new Date().toISOString().split('T')[0],
      garantiaDias: 30,
    });
    this.snackBar.open('🛡️ Acta de Entrega y Garantía Técnica (30 días) descargada con éxito.', 'Cerrar', { duration: 3500 });
  }

  /**
   * Calcula días restantes para un vencimiento.
   */
  diasParaVencimiento(fechaStr?: string): number | null {
    if (!fechaStr) return null;
    const diff = new Date(fechaStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Determina si el hosting o dominio vence en los próximos 30 días.
   */
  alertaVencimiento(p: ProyectoView): boolean {
    const dH = this.diasParaVencimiento(p.vencimientoHosting);
    const dD = this.diasParaVencimiento(p.vencimientoDominio);
    return (dH !== null && dH <= 30) || (dD !== null && dD <= 30);
  }
}


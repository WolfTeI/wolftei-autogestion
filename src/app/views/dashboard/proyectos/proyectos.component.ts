import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { RouterModule } from '@angular/router';
import { ProyectosService, Proyecto } from '../../../service/proyectos.service';
import { ClientesService, Cliente } from '../../../service/clientes.service';
import { WhatsAppService } from '../../../service/whatsapp.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { generateContractPDF, generateNDAPDF, generateBothLegalPDFs } from '../../../utils/contract-pdf-generator';

export interface ProyectoView extends Proyecto {
  clientName?: string;
  clientPhone?: string;
  cliente?: Cliente;
}

export const KANBAN_COLUMNS = [
  { id: 'pendiente',   label: 'Por Iniciar',   icon: 'hourglass_empty', color: '#f59e0b' },
  { id: 'en_progreso', label: 'En Desarrollo', icon: 'engineering',     color: '#3b82f6' },
  { id: 'testing',     label: 'QA / Testing',  icon: 'rule',            color: '#8b5cf6' },
  { id: 'entregado',   label: 'Entregado',     icon: 'task_alt',        color: '#10b981' }
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
    MatDividerModule
  ],
  templateUrl: './proyectos.component.html',
  styleUrls: ['./proyectos.component.scss']
})
export class ProyectosComponent implements OnInit, OnDestroy {
  private proyectosService = inject(ProyectosService);
  private clientesService = inject(ClientesService);
  private whatsAppService = inject(WhatsAppService);
  private snackBar = inject(MatSnackBar);
  private sub?: Subscription;

  proyectos = signal<ProyectoView[]>([]);
  isLoading = signal<boolean>(true);
  vistaModo: 'kanban' | 'tabla' = 'kanban';
  kanbanColumns = KANBAN_COLUMNS;
  displayedColumns: string[] = ['title', 'client', 'phase', 'status', 'actions'];

  ngOnInit(): void {
    this.iniciarEscuchaTiempoReal();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
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
          if (!p.clientId) return of({...p, clientName: 'Desconocido'} as ProyectoView);
          return this.clientesService.getCliente(p.clientId).pipe(
            map(cliente => ({
              ...p,
              clientName: cliente.name,
              clientPhone: cliente.phone,
              cliente: cliente
            }) as ProyectoView),
            catchError(() => of({...p, clientName: 'Desconocido'} as ProyectoView))
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
      if (estadoId === 'testing') return p.status === ('testing' as any);
      return p.status === estadoId;
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
}

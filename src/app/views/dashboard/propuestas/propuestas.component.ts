import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

import { PropuestasService, Propuesta } from '../../../service/propuestas.service';
import { WhatsAppService } from '../../../service/whatsapp.service';
import { ProyectosService } from '../../../service/proyectos.service';
import { ClientesService, Cliente } from '../../../service/clientes.service';
import { EditarClienteDialogComponent } from '../clientes/editar-cliente-dialog/editar-cliente-dialog.component';

/** Configuración de estados para filtros y menú */
const ESTADOS = [
  { value: 'borrador', label: 'Borrador', color: '#888', icon: 'draft' },
  { value: 'enviado', label: 'Enviado', color: '#f59e0b', icon: 'send' },
  { value: 'visto', label: 'Visto', color: '#3b82f6', icon: 'visibility' },
  { value: 'aceptado', label: 'Aceptado', color: '#10b981', icon: 'check_circle' },
  { value: 'en_desarrollo', label: 'En Desarrollo', color: '#8b5cf6', icon: 'code' },
  { value: 'finalizado', label: 'Finalizado', color: '#6b7280', icon: 'done_all' },
  { value: 'cancelado', label: 'Cancelado', color: '#ef4444', icon: 'cancel' },
];

@Component({
  selector: 'app-propuestas',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  templateUrl: './propuestas.component.html',
  styleUrl: './propuestas.component.scss',
})
export class PropuestasComponent implements OnInit, OnDestroy {
  private propuestasService = inject(PropuestasService);
  private proyectosService = inject(ProyectosService);
  private whatsappService = inject(WhatsAppService);
  private clientesService = inject(ClientesService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private sub?: Subscription;

  cargando = signal(true);
  propuestas = signal<Propuesta[]>([]);
  filtroActivo = 'activas';
  columnas = ['numero', 'cliente', 'monto', 'estado', 'fecha', 'acciones'];
  estadosValidos = ESTADOS;

  /** Filtros de la barra superior con conteo dinámico */
  get filtros() {
    const todos = this.propuestas();
    const activas = todos.filter((p) => !p.status || p.status === 'borrador' || p.status === 'enviado' || p.status === 'visto' || p.status === 'aceptado');
    return [
      { value: 'activas', label: 'En Negociación', color: '#667eea', count: activas.length },
      ...ESTADOS.map((e) => ({
        ...e,
        count: todos.filter((p) => p.status === e.value).length,
      })),
      { value: 'todos', label: 'Histórico Total', color: '#94a3b8', count: todos.length },
    ];
  }

  /** Propuestas filtradas según el estado activo */
  get propuestasFiltradas(): Propuesta[] {
    if (this.filtroActivo === 'todos') return this.propuestas();
    if (this.filtroActivo === 'activas') {
      return this.propuestas().filter((p) => !p.status || p.status === 'borrador' || p.status === 'enviado' || p.status === 'visto' || p.status === 'aceptado');
    }
    return this.propuestas().filter((p) => p.status === this.filtroActivo);
  }

  ngOnInit() {
    this.iniciarEscuchaTiempoReal();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  /** Carga y escucha el listado en tiempo real desde Firestore */
  iniciarEscuchaTiempoReal() {
    this.cargando.set(true);
    this.sub = this.propuestasService.listenPropuestas().subscribe({
      next: (data) => {
        this.propuestas.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al escuchar propuestas en tiempo real:', err);
        this.snackBar.open('Error al sincronizar propuestas', 'Cerrar', { duration: 3000 });
        this.cargando.set(false);
      },
    });
  }

  cargarPropuestas() {
    this.sub?.unsubscribe();
    this.iniciarEscuchaTiempoReal();
  }

  setFiltro(valor: string) {
    this.filtroActivo = valor;
  }

  /** Devuelve la etiqueta legible de un estado */
  getStatusLabel(status: string): string {
    return ESTADOS.find((e) => e.value === status)?.label ?? status;
  }

  /** Navega al detalle de la propuesta */
  verDetalle(propuesta: Propuesta) {
    this.router.navigate(['/dashboard/propuestas', propuesta.id]);
  }

  /** Navega a la vista de edición de la propuesta */
  editarPropuesta(propuesta: Propuesta) {
    if (!propuesta.id) return;
    this.router.navigate(['/dashboard/propuestas', propuesta.id, 'editar']);
  }

  /** Copia el link del cliente al portapapeles */
  copiarLink(token: string | undefined) {
    if (!token) return;
    const url = `https://wolftei.com.ar/propuesta/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      this.snackBar.open('¡Link copiado al portapapeles!', '', { duration: 2500 });
    });
  }

  /** Cambia el estado de una propuesta y sincroniza con el Tablero de Proyectos si pasa a desarrollo */
  cambiarEstado(propuesta: Propuesta, nuevoEstado: string) {
    if (!propuesta.id) return;
    this.propuestasService.cambiarEstado(propuesta.id, nuevoEstado).subscribe({
      next: () => {
        this.propuestas.update((lista) =>
          lista.map((p) => (p.id === propuesta.id ? { ...p, status: nuevoEstado } : p))
        );

        // Si se pasa a desarrollo o se acepta, crear/asegurar automáticamente el proyecto en el Kanban
        if (nuevoEstado === 'en_desarrollo' || nuevoEstado === 'aceptado') {
          this.proyectosService.crearOObtenerDesdePropuesta(propuesta).subscribe({
            next: () => {
              const snack = this.snackBar.open(
                `🚀 Estado → "${this.getStatusLabel(nuevoEstado)}" y Proyecto activo en Kanban.`,
                'Ver en Proyectos',
                { duration: 5000 }
              );
              snack.onAction().subscribe(() => {
                this.router.navigate(['/dashboard/proyectos']);
              });
            },
            error: (err) => {
              console.error('Error al sincronizar proyecto en Kanban:', err);
              this.snackBar.open(`Estado actualizado a "${this.getStatusLabel(nuevoEstado)}"`, '', { duration: 2500 });
            }
          });
        } else {
          this.snackBar.open(`Estado actualizado a "${this.getStatusLabel(nuevoEstado)}"`, '', { duration: 2500 });
        }
      },
      error: () => this.snackBar.open('Error al cambiar el estado', 'Cerrar', { duration: 3000 }),
    });
  }

  /** Elimina una propuesta con confirmación simple */
  eliminar(propuesta: Propuesta) {
    if (!propuesta.id) return;
    const ok = confirm(`¿Eliminás la propuesta de ${propuesta.clientPreviewName}? Esta acción no se puede deshacer.`);
    if (!ok) return;

    this.propuestasService.eliminar(propuesta.id).subscribe({
      next: () => {
        this.propuestas.update((lista) => lista.filter((p) => p.id !== propuesta.id));
        this.snackBar.open('Propuesta eliminada.', '', { duration: 2500 });
      },
      error: () => this.snackBar.open('Error al eliminar la propuesta', 'Cerrar', { duration: 3000 }),
    });
  }

  /**
   * Determina si una propuesta requiere seguimiento comercial urgente (más de 48h en enviado o visto).
   */
  esPropuestaFria(p: Propuesta): boolean {
    if (p.status !== 'enviado' && p.status !== 'visto') return false;
    const fechaRef = p.updatedAt || p.createdAt;
    if (!fechaRef) return false;
    const diffHoras = (Date.now() - new Date(fechaRef).getTime()) / (1000 * 60 * 60);
    return diffHoras >= 48;
  }

  /**
   * Abre WhatsApp para enviar la propuesta con link público.
   */
  async enviarPropuestaWhatsApp(p: Propuesta) {
    if (!p.token) return;
    const msg = this.whatsappService.generarMensajePropuesta(
      p.clientPreviewName,
      p.title,
      p.token,
      p.validDays || 15
    );
    await this.whatsappService.abrirChat('', msg);
    this.snackBar.open('Mensaje preparado en WhatsApp y copiado al portapapeles', '', { duration: 3000 });
  }

  /**
   * Abre WhatsApp con mensaje de seguimiento para propuestas frías.
   */
  async enviarSeguimientoWhatsApp(p: Propuesta) {
    if (!p.token) return;
    const msg = this.whatsappService.generarMensajeSeguimientoFria(
      p.clientPreviewName,
      p.title,
      p.token
    );
    await this.whatsappService.abrirChat('', msg);
    this.snackBar.open('Seguimiento comercial abierto en WhatsApp', '', { duration: 3000 });
  }

  /**
   * Abre WhatsApp con felicitación y bienvenida tras aceptación.
   */
  async enviarBienvenidaWhatsApp(p: Propuesta) {
    const msg = this.whatsappService.generarMensajeBienvenidaProyecto(
      p.clientPreviewName,
      p.title
    );
    await this.whatsappService.abrirChat('', msg);
    this.snackBar.open('Mensaje de bienvenida preparado en WhatsApp', '', { duration: 3000 });
  }

  /**
   * Abre diálogo para editar o completar datos fiscales y de contacto del cliente.
   */
  abrirEditarCliente(p: Propuesta) {
    if (p.clientId) {
      this.clientesService.getCliente(p.clientId).subscribe({
        next: (cli) => this.mostrarDialogoCliente(cli, p),
        error: () => this.mostrarDialogoCliente(undefined, p)
      });
    } else {
      this.mostrarDialogoCliente(undefined, p);
    }
  }

  private mostrarDialogoCliente(clienteExistente: Cliente | undefined, p: Propuesta) {
    const dialogRef = this.dialog.open(EditarClienteDialogComponent, {
      width: '640px',
      data: {
        cliente: clienteExistente,
        nombreSugerido: clienteExistente?.name || p.clientPreviewName || p.clientLegalName || '',
        emailSugerido: clienteExistente?.email || p.clientPreviewEmail || p.clientEmail || '',
        cuitSugerido: clienteExistente?.taxId || p.clientTaxId || '',
        propuestaId: p.id,
        proyectoId: p.proyectoId,
      }
    });

    dialogRef.afterClosed().subscribe((res: Cliente | null) => {
      if (res) {
        p.clientPreviewName = res.name;
        p.clientId = res.id;
        p.clientPreviewEmail = res.email;
        p.clientTaxId = res.taxId;
        this.propuestas.update(list => [...list]);
      }
    });
  }
}


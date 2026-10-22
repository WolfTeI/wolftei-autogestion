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
import { Subscription } from 'rxjs';

import { PropuestasService, Propuesta } from '../../../service/propuestas.service';
import { WhatsAppService } from '../../../service/whatsapp.service';

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
  ],
  templateUrl: './propuestas.component.html',
  styleUrl: './propuestas.component.scss',
})
export class PropuestasComponent implements OnInit, OnDestroy {
  private propuestasService = inject(PropuestasService);
  private whatsappService = inject(WhatsAppService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private sub?: Subscription;

  cargando = signal(true);
  propuestas = signal<Propuesta[]>([]);
  filtroActivo = 'todos';
  columnas = ['numero', 'cliente', 'monto', 'estado', 'fecha', 'acciones'];
  estadosValidos = ESTADOS;

  /** Filtros de la barra superior con conteo dinámico */
  get filtros() {
    const todos = this.propuestas();
    return [
      { value: 'todos', label: 'Todos', color: '#667eea', count: todos.length },
      ...ESTADOS.map((e) => ({
        ...e,
        count: todos.filter((p) => p.status === e.value).length,
      })),
    ];
  }

  /** Propuestas filtradas según el estado activo */
  get propuestasFiltradas(): Propuesta[] {
    if (this.filtroActivo === 'todos') return this.propuestas();
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

  /** Cambia el estado de una propuesta */
  cambiarEstado(propuesta: Propuesta, nuevoEstado: string) {
    if (!propuesta.id) return;
    this.propuestasService.cambiarEstado(propuesta.id, nuevoEstado).subscribe({
      next: () => {
        this.propuestas.update((lista) =>
          lista.map((p) => (p.id === propuesta.id ? { ...p, status: nuevoEstado } : p))
        );
        this.snackBar.open(`Estado actualizado a "${this.getStatusLabel(nuevoEstado)}"`, '', { duration: 2500 });
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
}


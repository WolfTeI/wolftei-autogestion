import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ClientesService, Cliente, ServicioMantenimiento, EstadoPagoSoporte } from '../../../../service/clientes.service';
import { ProyectosService, Proyecto } from '../../../../service/proyectos.service';
import { PropuestasService, Propuesta } from '../../../../service/propuestas.service';
import { WhatsAppService } from '../../../../service/whatsapp.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { generateContractPDF, generateNDAPDF, generateBothLegalPDFs } from '../../../../utils/contract-pdf-generator';
import { EditarClienteDialogComponent } from '../editar-cliente-dialog/editar-cliente-dialog.component';
import { EliminarClienteDialogComponent } from '../eliminar-cliente-dialog/eliminar-cliente-dialog.component';
import { NuevoProyectoDialogComponent } from '../../proyectos/nuevo-proyecto-dialog/nuevo-proyecto-dialog.component';
import { ServicioMantenimientoDialogComponent } from '../servicio-mantenimiento-dialog/servicio-mantenimiento-dialog.component';

@Component({
  selector: 'app-detalle-cliente',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    RouterModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatListModule,
    MatSnackBarModule,
    MatMenuModule,
    MatTooltipModule,
    MatDialogModule
  ],
  templateUrl: './detalle-cliente.component.html',
  styleUrls: ['./detalle-cliente.component.scss']
})
export class DetalleClienteComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private clientesService = inject(ClientesService);
  private proyectosService = inject(ProyectosService);
  private propuestasService = inject(PropuestasService);
  private whatsAppService = inject(WhatsAppService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  cliente = signal<Cliente | null>(null);
  proyectos = signal<Proyecto[]>([]);
  propuestas = signal<Propuesta[]>([]);
  isLoading = signal<boolean>(true);

  async contactarWhatsApp(): Promise<void> {
    const cli = this.cliente();
    if (!cli?.phone) {
      this.snackBar.open('⚠️ El cliente no tiene teléfono registrado.', 'Cerrar', { duration: 3000 });
      return;
    }
    this.snackBar.open(`💬 Abriendo chat con ${cli.name}...`, 'Cerrar', { duration: 3000 });
    await this.whatsAppService.abrirChat(cli.phone, `¡Hola ${cli.name}! Te escribo desde WolfTeI.`);
  }

  descargarContrato(): void {
    const cli = this.cliente();
    if (!cli) return;
    generateContractPDF(cli);
    this.snackBar.open('📄 Contrato de Desarrollo generado con éxito.', 'Cerrar', { duration: 3000 });
  }

  descargarNDA(): void {
    const cli = this.cliente();
    if (!cli) return;
    generateNDAPDF(cli);
    this.snackBar.open('🔒 Acuerdo de Confidencialidad (NDA) generado con éxito.', 'Cerrar', { duration: 3000 });
  }

  descargarAmbos(): void {
    const cli = this.cliente();
    if (!cli) return;
    generateBothLegalPDFs(cli);
    this.snackBar.open('📦 Contrato de Desarrollo y NDA generados con éxito.', 'Cerrar', { duration: 3000 });
  }

  abrirEditarClienteDialog(): void {
    const current = this.cliente();
    if (!current) return;
    const dialogRef = this.dialog.open(EditarClienteDialogComponent, {
      width: '600px',
      disableClose: true,
      autoFocus: true,
      data: { cliente: current }
    });

    dialogRef.afterClosed().subscribe((clienteActualizado) => {
      if (clienteActualizado && current.id) {
        this.cargarDatos(current.id);
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cargarDatos(id);
    }
  }

  cargarDatos(id: string) {
    this.isLoading.set(true);
    this.clientesService.getCliente(id).subscribe({
      next: (clienteData) => {
        this.cliente.set(clienteData);
        this.cargarProyectos(id);
        this.cargarPropuestas(id, clienteData.name);
      },
      error: (err) => {
        console.error('Error al cargar cliente:', err);
        this.isLoading.set(false);
      }
    });
  }

  cargarProyectos(clientId: string) {
    this.proyectosService.getProyectosPorCliente(clientId).subscribe({
      next: (proyectosData) => {
        this.proyectos.set(proyectosData);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar proyectos del cliente:', err);
        this.isLoading.set(false);
      }
    });
  }

  cargarPropuestas(clientId: string, clientName?: string) {
    this.propuestasService.listenPropuestas().subscribe({
      next: (props) => {
        const delCliente = props.filter(
          p => p.clientId === clientId || (clientName && p.clientPreviewName?.trim().toLowerCase() === clientName.trim().toLowerCase())
        );
        this.propuestas.set(delCliente);
      },
      error: (err) => console.warn('Error al cargar propuestas asociadas al cliente:', err)
    });
  }

  goBack() {
    this.location.back();
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'entregado': return 'primary';
      case 'en_progreso': return 'accent';
      case 'pendiente':
      case 'esperando_anticipo': return 'warn';
      default: return '';
    }
  }

  confirmarEliminarCliente(): void {
    const cli = this.cliente();
    if (!cli || !cli.id) return;

    const dialogRef = this.dialog.open(EliminarClienteDialogComponent, {
      width: '450px',
      disableClose: true,
      data: { cliente: cli }
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (confirmado && cli.id) {
        this.clientesService.eliminarCliente(cli.id).subscribe({
          next: () => {
            this.snackBar.open(`🗑️ Cliente "${cli.name}" eliminado correctamente.`, 'Entendido', {
              duration: 3500
            });
            this.router.navigate(['/dashboard/clientes']);
          },
          error: (err) => {
            console.error('Error al eliminar cliente:', err);
            this.snackBar.open('Error al eliminar el cliente. Intentá nuevamente.', 'Cerrar', {
              duration: 4000
            });
          }
        });
      }
    });
  }

  // ── Nuevo Flujo Jerárquico: Iniciar Proyecto desde Cliente ──

  iniciarProyectoParaCliente(): void {
    const cli = this.cliente();
    if (!cli) return;

    const dialogRef = this.dialog.open(NuevoProyectoDialogComponent, {
      width: '680px',
      data: { cliente: cli, clientId: cli.id },
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res && res.id) {
        this.cargarProyectos(cli.id!);
        this.router.navigate(['/dashboard/proyectos', res.id]);
      }
    });
  }

  // ── Gestión de Abonos y Servicios de Mantenimiento ──

  abrirNuevoServicioSoporte(): void {
    const cli = this.cliente();
    if (!cli) return;

    const dialogRef = this.dialog.open(ServicioMantenimientoDialogComponent, {
      width: '640px',
      data: { cliente: cli, proyectos: this.proyectos() },
    });

    dialogRef.afterClosed().subscribe((guardado) => {
      if (guardado) {
        this.cargarDatos(cli.id!);
      }
    });
  }

  editarServicioSoporte(servicio: ServicioMantenimiento): void {
    const cli = this.cliente();
    if (!cli) return;

    const dialogRef = this.dialog.open(ServicioMantenimientoDialogComponent, {
      width: '640px',
      data: { cliente: cli, proyectos: this.proyectos(), servicio },
    });

    dialogRef.afterClosed().subscribe((guardado) => {
      if (guardado) {
        this.cargarDatos(cli.id!);
      }
    });
  }

  cambiarEstadoPagoSoporte(servicio: ServicioMantenimiento, estado: EstadoPagoSoporte): void {
    const cli = this.cliente();
    if (!cli || !cli.id) return;

    this.clientesService.actualizarServicioSoporte(cli.id, servicio.id, { estadoPago: estado }).subscribe({
      next: () => {
        this.snackBar.open(`Estado de abono actualizado a "${estado.replace('_', ' ').toUpperCase()}".`, '', { duration: 2500 });
        this.cargarDatos(cli.id!);
      },
      error: (e) => console.error(e),
    });
  }

  eliminarServicioSoporte(servicio: ServicioMantenimiento): void {
    const cli = this.cliente();
    if (!cli || !cli.id) return;

    const ok = window.confirm(`¿Deseás eliminar el abono "${servicio.nombre}" de este cliente?`);
    if (!ok) return;

    this.clientesService.eliminarServicioSoporte(cli.id, servicio.id).subscribe({
      next: () => {
        this.snackBar.open('Abono de soporte eliminado.', '', { duration: 2500 });
        this.cargarDatos(cli.id!);
      },
      error: (e) => console.error(e),
    });
  }
}

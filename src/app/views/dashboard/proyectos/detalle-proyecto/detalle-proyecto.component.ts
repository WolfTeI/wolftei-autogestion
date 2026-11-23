import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';

import { ProyectosService, Proyecto } from '../../../../service/proyectos.service';
import { PropuestasService, Propuesta } from '../../../../service/propuestas.service';
import { PagosService, Pago } from '../../../../service/pagos.service';
import { ClientesService, Cliente } from '../../../../service/clientes.service';
import { InformesTecnicosService, InformeTecnico } from '../../../../service/informes-tecnicos.service';

import { generateContractPDF, generateNDAPDF } from '../../../../utils/contract-pdf-generator';
import { generateActaGarantiaPDF } from '../../../../utils/acta-garantia-pdf-generator';
import { generateReceiptPDF } from '../../../../utils/receipt-pdf-generator';
import { BovedaCredencialesDialogComponent } from '../boveda-dialog/boveda-dialog.component';
import { NuevaVersionDialogComponent } from '../nueva-version-dialog/nueva-version-dialog.component';
import { RegistrarPagoDialogComponent, RegistrarPagoDialogData } from '../../propuestas/detalle-propuesta/registrar-pago-dialog/registrar-pago-dialog.component';

export interface ProyectoView extends Proyecto {
  clientName?: string;
  clientPhone?: string;
  cliente?: Cliente;
}

const ESTADOS_PROYECTO = [
  { id: 'esperando_anticipo', label: 'Esperando Pago',  color: '#f59e0b', icon: 'pending_actions' },
  { id: 'en_progreso',        label: 'En Desarrollo',   color: '#3b82f6', icon: 'engineering' },
  { id: 'testing',            label: 'QA / Testing',    color: '#8b5cf6', icon: 'rule' },
  { id: 'entregado',          label: 'Entregado',       color: '#10b981', icon: 'task_alt' },
  { id: 'archivado',          label: 'Archivado',       color: '#94a3b8', icon: 'archive' }
];

@Component({
  selector: 'app-detalle-proyecto',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTabsModule,
    MatTableModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatDividerModule,
    MatChipsModule
  ],
  templateUrl: './detalle-proyecto.component.html',
  styleUrls: ['./detalle-proyecto.component.scss']
})
export class DetalleProyectoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  private proyectosService = inject(ProyectosService);
  private propuestasService = inject(PropuestasService);
  private pagosService = inject(PagosService);
  private clientesService = inject(ClientesService);
  private informesService = inject(InformesTecnicosService);

  cargando = signal<boolean>(true);
  proyecto = signal<ProyectoView | null>(null);
  propuesta = signal<Propuesta | null>(null);
  informe = signal<InformeTecnico | null>(null);
  cliente = signal<Cliente | null>(null);
  pagos = signal<Pago[]>([]);

  estadosValidos = ESTADOS_PROYECTO;
  columnasPagos: string[] = ['receipt', 'date', 'concept', 'method', 'amount', 'actions'];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cargarProyecto(id);
    } else {
      this.router.navigate(['/dashboard/proyectos']);
    }
  }

  cargarProyecto(id: string): void {
    this.cargando.set(true);
    this.proyectosService.getProyecto(id).subscribe({
      next: (proj) => {
        const view: ProyectoView = { ...proj };
        this.proyecto.set(view);

        // 1. Cargar Cliente si existe
        if (proj.clientId) {
          this.clientesService.getCliente(proj.clientId).subscribe({
            next: (cli) => {
              this.cliente.set(cli);
              view.cliente = cli;
              view.clientName = cli.name;
              view.clientPhone = cli.phone;
              this.proyecto.set({ ...view });
            },
            error: () => {}
          });
        }

        // 2. Cargar Propuesta Comercial si está vinculada
        if (proj.propuestaId) {
          this.propuestasService.getById(proj.propuestaId).subscribe({
            next: (prop) => this.propuesta.set(prop),
            error: () => {}
          });

          // 3. Cargar pagos vinculados a la propuesta
          this.pagosService.listarPorPropuesta(proj.propuestaId).subscribe({
            next: (lista) => this.pagos.set(lista),
            error: () => {}
          });
        } else if (proj.clientId) {
          // Si no tiene propuestaId, buscar pagos por cliente
          this.pagosService.listarPorCliente(proj.clientId).subscribe({
            next: (lista) => this.pagos.set(lista),
            error: () => {}
          });
        }

        // 4. Buscar si existe Informe Técnico asociado
        this.informesService.listenInformes().subscribe({
          next: (informes) => {
            const inf = informes.find(i => 
              (proj.clientId && i.clientId === proj.clientId) || 
              (proj.clientName && i.clientName.toLowerCase() === proj.clientName.toLowerCase())
            );
            if (inf) this.informe.set(inf);
          },
          error: () => {}
        });

        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar proyecto:', err);
        this.snackBar.open('No se pudo encontrar el proyecto.', 'Cerrar', { duration: 3500 });
        this.router.navigate(['/dashboard/proyectos']);
      }
    });
  }

  volver(): void {
    this.router.navigate(['/dashboard/proyectos']);
  }

  // ── Métricas y Cálculos Financieros ──
  get totalInversion(): number {
    return this.proyecto()?.totalAmount || 0;
  }

  get totalCobrado(): number {
    return this.pagos().reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }

  get saldoRestante(): number {
    return Math.max(0, this.totalInversion - this.totalCobrado);
  }

  get porcentajeCobrado(): number {
    if (this.totalInversion <= 0) return 0;
    return Math.min(100, Math.round((this.totalCobrado / this.totalInversion) * 100));
  }

  getEstadoInfo(status?: string) {
    const s = status || this.proyecto()?.status || 'esperando_anticipo';
    return ESTADOS_PROYECTO.find(e => e.id === s) || ESTADOS_PROYECTO[0];
  }

  // ── Acciones de Estado del Proyecto ──
  cambiarEstado(nuevoEstado: string): void {
    const p = this.proyecto();
    if (!p?.id || p.status === nuevoEstado) return;

    if (nuevoEstado === 'entregado') {
      this.entregarProyecto();
      return;
    }

    this.proyectosService.actualizarProyecto(p.id, { status: nuevoEstado as any }).subscribe({
      next: () => {
        this.proyecto.update(prev => prev ? { ...prev, status: nuevoEstado as any } : prev);
        this.snackBar.open(`Estado actualizado a "${this.getEstadoInfo(nuevoEstado).label}"`, '', { duration: 2500 });
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Error al cambiar el estado del proyecto.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  entregarProyecto(): void {
    const p = this.proyecto();
    if (!p?.id) return;

    this.proyectosService.generarLinkEncuesta(p.id).subscribe({
      next: (res) => {
        this.proyecto.update(prev => prev ? { 
          ...prev, 
          status: 'entregado', 
          reviewToken: res.reviewToken 
        } : prev);

        const fullLink = `https://wolftei.com.ar/feedback/${res.reviewToken}`;
        navigator.clipboard.writeText(fullLink).then(() => {
          this.snackBar.open('✅ Proyecto Entregado. Link de reseña copiado al portapapeles.', 'Cerrar', { duration: 5000 });
        });
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Error al registrar entrega del proyecto.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  copiarLinkEncuesta(): void {
    const token = this.proyecto()?.reviewToken;
    if (!token) return;
    const url = `https://wolftei.com.ar/feedback/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      this.snackBar.open('¡Enlace de encuesta copiado!', '', { duration: 2500 });
    });
  }

  // ── Acciones Financieras y Recibos ──
  abrirRegistrarPago(): void {
    const p = this.proyecto();
    if (!p) return;

    const dialogRef = this.dialog.open(RegistrarPagoDialogComponent, {
      width: '540px',
      data: {
        propuestaId: p.propuestaId || '',
        clientId: p.clientId,
        clientName: p.clientName || 'Cliente',
        currency: p.currency,
        totalAmount: p.totalAmount,
        saldoPendiente: this.saldoRestante,
      } as RegistrarPagoDialogData,
    });

    dialogRef.afterClosed().subscribe((pagoRegistrado) => {
      if (pagoRegistrado) {
        if (p.id) this.cargarProyecto(p.id);
        this.snackBar.open('✅ Cobro acreditado con éxito.', 'Cerrar', { duration: 3500 });
      }
    });
  }

  descargarRecibo(pago: Pago): void {
    const p = this.proyecto();
    const cli = this.cliente();
    generateReceiptPDF({
      pago,
      clientName: p?.clientName || cli?.name || 'Cliente',
      clientTaxId: cli?.taxId,
      projectTitle: p?.title || 'Servicios Digitales y Desarrollo de Software',
      totalAmount: this.totalInversion,
      saldoRestante: this.saldoRestante
    });
    this.snackBar.open(`📄 Recibo oficial ${pago.receiptNumber || ''} descargado.`, '', { duration: 3000 });
  }

  // ── Documentos Legales ──
  descargarContrato(): void {
    const p = this.proyecto();
    const cli = this.cliente() || {
      id: p?.clientId || '',
      name: p?.clientName || 'Cliente',
      email: p?.clientEmail || '',
      company: p?.clientCompany || '',
      phone: p?.clientPhone || '',
      address: '',
      taxId: p?.clientTaxId || ''
    };
    generateContractPDF(cli, {
      title: p?.title || 'Proyecto de Software',
      totalAmount: p?.totalAmount || 0,
      currency: p?.currency || 'USD'
    } as any);
    this.snackBar.open('📄 Contrato de Desarrollo de Software descargado.', 'Cerrar', { duration: 3000 });
  }

  descargarNDA(): void {
    const p = this.proyecto();
    const cli = this.cliente() || {
      id: p?.clientId || '',
      name: p?.clientName || 'Cliente',
      email: p?.clientEmail || '',
      company: p?.clientCompany || '',
      phone: p?.clientPhone || '',
      address: '',
      taxId: p?.clientTaxId || ''
    };
    generateNDAPDF(cli, {
      title: p?.title || 'Proyecto de Software'
    } as any);
    this.snackBar.open('🔒 Acuerdo de Confidencialidad NDA descargado.', 'Cerrar', { duration: 3000 });
  }

  descargarActaGarantia(): void {
    const p = this.proyecto();
    const cli = this.cliente();
    generateActaGarantiaPDF({
      proyectoTitulo: p?.title || 'Proyecto de Software',
      clienteNombre: p?.clientName || cli?.name || 'Cliente',
      clienteCuit: cli?.taxId || p?.clientTaxId || 'No informado',
      proveedorInfra: p?.proveedorInfra || 'Hostinger / Cloudflare',
      cuentaInfra: p?.cuentaInfra || cli?.email || 'Cuenta directa del cliente',
      dominio: p?.dominio || 'Dominio oficial del cliente',
      fechaEntrega: p?.endDate || new Date().toISOString().split('T')[0],
      garantiaDias: 30,
    });
    this.snackBar.open('🛡️ Acta Oficial de Entrega y Garantía Técnica descargada.', 'Cerrar', { duration: 3500 });
  }

  abrirBoveda(): void {
    const p = this.proyecto();
    if (!p) return;
    this.dialog.open(BovedaCredencialesDialogComponent, {
      width: '680px',
      data: { proyecto: p }
    });
  }

  abrirNuevaVersion(): void {
    const p = this.proyecto();
    if (!p) return;
    const dialogRef = this.dialog.open(NuevaVersionDialogComponent, {
      width: '620px',
      data: { proyectoMadre: p }
    });
    dialogRef.afterClosed().subscribe((res) => {
      if (res && p.id) {
        this.cargarProyecto(p.id);
      }
    });
  }
}

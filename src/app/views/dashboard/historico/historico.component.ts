import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { combineLatest, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ProyectosService, Proyecto } from '../../../service/proyectos.service';
import { ClientesService, Cliente } from '../../../service/clientes.service';
import { PropuestasService, Propuesta } from '../../../service/propuestas.service';
import { PagosService, Pago } from '../../../service/pagos.service';
import { WhatsAppService } from '../../../service/whatsapp.service';
import { ExpedienteDialogComponent, ExpedienteDialogData } from './expediente-dialog/expediente-dialog.component';
import { EditarClienteDialogComponent } from '../clientes/editar-cliente-dialog/editar-cliente-dialog.component';

export interface ProyectoHistoricoView extends Proyecto {
  clientName: string;
  clientPhone?: string;
  cliente?: Cliente;
  propuesta?: Propuesta;
  pagos: Pago[];
  diasDesdeEntrega: number;
  garantiaVencida: boolean;
}

@Component({
  selector: 'app-historico',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CurrencyPipe,
    DatePipe,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  templateUrl: './historico.component.html',
  styleUrl: './historico.component.scss',
})
export class HistoricoComponent implements OnInit, OnDestroy {
  private proyectosService = inject(ProyectosService);
  private clientesService = inject(ClientesService);
  private propuestasService = inject(PropuestasService);
  private pagosService = inject(PagosService);
  private whatsAppService = inject(WhatsAppService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);

  private sub?: Subscription;

  cargando = signal<boolean>(true);
  proyectos = signal<Proyecto[]>([]);
  clientes = signal<Cliente[]>([]);
  propuestas = signal<Propuesta[]>([]);
  pagos = signal<Pago[]>([]);

  busqueda = signal<string>('');
  columnas = ['fecha', 'proyecto', 'cliente', 'inversion', 'resena', 'garantia', 'acciones'];

  // Proyectos que están en el archivo histórico
  proyectosHistoricos = computed<ProyectoHistoricoView[]>(() => {
    const listProy = this.proyectos().filter((p) => p.status === 'archivado' || p.status === 'entregado' || p.status === 'cancelado');
    const clientsMap = new Map(this.clientes().map((c) => [c.id, c]));
    const propsMap = new Map(this.propuestas().map((pr) => [pr.id, pr]));
    const pagosList = this.pagos();

    return listProy.map((p) => {
      const cli = p.clientId ? clientsMap.get(p.clientId) : undefined;
      const prop = p.propuestaId ? propsMap.get(p.propuestaId) : undefined;
      const pagosProy = pagosList.filter((pg) => pg.propuestaId === p.propuestaId || pg.clientId === p.clientId);

      const fechaBase = p.actaGarantiaFecha || p.endDate || p.updatedAt || p.createdAt || '';
      const dias = fechaBase ? Math.floor((Date.now() - new Date(fechaBase).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const garantiaVencida = dias > 30;

      return {
        ...p,
        clientName: cli ? cli.name : 'Cliente',
        clientPhone: cli?.phone,
        cliente: cli,
        propuesta: prop,
        pagos: pagosProy,
        diasDesdeEntrega: dias,
        garantiaVencida,
      };
    }).sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
  });

  proyectosFiltrados = computed<ProyectoHistoricoView[]>(() => {
    const q = this.busqueda().trim().toLowerCase();
    const lista = this.proyectosHistoricos();
    if (!q) return lista;

    return lista.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.clientName.toLowerCase().includes(q)
    );
  });

  // KPIs del archivo
  totalArchivados = computed(() => this.proyectosHistoricos().length);

  montoTotalHistoricoUSD = computed(() => {
    return this.proyectosHistoricos()
      .filter((p) => p.currency === 'USD')
      .reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
  });

  oportunidadesMantenimiento = computed(() => {
    return this.proyectosHistoricos().filter((p) => p.garantiaVencida && p.status !== 'cancelado').length;
  });

  ngOnInit(): void {
    this.iniciarEscucha();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  iniciarEscucha(): void {
    this.cargando.set(true);
    this.sub = combineLatest({
      proyectos: this.proyectosService.listenProyectos().pipe(catchError(() => of([]))),
      clientes: this.clientesService.listenClientes().pipe(catchError(() => of([]))),
      propuestas: this.propuestasService.listenPropuestas().pipe(catchError(() => of([]))),
      pagos: this.pagosService.listenPagos().pipe(catchError(() => of([]))),
    }).subscribe({
      next: (data) => {
        this.proyectos.set(data.proyectos);
        this.clientes.set(data.clientes);
        this.propuestas.set(data.propuestas);
        this.pagos.set(data.pagos);
        this.cargando.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al escuchar archivo histórico:', err);
        this.cargando.set(false);
      },
    });
  }

  abrirExpediente(p: ProyectoHistoricoView): void {
    this.dialog.open(ExpedienteDialogComponent, {
      width: '800px',
      maxHeight: '90vh',
      data: {
        proyecto: p,
        cliente: p.cliente,
        propuesta: p.propuesta,
        pagos: p.pagos,
      } as ExpedienteDialogData,
    });
  }

  abrirEditarCliente(p: ProyectoHistoricoView): void {
    const dialogRef = this.dialog.open(EditarClienteDialogComponent, {
      width: '640px',
      data: {
        cliente: p.cliente,
        nombreSugerido: p.cliente?.name || p.clientName || 'Cliente',
        emailSugerido: p.cliente?.email || p.clientEmail || '',
        telefonoSugerido: p.cliente?.phone || p.clientPhone || '',
        cuitSugerido: p.cliente?.taxId || p.clientTaxId || '',
        proyectoId: p.id,
        propuestaId: p.propuestaId,
      }
    });

    dialogRef.afterClosed().subscribe((res: Cliente | null) => {
      if (res) {
        p.cliente = res;
        p.clientName = res.name;
        p.clientPhone = res.phone;
        p.clientTaxId = res.taxId;
        p.clientEmail = res.email;
        this.proyectos.update(list => [...list]);
      }
    });
  }

  ofrecerMantenimiento(p: ProyectoHistoricoView): void {
    if (!p.clientPhone) {
      this.snackBar.open('El cliente no tiene teléfono registrado.', 'Cerrar', { duration: 3000 });
      return;
    }
    this.whatsAppService.abrirVencimientoGarantia(p.clientPhone, p.clientName, p.title);
  }

  desarchivarAProyectos(p: ProyectoHistoricoView): void {
    if (!p.id) return;
    const ok = confirm(`¿Reactivar "${p.title}" y devolverlo al Tablero Kanban de Proyectos activos?`);
    if (!ok) return;

    this.proyectosService.actualizarProyecto(p.id, {
      status: 'en_progreso',
      archivadoFecha: null,
    }).subscribe({
      next: () => {
        this.snackBar.open(`🚀 Proyecto "${p.title}" devuelto al Tablero Kanban.`, 'Cerrar', { duration: 3500 });
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Error al reactivar el proyecto.', 'Cerrar', { duration: 3000 });
      },
    });
  }
}

import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { combineLatest, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { PagosService, Pago } from '../../../service/pagos.service';
import { PropuestasService, Propuesta } from '../../../service/propuestas.service';
import { ProyectosService, Proyecto } from '../../../service/proyectos.service';
import { ClientesService, Cliente } from '../../../service/clientes.service';
import { generateReceiptPDF, ReceiptData } from '../../../utils/receipt-pdf-generator';
import { RegistrarPagoDialogComponent, RegistrarPagoDialogData } from '../propuestas/detalle-propuesta/registrar-pago-dialog/registrar-pago-dialog.component';

export interface CuentaPorCobrar {
  propuestaId: string;
  clientId?: string;
  clientName: string;
  projectTitle: string;
  currency: 'ARS' | 'USD';
  totalAmount: number;
  totalCobrado: number;
  saldoPendiente: number;
  porcentajeCobrado: number;
  estado: string;
}

export interface ResenaCliente {
  proyectoId: string;
  proyectoTitle: string;
  clientId?: string;
  clientName: string;
  stars: number;
  comment: string;
  fecha: string;
  publicada: boolean;
  token?: string | null;
}

@Component({
  selector: 'app-finanzas',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    MatCardModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  templateUrl: './finanzas.component.html',
  styleUrl: './finanzas.component.scss',
})
export class FinanzasComponent implements OnInit, OnDestroy {
  private pagosService = inject(PagosService);
  private propuestasService = inject(PropuestasService);
  private proyectosService = inject(ProyectosService);
  private clientesService = inject(ClientesService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);

  private sub?: Subscription;

  cargando = signal<boolean>(true);
  pagos = signal<Pago[]>([]);
  propuestas = signal<Propuesta[]>([]);
  proyectos = signal<Proyecto[]>([]);
  clientes = signal<Cliente[]>([]);

  // Columnas para tablas
  columnasPagos: string[] = ['fecha', 'recibo', 'cliente', 'concepto', 'metodo', 'monto', 'acciones'];
  columnasPendientes: string[] = ['cliente', 'proyecto', 'total', 'cobrado', 'saldo', 'acciones'];

  // ── Métricas Computadas ──
  totalCobradoUSD = computed(() => {
    return this.pagos()
      .filter((p) => p.currency === 'USD')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  });

  totalCobradoARS = computed(() => {
    return this.pagos()
      .filter((p) => p.currency === 'ARS')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  });

  cuentasPorCobrar = computed<CuentaPorCobrar[]>(() => {
    const props = this.propuestas().filter(
      (p) => p.status === 'aceptado' || p.status === 'en_desarrollo' || p.status === 'finalizado'
    );
    const pagosList = this.pagos();

    return props.map((prop) => {
      const pagosDeProp = pagosList.filter((pg) => pg.propuestaId === prop.id);
      const totalCobrado = pagosDeProp.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      const totalAmount = Number(prop.totalAmount) || 0;
      const saldoPendiente = Math.max(0, totalAmount - totalCobrado);
      const porcentajeCobrado = totalAmount > 0 ? Math.round((totalCobrado / totalAmount) * 100) : 0;

      return {
        propuestaId: prop.id || '',
        clientId: prop.clientId,
        clientName: prop.clientPreviewName || 'Cliente',
        projectTitle: prop.title || 'Proyecto sin título',
        currency: (prop.currency as 'ARS' | 'USD') || 'USD',
        totalAmount,
        totalCobrado,
        saldoPendiente,
        porcentajeCobrado,
        estado: prop.status || 'aceptado',
      };
    }).filter((c) => c.saldoPendiente > 0);
  });

  saldoPendienteUSD = computed(() => {
    return this.cuentasPorCobrar()
      .filter((c) => c.currency === 'USD')
      .reduce((acc, curr) => acc + curr.saldoPendiente, 0);
  });

  saldoPendienteARS = computed(() => {
    return this.cuentasPorCobrar()
      .filter((c) => c.currency === 'ARS')
      .reduce((acc, curr) => acc + curr.saldoPendiente, 0);
  });

  // ── Reseñas y Satisfacción ──
  resenas = computed<ResenaCliente[]>(() => {
    const list: ResenaCliente[] = [];
    const clientsMap = new Map(this.clientes().map((c) => [c.id, c.name]));

    for (const proy of this.proyectos()) {
      if (proy.reviewCompleted && proy.reviewStars) {
        list.push({
          proyectoId: proy.id || '',
          proyectoTitle: proy.title,
          clientId: proy.clientId,
          clientName: clientsMap.get(proy.clientId) || 'Cliente',
          stars: proy.reviewStars,
          comment: proy.reviewComment || '',
          fecha: proy.updatedAt || proy.createdAt || new Date().toISOString(),
          publicada: !!proy.reviewPublicada,
          token: proy.reviewToken,
        });
      }
    }

    return list.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  });

  promedioEstrellas = computed<number>(() => {
    const items = this.resenas();
    if (items.length === 0) return 5.0;
    const sum = items.reduce((acc, r) => acc + r.stars, 0);
    return Number((sum / items.length).toFixed(1));
  });

  tasaSatisfaccion = computed<number>(() => {
    const items = this.resenas();
    if (items.length === 0) return 100;
    const positivas = items.filter((r) => r.stars >= 4).length;
    return Math.round((positivas / items.length) * 100);
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
      pagos: this.pagosService.listenPagos().pipe(catchError(() => of([]))),
      propuestas: this.propuestasService.listenPropuestas().pipe(catchError(() => of([]))),
      proyectos: this.proyectosService.listenProyectos().pipe(catchError(() => of([]))),
      clientes: this.clientesService.listenClientes().pipe(catchError(() => of([]))),
    }).subscribe({
      next: (data) => {
        this.pagos.set(data.pagos);
        this.propuestas.set(data.propuestas);
        this.proyectos.set(data.proyectos);
        this.clientes.set(data.clientes);
        this.cargando.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al escuchar datos financieros:', err);
        this.cargando.set(false);
      },
    });
  }

  // ── Acciones de Cobranza y Recibos ──

  getNombreClientePorId(clientId?: string | null): string {
    if (!clientId) return 'Cliente General';
    const c = this.clientes().find((cli) => cli.id === clientId);
    return c ? c.name : 'Cliente';
  }

  descargarRecibo(pago: Pago): void {
    const propuesta = this.propuestas().find((p) => p.id === pago.propuestaId);
    const cliente = this.clientes().find((c) => c.id === pago.clientId || c.id === propuesta?.clientId);

    const clientName = cliente?.name || propuesta?.clientPreviewName || 'Cliente';
    const clientTaxId = cliente?.taxId || '';
    const projectTitle = propuesta?.title || 'Servicios Digitales y Desarrollo de Software';
    const totalAmount = propuesta?.totalAmount;

    // Calcular saldo restante si está vinculado a una propuesta
    let saldoRestante: number | undefined;
    if (propuesta && propuesta.totalAmount) {
      const todosLosPagos = this.pagos().filter((p) => p.propuestaId === propuesta.id);
      const totalPagado = todosLosPagos.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      saldoRestante = Math.max(0, Number(propuesta.totalAmount) - totalPagado);
    }

    const data: ReceiptData = {
      pago,
      clientName,
      clientTaxId,
      projectTitle,
      totalAmount,
      saldoRestante,
    };

    try {
      generateReceiptPDF(data);
      this.snackBar.open(`📄 Recibo oficial ${pago.receiptNumber || ''} generado y descargado con éxito.`, 'Cerrar', {
        duration: 3500,
      });
    } catch (err) {
      console.error('Error al generar recibo en PDF:', err);
      this.snackBar.open('Error al generar el recibo en PDF.', 'Cerrar', { duration: 3500 });
    }
  }

  cobrarCuentaPendiente(cuenta: CuentaPorCobrar): void {
    const dialogRef = this.dialog.open(RegistrarPagoDialogComponent, {
      width: '540px',
      data: {
        propuestaId: cuenta.propuestaId,
        clientId: cuenta.clientId,
        clientName: cuenta.clientName,
        currency: cuenta.currency,
        totalAmount: cuenta.totalAmount,
        saldoPendiente: cuenta.saldoPendiente,
      } as RegistrarPagoDialogData,
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) {
        this.snackBar.open('✅ Cobro registrado y acreditado en la cuenta corriente.', 'Cerrar', { duration: 3500 });
      }
    });
  }

  eliminarCobro(pago: Pago): void {
    if (!pago.id) return;
    const confirmacion = window.confirm(
      `¿Estás seguro de que deseás anular el recibo ${pago.receiptNumber || ''} por ${pago.amount} ${pago.currency}?`
    );
    if (!confirmacion) return;

    this.pagosService.eliminar(pago.id).subscribe({
      next: () => {
        this.snackBar.open('Recibo anulado y cobro eliminado.', '', { duration: 3000 });
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Error al anular el cobro.', 'Cerrar', { duration: 3500 });
      },
    });
  }

  exportarLibroCobranzasCSV(): void {
    const lista = this.pagos();
    if (lista.length === 0) {
      this.snackBar.open('No hay registros de cobranza para exportar.', 'Cerrar', { duration: 3000 });
      return;
    }

    const headers = ['Fecha', 'Recibo Nro', 'Cliente', 'Concepto', 'Metodo Pago', 'Moneda', 'Monto'];
    const rows = lista.map((p) => {
      const fecha = p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-AR') : '-';
      const recibo = p.receiptNumber || '-';
      const cliente = `"${this.getNombreClientePorId(p.clientId).replace(/"/g, '""')}"`;
      const concepto = p.concept || '-';
      const metodo = p.paymentMethod || '-';
      const moneda = p.currency || 'USD';
      const monto = p.amount || 0;
      return [fecha, recibo, cliente, concepto, metodo, moneda, monto].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WolfTeI_Libro_Cobranzas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    this.snackBar.open('📊 Libro de cobranzas exportado a CSV.', '', { duration: 3000 });
  }

  // ── Moderación de Reseñas ──

  cambiarEstadoPublicacion(resena: ResenaCliente, publicada: boolean): void {
    const estadoPrevio = resena.publicada;
    resena.publicada = publicada;

    this.proyectosService.alternarPublicacionResena(resena.proyectoId, publicada).subscribe({
      next: () => {
        const msg = publicada
          ? '🌟 Reseña APROBADA para publicación en la web pública.'
          : '🔒 Reseña oculta de la web pública.';
        this.snackBar.open(msg, 'Cerrar', { duration: 3000 });
      },
      error: (err) => {
        console.error('Error al moderar reseña:', err);
        resena.publicada = estadoPrevio;
        this.snackBar.open('Error al actualizar la visibilidad de la reseña.', 'Cerrar', { duration: 3500 });
      },
    });
  }

  copiarTestimonio(resena: ResenaCliente): void {
    const estrellasStr = '⭐'.repeat(resena.stars);
    const texto = `"${resena.comment}"\n\n— ${resena.clientName} (${resena.proyectoTitle})\nCalificación: ${estrellasStr} (${resena.stars}/5)`;
    navigator.clipboard.writeText(texto).then(() => {
      this.snackBar.open('📋 Testimonio copiado al portapapeles.', '', { duration: 2500 });
    });
  }
}

import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ContactoService } from '../../../service/contacto.service';
import { ClientesService, Cliente } from '../../../service/clientes.service';
import { ProyectosService, Proyecto } from '../../../service/proyectos.service';
import { PropuestasService, Propuesta } from '../../../service/propuestas.service';
import { combineLatest, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-home-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  templateUrl: './home-dashboard.component.html',
  styleUrl: './home-dashboard.component.scss',
})
export class HomeDashboardComponent implements OnInit, OnDestroy {

  private contactoService = inject(ContactoService);
  private clientesService = inject(ClientesService);
  private proyectosService = inject(ProyectosService);
  private propuestasService = inject(PropuestasService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private sub?: Subscription;

  cargando = true;
  clientes: Cliente[] = [];
  proyectos: Proyecto[] = [];
  propuestas: Propuesta[] = [];

  tasaConversion = 0;
  totalContratadoUSD = 0;
  totalContratadoARS = 0;
  totalPropuestasActivas = 0;

  stats = [
    {
      id: 'propuestas',
      title: 'Propuestas Totales',
      count: 0,
      icon: 'description',
      color: '#3b82f6',
    },
    {
      id: 'proyectos',
      title: 'Proyectos en Curso',
      count: 0,
      icon: 'architecture',
      color: '#8b5cf6',
    },
    {
      id: 'clientes',
      title: 'Clientes Registrados',
      count: 0,
      icon: 'people',
      color: '#10b981',
    },
    {
      id: 'messages',
      title: 'Mensajes Web',
      count: 0,
      icon: 'mail',
      color: '#f50057',
    },
  ];

  ngOnInit() {
    this.sub = combineLatest({
      mensajes: this.contactoService.listenMessages().pipe(catchError(() => of([]))),
      clientes: this.clientesService.listenClientes().pipe(catchError(() => of([]))),
      proyectos: this.proyectosService.listenProyectos().pipe(catchError(() => of([]))),
      propuestas: this.propuestasService.listenPropuestas().pipe(catchError(() => of([]))),
    }).subscribe((data) => {
      this.cargando = false;
      this.clientes = data.clientes;
      this.proyectos = data.proyectos;
      this.propuestas = data.propuestas;

      const setStat = (id: string, count: number) => {
        const item = this.stats.find((s) => s.id === id);
        if (item) item.count = count;
      };

      setStat('messages', data.mensajes.length);
      setStat('clientes', data.clientes.length);
      setStat('proyectos', data.proyectos.length);
      setStat('propuestas', data.propuestas.length);

      // Calcular Métricas Financieras y de Conversión
      const aceptadas = data.propuestas.filter(p =>
        p.status === 'aceptado' || p.status === 'en_desarrollo' || p.status === 'finalizado'
      );

      this.totalPropuestasActivas = data.propuestas.filter(p => p.status !== 'cancelado').length;

      if (data.propuestas.length > 0) {
        this.tasaConversion = Math.round((aceptadas.length / data.propuestas.length) * 100);
      } else {
        this.tasaConversion = 0;
      }

      let contratadoUSD = 0;
      let contratadoARS = 0;

      aceptadas.forEach(p => {
        const monto = Number(p.totalAmount) || 0;
        if (p.currency === 'ARS') {
          contratadoARS += monto;
        } else {
          contratadoUSD += monto;
        }
      });

      this.totalContratadoUSD = contratadoUSD;
      this.totalContratadoARS = contratadoARS;

      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  /**
   * Exporta la base de propuestas y contratos a formato CSV compatible con Excel.
   */
  exportarCSV() {
    if (this.propuestas.length === 0) {
      this.snackBar.open('No hay propuestas para exportar.', 'Cerrar', { duration: 3000 });
      return;
    }

    const headers = ['Fecha Emision', 'Cliente', 'Titulo Proyecto', 'Estado', 'Moneda', 'Monto Inversion', 'Anticipo 50%', 'Token'];
    const rows = this.propuestas.map(p => {
      const fecha = p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-AR') : '-';
      const cliente = `"${(p.clientPreviewName || '').replace(/"/g, '""')}"`;
      const titulo = `"${(p.title || '').replace(/"/g, '""')}"`;
      const estado = p.status || 'borrador';
      const moneda = p.currency || 'USD';
      const monto = p.totalAmount || 0;
      const anticipo = Math.ceil(monto / 2);
      const token = p.token || '-';

      return [fecha, cliente, titulo, estado, moneda, monto, anticipo, token].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WolfTeI_Balance_Propuestas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    this.snackBar.open('📊 Archivo CSV exportado con éxito.', '', { duration: 3000 });
  }
}

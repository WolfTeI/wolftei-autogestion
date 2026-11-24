import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

import {
  AppsStoresService,
  AppStoreItem,
  PlataformaApp,
} from '../../../service/apps-stores.service';
import {
  RegistrarAppDialogComponent,
  RegistrarAppDialogData,
} from './registrar-app-dialog/registrar-app-dialog.component';

@Component({
  selector: 'app-apps-stores',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  templateUrl: './apps-stores.component.html',
  styleUrl: './apps-stores.component.scss',
})
export class AppsStoresComponent implements OnInit, OnDestroy {
  private appsStoresService = inject(AppsStoresService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  private sub?: Subscription;

  cargando = signal<boolean>(true);
  apps = signal<AppStoreItem[]>([]);
  filtroPlataforma = signal<'todas' | PlataformaApp>('todas');

  // ── Métricas Computadas ──
  appsFiltradas = computed(() => {
    const f = this.filtroPlataforma();
    if (f === 'todas') return this.apps();
    return this.apps().filter((a) => a.plataforma === f);
  });

  totalApps = computed(() => this.apps().length);

  totalDescargas = computed(() => {
    return this.apps().reduce((acc, curr) => acc + (Number(curr.descargasTotales) || 0), 0);
  });

  totalUsuariosActivos = computed(() => {
    return this.apps().reduce((acc, curr) => acc + (Number(curr.usuariosActivosMes) || 0), 0);
  });

  calificacionPromedioGlobal = computed(() => {
    const appsConRating = this.apps().filter((a) => (a.calificacionPromedio || 0) > 0);
    if (appsConRating.length === 0) return 5.0;
    const sum = appsConRating.reduce((acc, curr) => acc + (Number(curr.calificacionPromedio) || 0), 0);
    return Number((sum / appsConRating.length).toFixed(1));
  });

  ingresosMensualesUSD = computed(() => {
    return this.apps()
      .filter((a) => a.monedaIngreso === 'USD')
      .reduce((acc, curr) => acc + (Number(curr.ingresoMensualEstimado) || 0), 0);
  });

  ingresosMensualesARS = computed(() => {
    return this.apps()
      .filter((a) => a.monedaIngreso === 'ARS')
      .reduce((acc, curr) => acc + (Number(curr.ingresoMensualEstimado) || 0), 0);
  });

  ngOnInit(): void {
    this.iniciarEscucha();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  iniciarEscucha(): void {
    this.cargando.set(true);
    this.sub = this.appsStoresService.listenApps().subscribe({
      next: (items) => {
        this.apps.set(items);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al escuchar aplicaciones:', err);
        this.cargando.set(false);
      },
    });
  }

  setFiltro(plataforma: 'todas' | PlataformaApp): void {
    this.filtroPlataforma.set(plataforma);
  }

  abrirRegistrarApp(): void {
    this.dialog.open(RegistrarAppDialogComponent, {
      width: '640px',
    });
  }

  editarApp(app: AppStoreItem): void {
    this.dialog.open(RegistrarAppDialogComponent, {
      width: '640px',
      data: { app } as RegistrarAppDialogData,
    });
  }

  eliminarApp(app: AppStoreItem): void {
    if (!app.id) return;
    const ok = window.confirm(`¿Estás seguro de que deseás retirar del catálogo la app "${app.nombre}"?`);
    if (!ok) return;

    this.appsStoresService.eliminarApp(app.id).subscribe({
      next: () => {
        this.snackBar.open('Aplicación retirada del panel.', '', { duration: 3000 });
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Error al eliminar la app.', 'Cerrar', { duration: 3500 });
      },
    });
  }

  abrirEnlaceTienda(url?: string): void {
    if (!url) {
      this.snackBar.open('Esta app no tiene una URL pública de tienda configurada aún.', 'Cerrar', { duration: 3000 });
      return;
    }
    window.open(url, '_blank');
  }

  getPlataformaInfo(plataforma: PlataformaApp): { label: string; icon: string; cssClass: string } {
    switch (plataforma) {
      case 'google_play':
        return { label: 'Google Play Store', icon: 'android', cssClass: 'platform-play' };
      case 'microsoft_store':
        return { label: 'Microsoft Store', icon: 'laptop_windows', cssClass: 'platform-ms' };
      case 'web_app':
        return { label: 'Web SaaS / PWA', icon: 'language', cssClass: 'platform-web' };
      default:
        return { label: 'Tienda Digital', icon: 'apps', cssClass: 'platform-other' };
    }
  }

  exportarCSV(): void {
    const lista = this.apps();
    if (lista.length === 0) {
      this.snackBar.open('No hay aplicaciones para exportar.', 'Cerrar', { duration: 3000 });
      return;
    }

    const headers = [
      'Nombre',
      'Plataforma',
      'Package ID',
      'Version',
      'Estado',
      'Modelo Monetizacion',
      'Precio Venta',
      'Descargas Totales',
      'Usuarios Activos Mes',
      'Rating Promedio',
      'Total Resenas',
      'Ingreso Mensual Estimado',
      'Moneda',
      'Lanzamiento',
      'Notas Estrategicas',
    ];

    const rows = lista.map((a) => {
      const nom = `"${a.nombre.replace(/"/g, '""')}"`;
      const plat = a.plataforma;
      const pkg = `"${(a.paqueteId || '').replace(/"/g, '""')}"`;
      const ver = a.version || '1.0.0';
      const est = a.estado;
      const mod = a.modeloMonetizacion;
      const prec = a.precio || 0;
      const desc = a.descargasTotales || 0;
      const mau = a.usuariosActivosMes || 0;
      const rat = a.calificacionPromedio || 0;
      const res = a.totalResenas || 0;
      const ing = a.ingresoMensualEstimado || 0;
      const mon = a.monedaIngreso || 'USD';
      const lanz = a.fechaLanzamiento || '-';
      const not = `"${(a.notasEstrategicas || '').replace(/"/g, '""')}"`;
      return [nom, plat, pkg, ver, est, mod, prec, desc, mau, rat, res, ing, mon, lanz, not].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WolfTeI_Apps_Stores_Metricas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    this.snackBar.open('📊 Reporte de apps en tiendas exportado a CSV.', '', { duration: 3000 });
  }
}

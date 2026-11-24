import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AppsStoresService, AppStoreItem, PlataformaApp, ModeloMonetizacion, EstadoApp } from '../../../../service/apps-stores.service';

export interface RegistrarAppDialogData {
  app?: AppStoreItem;
}

@Component({
  selector: 'app-registrar-app-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './registrar-app-dialog.component.html',
  styleUrl: './registrar-app-dialog.component.scss',
})
export class RegistrarAppDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<RegistrarAppDialogComponent>);
  private appsStoresService = inject(AppsStoresService);
  private snackBar = inject(MatSnackBar);
  data = inject<RegistrarAppDialogData>(MAT_DIALOG_DATA, { optional: true });

  guardando = signal<boolean>(false);
  form!: FormGroup;
  esEdicion = false;

  plataformas: { value: PlataformaApp; label: string; icon: string }[] = [
    { value: 'google_play', label: 'Google Play Store (Android)', icon: 'android' },
    { value: 'microsoft_store', label: 'Microsoft Store (Windows)', icon: 'laptop_windows' },
    { value: 'web_app', label: 'Web App / SaaS PWA', icon: 'language' },
    { value: 'otra', label: 'Otra Tienda / Repositorio', icon: 'apps' },
  ];

  modelosMonetizacion: { value: ModeloMonetizacion; label: string }[] = [
    { value: 'gratis', label: 'Gratuita (Open / Lead magnet)' },
    { value: 'freemium', label: 'Freemium (Base gratis + upgrades)' },
    { value: 'pago', label: 'Pago Único (Compra de licencia)' },
    { value: 'suscripcion', label: 'Suscripción Recurrente (SaaS / MRR)' },
    { value: 'anuncios', label: 'Publicidad (AdMob / Monetización in-app)' },
  ];

  estados: { value: EstadoApp; label: string }[] = [
    { value: 'publicada', label: 'Publicada / Activa' },
    { value: 'en_revision', label: 'En Revisión por la Tienda' },
    { value: 'borrador', label: 'En Preparación / Borrador' },
    { value: 'descontinuada', label: 'Descontinuada / Retirada' },
  ];

  ngOnInit(): void {
    const app = this.data?.app;
    this.esEdicion = !!app?.id;

    this.form = this.fb.group({
      nombre: [app?.nombre || '', [Validators.required, Validators.maxLength(100)]],
      plataforma: [app?.plataforma || 'google_play', [Validators.required]],
      paqueteId: [app?.paqueteId || '', [Validators.maxLength(120)]],
      urlTienda: [app?.urlTienda || ''],
      version: [app?.version || '1.0.0', [Validators.required]],
      modeloMonetizacion: [app?.modeloMonetizacion || 'gratis', [Validators.required]],
      precio: [app?.precio ?? 0, [Validators.min(0)]],
      currency: [app?.currency || 'USD', [Validators.required]],
      descargasTotales: [app?.descargasTotales ?? 0, [Validators.min(0)]],
      usuariosActivosMes: [app?.usuariosActivosMes ?? 0, [Validators.min(0)]],
      calificacionPromedio: [app?.calificacionPromedio ?? 5.0, [Validators.min(0), Validators.max(5)]],
      totalResenas: [app?.totalResenas ?? 0, [Validators.min(0)]],
      ingresoMensualEstimado: [app?.ingresoMensualEstimado ?? 0, [Validators.min(0)]],
      monedaIngreso: [app?.monedaIngreso || 'USD', [Validators.required]],
      estado: [app?.estado || 'publicada', [Validators.required]],
      fechaLanzamiento: [app?.fechaLanzamiento || new Date().toISOString().slice(0, 10)],
      notasEstrategicas: [app?.notasEstrategicas || ''],
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    const formVal = this.form.value;

    const appData = {
      ...formVal,
      precio: Number(formVal.precio) || 0,
      descargasTotales: Number(formVal.descargasTotales) || 0,
      usuariosActivosMes: Number(formVal.usuariosActivosMes) || 0,
      calificacionPromedio: Number(formVal.calificacionPromedio) || 0,
      totalResenas: Number(formVal.totalResenas) || 0,
      ingresoMensualEstimado: Number(formVal.ingresoMensualEstimado) || 0,
    };

    if (this.esEdicion && this.data?.app?.id) {
      this.appsStoresService.actualizarApp(this.data.app.id, appData).subscribe({
        next: () => {
          this.guardando.set(false);
          this.snackBar.open('📱 Métricas de la aplicación actualizadas con éxito.', 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: (err) => {
          console.error(err);
          this.guardando.set(false);
          this.snackBar.open('Error al actualizar la aplicación.', 'Cerrar', { duration: 3500 });
        },
      });
    } else {
      this.appsStoresService.crearApp(appData).subscribe({
        next: () => {
          this.guardando.set(false);
          this.snackBar.open('🚀 Aplicación registrada en el catálogo oficial.', 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: (err) => {
          console.error(err);
          this.guardando.set(false);
          this.snackBar.open('Error al registrar la aplicación.', 'Cerrar', { duration: 3500 });
        },
      });
    }
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}

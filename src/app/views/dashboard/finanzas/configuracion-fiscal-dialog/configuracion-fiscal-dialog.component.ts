import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FiscalService, FiscalSettings, FISCAL_DEFAULTS } from '../../../../service/fiscal.service';

@Component({
  selector: 'app-configuracion-fiscal-dialog',
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
    MatTabsModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './configuracion-fiscal-dialog.component.html',
  styleUrl: './configuracion-fiscal-dialog.component.scss',
})
export class ConfiguracionFiscalDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<ConfiguracionFiscalDialogComponent>);
  private fiscalService = inject(FiscalService);
  private snackBar = inject(MatSnackBar);

  cargando = signal<boolean>(true);
  guardando = signal<boolean>(false);
  form!: FormGroup;

  categoriasMonotributo: string[] = [
    'Categoría A',
    'Categoría B',
    'Categoría C',
    'Categoría D',
    'Categoría E',
    'Categoría F',
    'Categoría G',
    'Categoría H',
    'Categoría I',
    'Categoría J',
    'Categoría K',
  ];

  ngOnInit(): void {
    this.initForm(FISCAL_DEFAULTS);
    this.cargarDatos();
  }

  private initForm(defaults: FiscalSettings): void {
    this.form = this.fb.group({
      razonSocial: [defaults.razonSocial, [Validators.required]],
      nombreFantasia: [defaults.nombreFantasia, [Validators.required]],
      cuit: [defaults.cuit, [Validators.required]],
      condicionIva: [defaults.condicionIva, [Validators.required]],
      categoriaMonotributo: [defaults.categoriaMonotributo, [Validators.required]],
      ingresosBrutos: [defaults.ingresosBrutos, [Validators.required]],
      inicioActividades: [defaults.inicioActividades, [Validators.required]],
      domicilioFiscal: [defaults.domicilioFiscal, [Validators.required]],
      localidad: [defaults.localidad, [Validators.required]],
      provincia: [defaults.provincia, [Validators.required]],
      codigoPostal: [defaults.codigoPostal, [Validators.required]],
      puntoVenta: [defaults.puntoVenta, [Validators.required, Validators.min(1)]],
      // Datos bancarios
      cbu: [defaults.cbu],
      alias: [defaults.alias],
      banco: [defaults.banco],
      titularCuenta: [defaults.titularCuenta],
      cuitTitular: [defaults.cuitTitular],
      leyendaComprobante: [defaults.leyendaComprobante],
    });
  }

  private cargarDatos(): void {
    this.fiscalService.listenFiscalSettings().subscribe({
      next: (settings) => {
        if (settings) {
          this.form.patchValue(settings);
        }
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar datos fiscales:', err);
        this.cargando.set(false);
      },
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    const valores: FiscalSettings = this.form.value;

    this.fiscalService.guardarConfiguracionFiscal(valores).subscribe({
      next: () => {
        this.guardando.set(false);
        this.snackBar.open('🏛️ Datos fiscales de ARCA actualizados con éxito.', 'Cerrar', { duration: 3500 });
        this.dialogRef.close(true);
      },
      error: (err) => {
        console.error('Error al guardar datos fiscales:', err);
        this.guardando.set(false);
        this.snackBar.open('Error al guardar los datos fiscales.', 'Cerrar', { duration: 3500 });
      },
    });
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}

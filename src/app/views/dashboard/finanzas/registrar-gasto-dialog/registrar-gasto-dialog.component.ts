import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { GastosService, Gasto, CategoriaGasto, TipoDestinoGasto } from '../../../../service/gastos.service';

export interface CategoriaOption {
  value: CategoriaGasto;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-registrar-gasto-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './registrar-gasto-dialog.component.html',
  styleUrls: ['./registrar-gasto-dialog.component.scss']
})
export class RegistrarGastoDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private gastosService = inject(GastosService);
  private dialogRef = inject(MatDialogRef<RegistrarGastoDialogComponent>);
  private snackBar = inject(MatSnackBar);

  guardando = false;
  tipoDestinoSeleccionado: TipoDestinoGasto = 'gasto_operativo';

  categorias: CategoriaOption[] = [
    { value: 'infraestructura', label: 'Infraestructura & Servidores', icon: 'cloud' },
    { value: 'licencias_software', label: 'Software & Licencias (IDEs / IA)', icon: 'terminal' },
    { value: 'equipamiento_hardware', label: 'Hardware & Equipamiento', icon: 'devices' },
    { value: 'impuestos', label: 'Impuestos & ARCA / Monotributo', icon: 'account_balance' },
    { value: 'servicios_profesionales', label: 'Servicios Profesionales / Contador', icon: 'work' },
    { value: 'marketing', label: 'Marketing & Publicidad', icon: 'campaign' },
    { value: 'viaticos', label: 'Viáticos & Operativos', icon: 'commute' },
    { value: 'otro', label: 'Otros Egresos', icon: 'more_horiz' }
  ];

  form: FormGroup = this.fb.group({
    concepto: ['', [Validators.required, Validators.minLength(3)]],
    monto: [null, [Validators.required, Validators.min(0.01)]],
    currency: ['USD', Validators.required],
    categoria: ['infraestructura', Validators.required],
    tipoDestino: ['gasto_operativo', Validators.required],
    metodoPago: ['transferencia', Validators.required],
    fecha: [new Date().toISOString().split('T')[0], Validators.required],
    comprobanteRef: [''],
    notas: ['']
  });

  ngOnInit(): void {}

  setTipoDestino(tipo: TipoDestinoGasto): void {
    this.tipoDestinoSeleccionado = tipo;
    this.form.patchValue({ tipoDestino: tipo });
    if (tipo === 'inversion' && this.form.get('categoria')?.value === 'infraestructura') {
      this.form.patchValue({ categoria: 'equipamiento_hardware' });
    }
  }

  guardar(): void {
    if (this.form.invalid || this.guardando) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando = true;
    const fv = this.form.value;

    const nuevoGasto: Gasto = {
      fecha: fv.fecha,
      concepto: fv.concepto,
      monto: Number(fv.monto),
      currency: fv.currency,
      categoria: fv.categoria,
      tipoDestino: this.tipoDestinoSeleccionado,
      metodoPago: fv.metodoPago,
      comprobanteRef: fv.comprobanteRef,
      notas: fv.notas
    };

    this.gastosService.registrar(nuevoGasto).subscribe({
      next: (res) => {
        this.guardando = false;
        this.snackBar.open('✅ Gasto / Inversión registrado con éxito.', 'Cerrar', { duration: 3500 });
        this.dialogRef.close(res.gasto);
      },
      error: (err) => {
        this.guardando = false;
        console.error('Error al registrar gasto:', err);
        this.snackBar.open('Error al guardar el gasto en Firestore.', 'Cerrar', { duration: 3500 });
      }
    });
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}

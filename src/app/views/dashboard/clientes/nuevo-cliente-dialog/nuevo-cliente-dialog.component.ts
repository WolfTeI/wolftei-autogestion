import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClientesService } from '../../../../service/clientes.service';

/**
 * Diálogo modal para registrar un nuevo cliente en el sistema y persistirlo en Firestore.
 */
@Component({
  selector: 'app-nuevo-cliente-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './nuevo-cliente-dialog.component.html',
  styleUrls: ['./nuevo-cliente-dialog.component.scss']
})
export class NuevoClienteDialogComponent {
  private fb = inject(FormBuilder);
  private clientesService = inject(ClientesService);
  private dialogRef = inject(MatDialogRef<NuevoClienteDialogComponent>);
  private snackBar = inject(MatSnackBar);

  guardando = false;

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    company: [''],
    taxId: [''],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    address: [''],
    notes: ['']
  });

  guardar(): void {
    if (this.form.invalid || this.guardando) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando = true;
    const datosCliente = this.form.value;

    this.clientesService.crearCliente(datosCliente).subscribe({
      next: (resp) => {
        this.guardando = false;
        this.snackBar.open('✅ Cliente registrado con éxito en la base de datos.', 'Cerrar', {
          duration: 3500
        });
        this.dialogRef.close(resp.cliente || true);
      },
      error: (err) => {
        this.guardando = false;
        console.error('Error al registrar cliente:', err);
        const errorMsg = err.error?.error || 'Error al conectar con la base de datos.';
        this.snackBar.open(`❌ ${errorMsg}`, 'Cerrar', {
          duration: 4000
        });
      }
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}

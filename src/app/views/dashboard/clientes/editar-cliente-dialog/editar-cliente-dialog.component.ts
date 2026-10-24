import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ClientesService, Cliente } from '../../../../service/clientes.service';
import { ProyectosService } from '../../../../service/proyectos.service';
import { PropuestasService } from '../../../../service/propuestas.service';

export interface EditarClienteDialogData {
  cliente?: Cliente;
  nombreSugerido?: string;
  emailSugerido?: string;
  telefonoSugerido?: string;
  cuitSugerido?: string;
  proyectoId?: string;
  propuestaId?: string;
}

@Component({
  selector: 'app-editar-cliente-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="cliente-dialog-container">
      <div class="dialog-header">
        <div class="header-icon">
          <mat-icon>{{ data?.cliente?.id ? 'edit' : 'person_add' }}</mat-icon>
        </div>
        <div>
          <h2>{{ data?.cliente?.id ? 'Editar Datos del Cliente' : 'Completar / Dar de Alta Cliente' }}</h2>
          <p class="subtitle">Datos fiscales, comerciales y de contacto para contratos, facturación y WhatsApp.</p>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="guardar()" class="cliente-form">
        <div class="form-row">
          <mat-form-field appearance="outline" class="col-6">
            <mat-label>Nombre y Apellido / Razón Social *</mat-label>
            <input matInput formControlName="name" placeholder="Ej: Juan Pérez o Tech Solutions SRL" />
            <mat-error *ngIf="form.get('name')?.hasError('required')">El nombre es obligatorio</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="col-6">
            <mat-label>Empresa / Marca</mat-label>
            <input matInput formControlName="company" placeholder="Ej: Tech SRL (Opcional)" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="col-6">
            <mat-label>CUIT / CUIL / DNI / Tax ID</mat-label>
            <input matInput formControlName="taxId" placeholder="Ej: 20-33607855-6 o DNI" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="col-6">
            <mat-label>Teléfono Celular (WhatsApp)</mat-label>
            <input matInput formControlName="phone" placeholder="Ej: 11 2345-6789 o +54 9 11..." />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="col-6">
            <mat-label>Correo Electrónico *</mat-label>
            <input matInput formControlName="email" type="email" placeholder="cliente@empresa.com" />
            <mat-error *ngIf="form.get('email')?.hasError('required')">El correo es obligatorio</mat-error>
            <mat-error *ngIf="form.get('email')?.hasError('email')">Formato de correo no válido</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="col-6">
            <mat-label>Dirección / Localidad</mat-label>
            <input matInput formControlName="address" placeholder="Ej: Av. Libertador 1234, CABA" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Notas internas / Referencia</mat-label>
          <textarea matInput formControlName="notes" rows="2" placeholder="Detalles de contacto o acuerdos previos..."></textarea>
        </mat-form-field>

        <div class="dialog-actions">
          <button mat-button type="button" (click)="cancelar()" [disabled]="guardando">Cancelar</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="guardando || form.invalid">
            <mat-spinner diameter="18" *ngIf="guardando" style="display: inline-block; margin-right: 6px;"></mat-spinner>
            <span>{{ data?.cliente?.id ? 'Guardar Cambios' : 'Registrar y Vincular' }}</span>
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .cliente-dialog-container {
      padding: 18px 24px 12px;
      color: #f1f5f9;
      max-width: 620px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 20px;

      .header-icon {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      h2 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 700;
        color: #f8fafc;
      }

      .subtitle {
        margin: 2px 0 0;
        font-size: 0.82rem;
        color: #94a3b8;
      }
    }

    .cliente-form {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .form-row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;

        .col-6 {
          flex: 1 1 calc(50% - 6px);
          min-width: 240px;
        }
      }

      .w-100 {
        width: 100%;
      }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 12px;
    }
  `]
})
export class EditarClienteDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private clientesService = inject(ClientesService);
  private proyectosService = inject(ProyectosService);
  private propuestasService = inject(PropuestasService);
  private dialogRef = inject(MatDialogRef<EditarClienteDialogComponent>);
  public data: EditarClienteDialogData = inject(MAT_DIALOG_DATA);
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

  ngOnInit(): void {
    if (this.data?.cliente) {
      this.form.patchValue({
        name: this.data.cliente.name || '',
        company: this.data.cliente.company || '',
        taxId: this.data.cliente.taxId || '',
        email: this.data.cliente.email || '',
        phone: this.data.cliente.phone || '',
        address: this.data.cliente.address || '',
        notes: this.data.cliente.notes || '',
      });
    } else {
      this.form.patchValue({
        name: this.data?.nombreSugerido || '',
        email: this.data?.emailSugerido || 'cliente@wolftei.com.ar',
        phone: this.data?.telefonoSugerido || '',
        taxId: this.data?.cuitSugerido || '',
      });
    }
  }

  guardar(): void {
    if (this.form.invalid || this.guardando) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando = true;
    const formVal = this.form.value;

    if (this.data?.cliente?.id) {
      // Modo Actualización
      this.clientesService.actualizarCliente(this.data.cliente.id, formVal).subscribe({
        next: () => {
          this.guardando = false;
          // Actualizar datos denormalizados en proyecto si aplica
          if (this.data?.proyectoId) {
            this.proyectosService.actualizarProyecto(this.data.proyectoId, {
              clientName: formVal.name,
              clientPhone: formVal.phone,
              clientEmail: formVal.email,
              clientTaxId: formVal.taxId,
            }).subscribe();
          }
          // Actualizar datos denormalizados en propuesta si aplica
          if (this.data?.propuestaId) {
            this.propuestasService.actualizar(this.data.propuestaId, {
              clientId: this.data?.cliente?.id,
              clientPreviewName: formVal.name,
              clientPreviewEmail: formVal.email,
              clientTaxId: formVal.taxId,
            }).subscribe();
          }
          this.snackBar.open('✅ Datos del cliente actualizados.', 'Cerrar', { duration: 3000 });
          this.dialogRef.close({ ...this.data.cliente, ...formVal });
        },
        error: (err) => {
          this.guardando = false;
          console.error(err);
          this.snackBar.open('Error al actualizar cliente.', 'Cerrar', { duration: 3000 });
        }
      });
    } else {
      // Modo Creación y Vinculación
      this.clientesService.crearCliente(formVal).subscribe({
        next: (resp) => {
          this.guardando = false;
          const nuevoId = resp.id || resp.cliente?.id;

          // Vincular a proyecto
          if (this.data?.proyectoId && nuevoId) {
            this.proyectosService.actualizarProyecto(this.data.proyectoId, {
              clientId: nuevoId,
              clientName: formVal.name,
              clientPhone: formVal.phone,
              clientEmail: formVal.email,
              clientTaxId: formVal.taxId,
            }).subscribe();
          }

          // Vincular a propuesta
          if (this.data?.propuestaId && nuevoId) {
            this.propuestasService.actualizar(this.data.propuestaId, {
              clientId: nuevoId,
              clientPreviewName: formVal.name,
              clientPreviewEmail: formVal.email,
              clientTaxId: formVal.taxId,
            }).subscribe();
          }

          this.snackBar.open('✅ Cliente guardado y vinculado en el CRM con éxito.', 'Cerrar', { duration: 3500 });
          this.dialogRef.close(resp.cliente || { id: nuevoId, ...formVal });
        },
        error: (err) => {
          this.guardando = false;
          console.error(err);
          this.snackBar.open('Error al registrar cliente.', 'Cerrar', { duration: 3000 });
        }
      });
    }
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}

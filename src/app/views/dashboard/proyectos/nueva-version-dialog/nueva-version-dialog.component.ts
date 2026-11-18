import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ProyectosService, Proyecto } from '../../../../service/proyectos.service';

export interface NuevaVersionDialogData {
  proyectoMadre: Proyecto;
}

@Component({
  selector: 'app-nueva-version-dialog',
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
  template: `
    <div class="version-dialog-container">
      <div class="dialog-header">
        <div class="header-icon">
          <mat-icon>layers</mat-icon>
        </div>
        <div>
          <h2>Nueva Versión / Módulo Evolutivo</h2>
          <p class="subtitle">
            Proyecto Madre: <strong>{{ data.proyectoMadre.title }}</strong>
            <span *ngIf="data.proyectoMadre.clientName"> · Cliente: {{ data.proyectoMadre.clientName }}</span>
          </p>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="guardar()" class="version-form">
        <div class="form-row">
          <mat-form-field appearance="outline" class="col-6">
            <mat-label>Tipo de Evolución / Mutación</mat-label>
            <mat-select formControlName="tipoEvolucion">
              <mat-option value="actualizacion_paradigma">
                🔄 Actualización de Paradigma (ej: Desktop a Cloud)
              </mat-option>
              <mat-option value="modulo_nuevo">
                ✨ Módulo Nuevo (ej: Portal de Consulta Web)
              </mat-option>
              <mat-option value="migracion">
                🚀 Migración de Arquitectura o DB
              </mat-option>
              <mat-option value="mantenimiento">
                🛠️ Mantenimiento / Iteración Mayor
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="col-6">
            <mat-label>Etiqueta de Versión / Entrega</mat-label>
            <input matInput formControlName="versionTag" placeholder="Ej: v2.0 Cloud Backend o Módulo Consultas" />
            <mat-error *ngIf="form.get('versionTag')?.hasError('required')">La versión es obligatoria</mat-error>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Título del Nuevo Desarrollo / Módulo</mat-label>
          <input matInput formControlName="title" placeholder="Ej: BHPH Collector - Backend en la Nube y API de Consulta" />
          <mat-error *ngIf="form.get('title')?.hasError('required')">El título es obligatorio</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Descripción del Alcance</mat-label>
          <textarea
            matInput
            rows="3"
            formControlName="description"
            placeholder="Explicá en qué consiste esta evolución (ej: mutación del modelo desktop offline a una arquitectura distribuida con microservicios o cloud)..."
          ></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Changelog / ¿Qué cambia respecto a la versión anterior?</mat-label>
          <textarea
            matInput
            rows="3"
            formControlName="changelog"
            placeholder="Listá los cambios de paradigma, nuevas interfaces, endpoints o clientes de consulta soportados..."
          ></textarea>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline" class="col-6">
            <mat-label>Monto Presupuestado (Opcional)</mat-label>
            <input matInput type="number" formControlName="totalAmount" placeholder="0" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="col-6">
            <mat-label>Moneda</mat-label>
            <mat-select formControlName="currency">
              <mat-option value="USD">USD (Dólares)</mat-option>
              <mat-option value="ARS">ARS (Pesos)</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="dialog-actions">
          <button type="button" mat-stroked-button (click)="cancelar()">Cancelar</button>
          <button type="submit" mat-flat-button color="primary" [disabled]="guardando || form.invalid">
            <mat-icon>add_task</mat-icon>
            {{ guardando ? 'Registrando...' : 'Registrar Evolución' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .version-dialog-container {
      padding: 8px 12px;
      color: #f1f5f9;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;

      .header-icon {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
      }

      .subtitle {
        margin: 4px 0 0 0;
        font-size: 13px;
        color: #94a3b8;
      }
    }

    .version-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .col-6 {
      flex: 1 1 calc(50% - 8px);
    }

    .w-100 {
      width: 100%;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 16px;
    }
  `],
})
export class NuevaVersionDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private proyectosService = inject(ProyectosService);
  private dialogRef = inject(MatDialogRef<NuevaVersionDialogComponent>);
  public data: NuevaVersionDialogData = inject(MAT_DIALOG_DATA);
  private snackBar = inject(MatSnackBar);

  guardando = false;

  form: FormGroup = this.fb.group({
    tipoEvolucion: ['actualizacion_paradigma', Validators.required],
    versionTag: ['v2.0 Cloud Backend', Validators.required],
    title: ['', Validators.required],
    description: [''],
    changelog: [''],
    totalAmount: [0],
    currency: ['USD', Validators.required],
  });

  ngOnInit(): void {
    const parentTitle = this.data.proyectoMadre.title;
    this.form.patchValue({
      title: `${parentTitle} - Nueva Versión`,
      currency: this.data.proyectoMadre.currency || 'USD',
    });
  }

  guardar(): void {
    if (this.form.invalid || this.guardando) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando = true;
    const val = this.form.value;

    this.proyectosService
      .crearEvolucionProyecto({
        parentProjectId: this.data.proyectoMadre.id!,
        parentProjectTitle: this.data.proyectoMadre.title,
        clientId: this.data.proyectoMadre.clientId,
        versionTag: val.versionTag,
        title: val.title,
        description: val.description,
        tipoEvolucion: val.tipoEvolucion,
        changelog: val.changelog,
        totalAmount: Number(val.totalAmount) || 0,
        currency: val.currency,
      })
      .subscribe({
        next: (resp) => {
          this.guardando = false;
          this.snackBar.open('✅ Versión / módulo evolutivo incorporado al Proyecto Madre.', 'Cerrar', { duration: 3500 });
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.guardando = false;
          console.error(err);
          this.snackBar.open('Error al registrar la evolución.', 'Cerrar', { duration: 3000 });
        },
      });
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}

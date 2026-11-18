import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Cliente } from '../../../../service/clientes.service';

export interface EliminarClienteDialogData {
  cliente: Cliente;
}

@Component({
  selector: 'app-eliminar-cliente-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm-dialog-container">
      <div class="dialog-header">
        <div class="icon-warning">
          <mat-icon>delete_forever</mat-icon>
        </div>
        <h2>Eliminar Cliente</h2>
      </div>

      <mat-dialog-content class="dialog-content">
        <p>
          ¿Estás seguro de que deseás eliminar a
          <strong>{{ data.cliente.name }}</strong>
          @if (data.cliente.company) {
            ({{ data.cliente.company }})
          }?
        </p>
        <p class="warning-text">
          Esta acción removerá la ficha del cliente de forma permanente de tu CRM.
        </p>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button mat-dialog-close>Cancelar</button>
        <button mat-flat-button color="warn" (click)="confirmar()">
          <mat-icon>delete</mat-icon>
          Eliminar Definitivamente
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirm-dialog-container {
      padding: 1rem;
      color: #e6edf3;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;

      .icon-warning {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(239, 68, 68, 0.15);
        color: #ef4444;
        display: flex;
        align-items: center;
        justify-content: center;

        mat-icon {
          font-size: 26px;
          width: 26px;
          height: 26px;
        }
      }

      h2 {
        margin: 0;
        font-size: 1.35rem;
        font-weight: 600;
      }
    }
    .dialog-content {
      padding: 0.5rem 0 1.5rem;
      font-size: 0.95rem;
      line-height: 1.5;

      .warning-text {
        color: #94a3b8;
        font-size: 0.85rem;
        margin-top: 0.5rem;
      }
    }
    .dialog-actions {
      padding-top: 1rem;
      gap: 0.75rem;
    }
  `]
})
export class EliminarClienteDialogComponent {
  readonly dialogRef = inject(MatDialogRef<EliminarClienteDialogComponent>);
  readonly data: EliminarClienteDialogData = inject(MAT_DIALOG_DATA);

  confirmar(): void {
    this.dialogRef.close(true);
  }
}

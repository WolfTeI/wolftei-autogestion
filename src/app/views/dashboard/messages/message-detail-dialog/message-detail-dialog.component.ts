import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-message-detail-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, DatePipe],
  template: `
    <h2 mat-dialog-title>Detalle del Mensaje</h2>
    <mat-dialog-content class="message-content">
      <div class="meta">
        <p><strong>De:</strong> {{ data.name }} ({{ data.email }})</p>
        <p><strong>Origen:</strong> <span class="source-badge">{{ data.source || 'General' }}</span></p>
        <p><strong>Fecha:</strong> {{ data.createdAt | date: 'medium' }}</p>
        <p><strong>Asunto:</strong> {{ data.subject }}</p>
      </div>
      <hr />
      <div class="body">
        <p class="message-text">{{ data.message }}</p>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-raised-button color="primary" mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .message-content {
        .meta {
          p {
            margin: 8px 0;
            color: #e0e0e0;
          }
          strong {
            color: #b0b0b0;
          }
        }
        hr {
          border-color: rgba(255, 255, 255, 0.1);
          margin: 16px 0;
        }
        .source-badge {
          background-color: rgba(114, 137, 218, 0.2);
          color: #b8a6ff;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.85em;
          text-transform: capitalize;
        }
        .body {
          background: rgba(255, 255, 255, 0.05);
          padding: 16px;
          border-radius: 8px;
          .message-text {
            white-space: pre-wrap;
            color: white;
            line-height: 1.5;
          }
        }
      }
      ::ng-deep .mat-mdc-dialog-container {
        --mdc-dialog-container-color: #1e1e2e;
        --mdc-dialog-subhead-color: white;
      }
    `,
  ],
})
export class MessageDetailDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}
}

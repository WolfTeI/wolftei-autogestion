import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { Update } from '@tauri-apps/plugin-updater';

export interface ActualizacionDialogData {
  update: Update;
  currentVersion: string;
}

@Component({
  selector: 'app-actualizacion-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatDividerModule,
  ],
  template: `
    <div class="update-dialog-container">
      <div class="update-header">
        <div class="logo-circle">
          <img src="assets/Lobo_Blanco.webp" alt="WolfTeI Logo" class="brand-logo" />
        </div>
        <div class="header-titles">
          <span class="badge-new">NUEVA VERSIÓN DISPONIBLE</span>
          <h2>WolfTeI Autogestión</h2>
          <div class="versions-row">
            <span class="v-current">v{{ data.currentVersion }}</span>
            <mat-icon class="arrow-icon">arrow_forward</mat-icon>
            <span class="v-next">v{{ data.update.version }}</span>
          </div>
        </div>
      </div>

      <mat-divider></mat-divider>

      <div class="update-body">
        <h3>Novedades y mejoras:</h3>
        <div class="changelog-box">
          <p *ngIf="data.update.body; else noNotes">{{ data.update.body }}</p>
          <ng-template #noNotes>
            <p class="text-muted">Optimizaciones de rendimiento, mejoras de estabilidad y corrección de errores generales.</p>
          </ng-template>
        </div>

        <!-- Estado de Descarga / Progreso -->
        <div *ngIf="estado() !== 'inicial'" class="progress-section">
          <div class="progress-labels">
            <span class="status-text">
              <mat-icon class="spin-icon" *ngIf="estado() === 'descargando'">sync</mat-icon>
              {{ mensajeEstado() }}
            </span>
            <span class="percent-text" *ngIf="estado() === 'descargando'">{{ progreso() }}%</span>
          </div>
          <mat-progress-bar
            [mode]="progreso() > 0 ? 'determinate' : 'indeterminate'"
            [value]="progreso()"
            class="update-progress-bar"
          ></mat-progress-bar>
        </div>
      </div>

      <div class="update-actions">
        <button
          mat-button
          (click)="cerrar()"
          [disabled]="estado() === 'descargando'"
          *ngIf="estado() !== 'completado'"
        >
          Recordarme después
        </button>

        <button
          mat-flat-button
          color="primary"
          class="btn-install"
          (click)="descargarEInstalar()"
          *ngIf="estado() === 'inicial'"
        >
          <mat-icon>system_update</mat-icon>
          Actualizar Ahora
        </button>

        <button
          mat-flat-button
          color="accent"
          class="btn-finish"
          (click)="cerrar()"
          *ngIf="estado() === 'completado'"
        >
          <mat-icon>check_circle</mat-icon>
          Cerrar y Reiniciar App
        </button>
      </div>
    </div>
  `,
  styles: [`
    .update-dialog-container {
      padding: 24px;
      color: #f8fafc;
      background: #0d1117;
      border-radius: 14px;
      max-width: 500px;
    }

    .update-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;

      .logo-circle {
        width: 58px;
        height: 58px;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2));
        border: 1px solid rgba(168, 85, 247, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px;

        .brand-logo {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
      }

      .header-titles {
        .badge-new {
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #a855f7;
          background: rgba(168, 85, 247, 0.12);
          padding: 2px 8px;
          border-radius: 6px;
          display: inline-block;
          margin-bottom: 4px;
        }

        h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #ffffff;
        }

        .versions-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          font-size: 0.82rem;

          .v-current {
            color: #94a3b8;
          }

          .arrow-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
            color: #64748b;
          }

          .v-next {
            color: #10b981;
            font-weight: 700;
          }
        }
      }
    }

    .update-body {
      padding: 16px 0;

      h3 {
        margin: 0 0 8px;
        font-size: 0.85rem;
        text-transform: uppercase;
        color: #94a3b8;
        letter-spacing: 0.04em;
      }

      .changelog-box {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        padding: 12px 14px;
        font-size: 0.88rem;
        line-height: 1.45;
        max-height: 160px;
        overflow-y: auto;
        white-space: pre-line;
        color: #e2e8f0;

        .text-muted {
          color: #64748b;
          margin: 0;
        }
      }
    }

    .progress-section {
      margin-top: 14px;

      .progress-labels {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
        font-size: 0.82rem;

        .status-text {
          color: #60a5fa;
          display: flex;
          align-items: center;
          gap: 6px;

          .spin-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
            animation: spin 1s linear infinite;
          }
        }

        .percent-text {
          color: #94a3b8;
          font-weight: 600;
        }
      }

      .update-progress-bar {
        border-radius: 4px;
        height: 6px;
      }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .update-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      margin-top: 16px;

      .btn-install {
        background: linear-gradient(135deg, #6366f1, #a855f7);
        color: white;
      }

      .btn-finish {
        background: #10b981;
        color: white;
      }
    }
  `]
})
export class ActualizacionDialogComponent {
  private dialogRef = inject(MatDialogRef<ActualizacionDialogComponent>);
  public data: ActualizacionDialogData = inject(MAT_DIALOG_DATA);

  estado = signal<'inicial' | 'descargando' | 'completado' | 'error'>('inicial');
  progreso = signal(0);
  mensajeEstado = signal('Iniciando descarga...');

  async descargarEInstalar(): Promise<void> {
    this.estado.set('descargando');
    this.mensajeEstado.set('Descargando actualización...');

    try {
      let bytesDescargados = 0;
      let totalBytes = 0;

      await this.data.update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          totalBytes = event.data.contentLength || 0;
        } else if (event.event === 'Progress') {
          bytesDescargados += event.data.chunkLength;
          if (totalBytes > 0) {
            const pct = Math.min(100, Math.round((bytesDescargados / totalBytes) * 100));
            this.progreso.set(pct);
            const mbDesc = (bytesDescargados / (1024 * 1024)).toFixed(1);
            const mbTotal = (totalBytes / (1024 * 1024)).toFixed(1);
            this.mensajeEstado.set(`Descargando: ${mbDesc} MB de ${mbTotal} MB`);
          }
        } else if (event.event === 'Finished') {
          this.progreso.set(100);
          this.mensajeEstado.set('Instalación completada.');
        }
      });

      this.estado.set('completado');
      this.mensajeEstado.set('✅ Actualización lista. Reiniciá para aplicar.');
    } catch (err) {
      console.error('Error al descargar actualización:', err);
      this.estado.set('error');
      this.mensajeEstado.set('❌ Error durante la instalación.');
    }
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}

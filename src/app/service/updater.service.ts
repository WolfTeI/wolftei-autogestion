import { Injectable, inject } from '@angular/core';
import { check } from '@tauri-apps/plugin-updater';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ActualizacionDialogComponent } from '../views/dashboard/actualizacion-dialog/actualizacion-dialog.component';

/**
 * Servicio para verificar y aplicar actualizaciones automáticas de Tauri mediante GitHub Releases.
 */
@Injectable({
  providedIn: 'root',
})
export class UpdaterService {
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  public readonly currentVersion = '0.3.0';

  /**
   * Consulta el endpoint de GitHub Releases para ver si hay una versión superior a la actual.
   * @param silent Si es true, solo avisa si hay una actualización disponible (ideal para inicio de app).
   */
  async checkForUpdates(silent = true): Promise<void> {
    try {
      const update = await check();
      if (update?.available) {
        this.dialog.open(ActualizacionDialogComponent, {
          width: '520px',
          disableClose: true,
          panelClass: 'custom-dark-dialog',
          data: {
            update,
            currentVersion: this.currentVersion,
          },
        });
      } else if (!silent) {
        this.snackBar.open(`✅ Tenés la última versión instalada (v${this.currentVersion}).`, 'Entendido', {
          duration: 3500,
        });
      }
    } catch (e) {
      if (!silent) {
        console.warn('No se pudo comprobar actualizaciones en GitHub Releases:', e);
        this.snackBar.open('No se pudo verificar actualizaciones en este momento.', 'Cerrar', {
          duration: 3500,
        });
      }
    }
  }
}


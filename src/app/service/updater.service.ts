import { Injectable, inject, signal } from '@angular/core';
import { check } from '@tauri-apps/plugin-updater';
import { getVersion } from '@tauri-apps/api/app';
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
  public currentVersion = signal<string>('');

  constructor() {
    getVersion()
      .then((ver) => this.currentVersion.set(ver))
      .catch(() => this.currentVersion.set('dev'));
  }

  /**
   * Consulta el endpoint de GitHub Releases para ver si hay una versión superior a la actual.
   * @param silent Si es true, solo avisa si hay una actualización disponible (ideal para inicio de app).
   */
  async checkForUpdates(silent = true): Promise<void> {
    try {
      let verActual = this.currentVersion();
      if (!verActual) {
        try {
          verActual = await getVersion();
          this.currentVersion.set(verActual);
        } catch {
          verActual = 'dev';
        }
      }

      const update = await check();

      if (update) {
        // Tauri v2 devuelve null si no hay updates; si devuelve el objeto update, ya sabemos que hay una versión nueva
        const versionInstalada = update.currentVersion || verActual;
        this.dialog.open(ActualizacionDialogComponent, {
          width: '520px',
          disableClose: true,
          panelClass: 'custom-dark-dialog',
          data: {
            update,
            currentVersion: versionInstalada,
          },
        });
      } else if (!silent) {
        this.snackBar.open(`✅ Tenés la última versión instalada (v${verActual}).`, 'Entendido', {
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


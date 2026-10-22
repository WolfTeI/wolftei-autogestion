import { Injectable, inject } from '@angular/core';
import { check } from '@tauri-apps/plugin-updater';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Servicio para verificar y aplicar actualizaciones automáticas de Tauri mediante GitHub Releases.
 */
@Injectable({
  providedIn: 'root',
})
export class UpdaterService {
  private snackBar = inject(MatSnackBar);

  /**
   * Consulta el endpoint de GitHub Releases para ver si hay una versión superior a la actual.
   * @param silent Si es true, solo avisa si hay una actualización disponible (ideal para inicio de app).
   */
  async checkForUpdates(silent = true): Promise<void> {
    try {
      const update = await check();
      if (update?.available) {
        const snack = this.snackBar.open(
          `🚀 Hay una nueva versión disponible (v${update.version}). ¿Instalar ahora?`,
          'Actualizar',
          { duration: 15000 }
        );

        snack.onAction().subscribe(async () => {
          this.snackBar.open('Descargando e instalando actualización en segundo plano...', '', {
            duration: 8000,
          });
          try {
            await update.downloadAndInstall();
            this.snackBar.open('✅ Actualización lista. Reiniciá la aplicación para aplicar los cambios.', 'Entendido', {
              duration: 10000,
            });
          } catch (installErr) {
            console.error('Error durante la instalación de la actualización:', installErr);
            this.snackBar.open('Error al instalar la actualización.', 'Cerrar', { duration: 4000 });
          }
        });
      } else if (!silent) {
        this.snackBar.open('Tenés la última versión instalada (v0.2.0).', 'Cerrar', { duration: 3000 });
      }
    } catch (e) {
      if (!silent) {
        console.warn('No se pudo comprobar actualizaciones en GitHub Releases:', e);
        this.snackBar.open('No se pudo verificar actualizaciones.', 'Cerrar', { duration: 3000 });
      }
    }
  }
}

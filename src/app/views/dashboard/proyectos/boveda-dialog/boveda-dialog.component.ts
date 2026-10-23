import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CredencialBoveda, Proyecto, ProyectosService } from '../../../../service/proyectos.service';
import { VaultCrypto } from '../../../../utils/vault-crypto';

export interface BovedaDialogData {
  proyecto: Proyecto;
}

interface CredencialItemView extends CredencialBoveda {
  plainPassword?: string;
  revelada?: boolean;
}

@Component({
  selector: 'app-boveda-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  template: `
    <div class="boveda-dialog">
      <div class="dialog-header">
        <div class="header-title">
          <mat-icon style="color: #a78bfa;">lock</mat-icon>
          <h2>Bóveda Segura de Credenciales</h2>
        </div>
        <p class="subtitle">{{ data.proyecto.title }} (Cifrado local AES-256-GCM / Web Crypto)</p>
      </div>

      <div class="dialog-body">
        <!-- Lista de credenciales guardadas -->
        <div class="credenciales-list">
          @if (credenciales().length === 0) {
            <div class="empty-state">
              <mat-icon>vpn_key_off</mat-icon>
              <p>No hay accesos guardados para este proyecto todavía.</p>
            </div>
          } @else {
            @for (cred of credenciales(); track cred.id) {
              <div class="cred-card">
                <div class="cred-info">
                  <div class="cred-top">
                    <span class="cred-servicio">{{ cred.servicio }}</span>
                    <span class="cred-tipo">{{ cred.tipo }}</span>
                    @if (cred.vencimientoFecha) {
                      <span class="cred-vence" [class.vence-urgente]="esVencimientoCercano(cred.vencimientoFecha)">
                        Vence: {{ cred.vencimientoFecha }}
                      </span>
                    }
                  </div>
                  <div class="cred-user">
                    <span>Usuario / Email:</span> <strong>{{ cred.usuario }}</strong>
                  </div>
                  <div class="cred-pass-row">
                    <span>Clave:</span>
                    <span class="pass-mask">
                      {{ cred.revelada ? cred.plainPassword : '••••••••••••' }}
                    </span>
                    <button mat-icon-button (click)="toggleRevelar(cred)" [matTooltip]="cred.revelada ? 'Ocultar' : 'Ver clave'">
                      <mat-icon>{{ cred.revelada ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                    <button mat-icon-button (click)="copiarClave(cred)" matTooltip="Copiar clave al portapapeles">
                      <mat-icon>content_copy</mat-icon>
                    </button>
                    @if (cred.urlAcceso) {
                      <a [href]="cred.urlAcceso" target="_blank" mat-icon-button matTooltip="Abrir URL de acceso">
                        <mat-icon>open_in_new</mat-icon>
                      </a>
                    }
                    <button mat-icon-button color="warn" (click)="eliminarCredencial(cred.id)" matTooltip="Eliminar credencial">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </div>
                </div>
              </div>
            }
          }
        </div>

        <!-- Formulario para agregar nueva credencial -->
        <div class="add-section">
          <h3>➕ Agregar Nuevo Acceso Seguro</h3>
          <div class="form-row">
            <mat-form-field appearance="outline" class="field-third">
              <mat-label>Servicio / Plataforma</mat-label>
              <input matInput [(ngModel)]="nuevoServicio" placeholder="Ej: Hostinger, Cloudflare, cPanel" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="field-third">
              <mat-label>Tipo</mat-label>
              <mat-select [(ngModel)]="nuevoTipo">
                <mat-option value="hosting">Hosting</mat-option>
                <mat-option value="dominio">Dominio</mat-option>
                <mat-option value="servidor">Servidor / VPS</mat-option>
                <mat-option value="base_de_datos">Base de Datos</mat-option>
                <mat-option value="otro">Otro</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="field-third">
              <mat-label>Fecha de Vencimiento (opcional)</mat-label>
              <input matInput type="date" [(ngModel)]="nuevoVencimiento" />
            </mat-form-field>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="field-half">
              <mat-label>Usuario o Correo</mat-label>
              <input matInput [(ngModel)]="nuevoUsuario" placeholder="usuario@dominio.com" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="field-half">
              <mat-label>Contraseña a cifrar</mat-label>
              <input matInput type="password" [(ngModel)]="nuevaPassword" placeholder="••••••••" />
            </mat-form-field>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="field-full">
              <mat-label>URL del Panel / Login (opcional)</mat-label>
              <input matInput [(ngModel)]="nuevaUrl" placeholder="https://hpanel.hostinger.com" />
            </mat-form-field>
          </div>

          <div class="form-actions">
            <button mat-flat-button color="primary" [disabled]="guardando || !nuevoServicio || !nuevoUsuario || !nuevaPassword" (click)="guardarNuevaCredencial()">
              🔒 Cifrar y Guardar en Bóveda
            </button>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button mat-stroked-button (click)="dialogRef.close()">Cerrar Bóveda</button>
      </div>
    </div>
  `,
  styles: [`
    .boveda-dialog {
      padding: 24px;
      max-width: 680px;
      color: #e2e8f0;
      background: #0f172a;
    }
    .dialog-header {
      margin-bottom: 20px;
      .header-title {
        display: flex;
        align-items: center;
        gap: 10px;
        h2 { margin: 0; font-size: 1.3rem; color: #fff; }
      }
      .subtitle { margin: 4px 0 0; font-size: 0.8rem; color: #94a3b8; }
    }
    .credenciales-list {
      max-height: 240px;
      overflow-y: auto;
      margin-bottom: 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .empty-state {
      text-align: center;
      padding: 30px;
      color: #64748b;
      mat-icon { font-size: 36px; width: 36px; height: 36px; margin-bottom: 6px; }
      p { margin: 0; font-size: 0.85rem; }
    }
    .cred-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 12px 14px;
    }
    .cred-top {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      .cred-servicio { font-weight: 700; color: #fff; font-size: 0.95rem; }
      .cred-tipo {
        font-size: 0.7rem;
        padding: 1px 6px;
        background: rgba(102, 126, 234, 0.15);
        color: #a78bfa;
        border-radius: 6px;
        text-transform: uppercase;
      }
      .cred-vence {
        font-size: 0.72rem;
        color: #94a3b8;
        margin-left: auto;
        &.vence-urgente { color: #f87171; font-weight: 700; }
      }
    }
    .cred-user { font-size: 0.82rem; color: #cbd5e1; margin-bottom: 4px; }
    .cred-pass-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.82rem;
      .pass-mask {
        font-family: monospace;
        background: rgba(0, 0, 0, 0.3);
        padding: 2px 8px;
        border-radius: 4px;
        color: #34d399;
      }
    }
    .add-section {
      background: rgba(255, 255, 255, 0.02);
      border: 1px dashed rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      padding: 16px;
      h3 { margin: 0 0 14px; font-size: 0.95rem; color: #e2e8f0; }
    }
    .form-row {
      display: flex;
      gap: 10px;
      margin-bottom: 4px;
    }
    .field-third { flex: 1; }
    .field-half { flex: 1; }
    .field-full { width: 100%; }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }
    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 12px;
    }
  `],
})
export class BovedaCredencialesDialogComponent implements OnInit {
  credenciales = signal<CredencialItemView[]>([]);
  guardando = false;

  nuevoServicio = '';
  nuevoTipo: 'hosting' | 'dominio' | 'servidor' | 'base_de_datos' | 'otro' = 'hosting';
  nuevoUsuario = '';
  nuevaPassword = '';
  nuevaUrl = '';
  nuevoVencimiento = '';

  constructor(
    public dialogRef: MatDialogRef<BovedaCredencialesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: BovedaDialogData,
    private proyectosService: ProyectosService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.credenciales.set((this.data.proyecto.credenciales || []).map((c) => ({ ...c, revelada: false })));
  }

  esVencimientoCercano(fechaStr?: string): boolean {
    if (!fechaStr) return false;
    const diff = new Date(fechaStr).getTime() - Date.now();
    const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return dias <= 30;
  }

  async toggleRevelar(cred: CredencialItemView) {
    if (cred.revelada) {
      cred.revelada = false;
      return;
    }
    try {
      const dec = await VaultCrypto.decrypt(cred.cipherTextHex, cred.ivHex, cred.saltHex);
      cred.plainPassword = dec;
      cred.revelada = true;
    } catch (e) {
      this.snackBar.open('Error al descifrar la clave', 'Cerrar', { duration: 3000 });
    }
  }

  async copiarClave(cred: CredencialItemView) {
    try {
      const dec = cred.plainPassword || (await VaultCrypto.decrypt(cred.cipherTextHex, cred.ivHex, cred.saltHex));
      await navigator.clipboard.writeText(dec);
      this.snackBar.open('🔑 Contraseña copiada al portapapeles', '', { duration: 2500 });
    } catch {
      this.snackBar.open('Error al copiar contraseña', 'Cerrar', { duration: 2500 });
    }
  }

  async guardarNuevaCredencial() {
    if (!this.nuevoServicio || !this.nuevoUsuario || !this.nuevaPassword) return;
    this.guardando = true;

    try {
      const { cipherTextHex, ivHex, saltHex } = await VaultCrypto.encrypt(this.nuevaPassword);
      const nueva: CredencialBoveda = {
        id: `cred-${Date.now()}`,
        servicio: this.nuevoServicio,
        tipo: this.nuevoTipo,
        usuario: this.nuevoUsuario,
        cipherTextHex,
        ivHex,
        saltHex,
        urlAcceso: this.nuevaUrl || undefined,
        vencimientoFecha: this.nuevoVencimiento || undefined,
        createdAt: new Date().toISOString(),
      };

      const listaActual = [...(this.data.proyecto.credenciales || []), nueva];
      await this.guardarEnFirestore(listaActual);

      this.credenciales.set(listaActual.map((c) => ({ ...c, revelada: false })));
      this.data.proyecto.credenciales = listaActual;

      // Limpiar formulario
      this.nuevoServicio = '';
      this.nuevoUsuario = '';
      this.nuevaPassword = '';
      this.nuevaUrl = '';
      this.nuevoVencimiento = '';

      this.snackBar.open('✅ Acceso cifrado y guardado con éxito.', '', { duration: 2500 });
    } catch (err) {
      console.error('Error al guardar credencial en bóveda:', err);
      this.snackBar.open('Error al cifrar credencial.', 'Cerrar', { duration: 3000 });
    } finally {
      this.guardando = false;
    }
  }

  async eliminarCredencial(id: string) {
    if (!confirm('¿Seguro que deseás eliminar este acceso de la bóveda?')) return;
    const listaActual = (this.data.proyecto.credenciales || []).filter((c) => c.id !== id);
    try {
      await this.guardarEnFirestore(listaActual);
      this.data.proyecto.credenciales = listaActual;
      this.credenciales.set(listaActual.map((c) => ({ ...c, revelada: false })));
      this.snackBar.open('Credencial eliminada.', '', { duration: 2500 });
    } catch {
      this.snackBar.open('Error al eliminar credencial.', 'Cerrar', { duration: 3000 });
    }
  }

  private async guardarEnFirestore(credenciales: CredencialBoveda[]): Promise<void> {
    if (!this.data.proyecto.id) return;
    return new Promise((resolve, reject) => {
      this.proyectosService.actualizarProyecto(this.data.proyecto.id!, { credenciales } as any).subscribe({
        next: () => resolve(),
        error: (e: any) => reject(e),
      });
    });
  }
}

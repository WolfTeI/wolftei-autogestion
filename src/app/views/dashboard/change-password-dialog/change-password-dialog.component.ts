import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../service/auth.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>Cambiar Contraseña</h2>
    <mat-dialog-content class="dialog-content">
      <p class="info-text">
        Al cambiar la contraseña, se cerrará la sesión por seguridad.
      </p>
      <form [formGroup]="passwordForm" class="password-form">
        <!-- Input para la contraseña actual requerido por el Backend seguro -->
        <mat-form-field appearance="outline">
          <mat-label>Contraseña Actual</mat-label>
          <input
            matInput
            [type]="hideOldPassword ? 'password' : 'text'"
            formControlName="oldPassword"
          />
          <button
            mat-icon-button
            matSuffix
            (click)="hideOldPassword = !hideOldPassword"
            [attr.aria-label]="'Ocultar contraseña'"
            [attr.aria-pressed]="hideOldPassword"
            type="button"
          >
            <mat-icon>{{
              hideOldPassword ? 'visibility_off' : 'visibility'
            }}</mat-icon>
          </button>
          <mat-error
            *ngIf="passwordForm.get('oldPassword')?.hasError('required')"
            >Requerido</mat-error
          >
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Nueva Contraseña</mat-label>
          <input
            matInput
            [type]="hidePassword ? 'password' : 'text'"
            formControlName="newPassword"
          />
          <button
            mat-icon-button
            matSuffix
            (click)="hidePassword = !hidePassword"
            [attr.aria-label]="'Ocultar contraseña'"
            [attr.aria-pressed]="hidePassword"
            type="button"
          >
            <mat-icon>{{
              hidePassword ? 'visibility_off' : 'visibility'
            }}</mat-icon>
          </button>
          <mat-error
            *ngIf="passwordForm.get('newPassword')?.hasError('required')"
            >Requerido</mat-error
          >
          <mat-error
            *ngIf="passwordForm.get('newPassword')?.hasError('minlength')"
            >Mínimo 6 caracteres</mat-error
          >
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Confirmar Contraseña</mat-label>
          <input
            matInput
            [type]="hidePassword ? 'password' : 'text'"
            formControlName="confirmPassword"
          />
          <mat-error *ngIf="passwordForm.hasError('mismatch')"
            >Las contraseñas no coinciden</mat-error
          >
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button
        mat-raised-button
        color="primary"
        (click)="onSubmit()"
        [disabled]="passwordForm.invalid || loading"
      >
        Guardar
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .password-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-top: 10px;
      min-width: 300px;
    }
    .info-text {
      font-size: 0.85rem;
      color: #888899;
      margin-bottom: 10px;
    }
  `,
})
export class ChangePasswordDialogComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  public dialogRef = inject(MatDialogRef<ChangePasswordDialogComponent>);

  hideOldPassword = true;
  hidePassword = true;
  loading = false;

  passwordForm = this.fb.group(
    {
      oldPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this.passwordMatchValidator },
  );

  passwordMatchValidator(g: any) {
    return g.get('newPassword').value === g.get('confirmPassword').value
      ? null
      : { mismatch: true };
  }

  private async hashSHA256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async onSubmit() {
    if (this.passwordForm.invalid) return;

    this.loading = true;
    const user = this.authService.getUser();

    if (!user || !user.username) {
      this.snackBar.open('Error: Usuario no identificado', 'Cerrar', {
        duration: 3000,
      });
      this.dialogRef.close();
      return;
    }

    const { oldPassword, newPassword } = this.passwordForm.value;

    try {
      const hashedOldPassword = await this.hashSHA256(oldPassword!);
      const hashedNewPassword = await this.hashSHA256(newPassword!);

      this.authService
        .changePassword({
          oldPassword: hashedOldPassword,
          newPassword: hashedNewPassword,
        })
        .subscribe({
          next: () => {
            this.loading = false;
            this.snackBar.open(
              'Contraseña actualizada. Iniciá sesión nuevamente.',
              'Cerrar',
              {
                duration: 5000,
              },
            );
            this.authService.logout();
            this.dialogRef.close(true);
            this.router.navigate(['/login']);
          },
          error: (err) => {
            this.loading = false;
            console.error(err);
            const errMsg = err.error?.error || 'Error al cambiar la contraseña';
            this.snackBar.open(errMsg, 'Cerrar', {
              duration: 4000,
            });
          },
        });
    } catch (err) {
      this.loading = false;
      console.error(err);
      this.snackBar.open('Error al procesar las firmas de seguridad', 'Cerrar', {
        duration: 3000,
      });
    }
  }
}

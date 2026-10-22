import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../service/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  loginForm = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  loading = false;
  hidePassword = true;

  private async hashSHA256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async onSubmit() {
    if (this.loginForm.invalid) return;

    this.loading = true;
    const { username, password } = this.loginForm.value;

    try {
      this.authService
        .login({ username: username!, password: password! })
        .subscribe({
          next: (response) => {
            this.loading = false;
            if (response.user) {
              this.router.navigate(['/dashboard']);
            } else {
              this.showError(response.error || 'Autenticación fallida');
            }
          },
          error: (err) => {
            this.loading = false;
            console.error(err);
            if (err.status === 0) {
              this.showError('No se pudo conectar con el servidor.');
            } else if (err.status === 401) {
              this.showError(err.error?.error || 'Credenciales inválidas.');
            } else {
              this.showError(err.error?.error || 'Error al iniciar sesión.');
            }
          },
        });
    } catch (err) {
      this.loading = false;
      console.error(err);
      this.showError('Error al procesar las credenciales de seguridad');
    }
  }

  showError(msg: string) {
    this.snackBar.open(msg, 'Cerrar', {
      duration: 3000,
      panelClass: ['error-snack'],
    });
  }
}

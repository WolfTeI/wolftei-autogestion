import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
} from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../service/auth.service';
import { UpdaterService } from '../../service/updater.service';
import { NotificationService } from '../../service/notification.service';
import { ChangePasswordDialogComponent } from './change-password-dialog/change-password-dialog.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatToolbarModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  router = inject(Router);
  dialog = inject(MatDialog);
  updaterService = inject(UpdaterService);
  notificationService = inject(NotificationService);

  ngOnInit() {
    // Comprobar si hay una nueva versión disponible en GitHub Releases
    this.updaterService.checkForUpdates(true);

    // Inicializar listeners para notificaciones nativas de Windows en segundo plano
    this.notificationService.init();
  }

  buscarActualizacionesManual() {
    this.updaterService.checkForUpdates(false);
  }

  openChangePassword() {
    this.dialog.open(ChangePasswordDialogComponent, {
      width: '400px',
      panelClass: 'custom-dark-dialog',
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

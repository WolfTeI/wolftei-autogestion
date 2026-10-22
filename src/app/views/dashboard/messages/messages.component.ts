import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ContactoService, Mail } from '../../../service/contacto.service';
import { DatePipe } from '@angular/common';
import { MessageDetailDialogComponent } from './message-detail-dialog/message-detail-dialog.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    DatePipe,
  ],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.scss',
})
export class MessagesComponent implements OnInit, OnDestroy {
  private contactoService = inject(ContactoService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private sub?: Subscription;

  /** Signal reactivo con el listado de mensajes en tiempo real */
  messages = signal<Mail[]>([]);
  cargando = signal<boolean>(true);

  displayedColumns: string[] = [
    'createdAt',
    'name',
    'email',
    'subject',
    'source',
    'actions',
  ];

  ngOnInit() {
    this.iniciarEscuchaTiempoReal();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  /**
   * Conecta el listener en tiempo real de Firestore a través del Signal.
   */
  iniciarEscuchaTiempoReal() {
    this.cargando.set(true);
    this.sub = this.contactoService.listenMessages().subscribe({
      next: (data) => {
        this.messages.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error en listener de mensajes:', err);
        this.cargando.set(false);
        this.snackBar.open('Error al sincronizar mensajes en tiempo real', 'Cerrar', { duration: 3000 });
      },
    });
  }

  /**
   * Recarga manual por si el usuario presiona el botón de refrescar.
   */
  loadMessages() {
    this.sub?.unsubscribe();
    this.iniciarEscuchaTiempoReal();
  }

  viewMessage(message: Mail) {
    this.dialog.open(MessageDetailDialogComponent, {
      width: '600px',
      data: message,
      panelClass: 'custom-dark-dialog',
    });
  }

  /**
   * Eliminación optimista inmediata (0 ms de respuesta visual) sincronizada con Firestore.
   */
  deleteMessage(message: Mail) {
    if (!message.id) return;

    // 1. Borrado visual instantáneo en el Signal
    const prevList = this.messages();
    this.messages.update((list) => list.filter((m) => m.id !== message.id));

    // 2. Operación asíncrona en Firestore con rollback si falla
    this.contactoService.deleteMessage(message.id).subscribe({
      next: () => {
        this.snackBar.open('Mensaje eliminado correctamente.', '', { duration: 2500 });
      },
      error: (err) => {
        console.error('Error al eliminar mensaje en Firestore:', err);
        this.messages.set(prevList);
        this.snackBar.open(
          'No se pudo eliminar el mensaje en el servidor.',
          'Cerrar',
          { duration: 4000 }
        );
      },
    });
  }
}

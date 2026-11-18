import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ClientesService, Cliente } from '../../../service/clientes.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { NuevoClienteDialogComponent } from './nuevo-cliente-dialog/nuevo-cliente-dialog.component';
import { EditarClienteDialogComponent } from './editar-cliente-dialog/editar-cliente-dialog.component';
import { EliminarClienteDialogComponent } from './eliminar-cliente-dialog/eliminar-cliente-dialog.component';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [
    CommonModule, 
    MatTableModule, 
    MatButtonModule, 
    MatIconModule, 
    RouterModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.scss']
})
export class ClientesComponent implements OnInit, OnDestroy {
  private clientesService = inject(ClientesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private sub?: Subscription;

  clientes = signal<Cliente[]>([]);
  isLoading = signal<boolean>(true);
  displayedColumns: string[] = ['name', 'company', 'email', 'phone', 'reputation', 'actions'];

  ngOnInit(): void {
    this.iniciarEscuchaTiempoReal();

    // Si la ruta es /dashboard/clientes/nuevo, abrir automáticamente el modal
    if (this.router.url.includes('/clientes/nuevo')) {
      setTimeout(() => this.abrirNuevoClienteDialog(), 200);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  iniciarEscuchaTiempoReal() {
    this.isLoading.set(true);
    this.sub = this.clientesService.listenClientes().subscribe({
      next: (data) => {
        this.clientes.set(data);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error al escuchar clientes en tiempo real:', error);
        this.isLoading.set(false);
      }
    });
  }

  cargarClientes() {
    this.sub?.unsubscribe();
    this.iniciarEscuchaTiempoReal();
  }

  abrirNuevoClienteDialog(): void {
    const dialogRef = this.dialog.open(NuevoClienteDialogComponent, {
      width: '560px',
      disableClose: true,
      autoFocus: true
    });

    dialogRef.afterClosed().subscribe((clienteCreado) => {
      if (this.router.url.includes('/clientes/nuevo')) {
        this.router.navigate(['/dashboard/clientes']);
      }
      if (clienteCreado) {
        this.cargarClientes();
      }
    });
  }

  abrirEditarClienteDialog(cliente: Cliente): void {
    const dialogRef = this.dialog.open(EditarClienteDialogComponent, {
      width: '600px',
      disableClose: true,
      autoFocus: true,
      data: { cliente }
    });

    dialogRef.afterClosed().subscribe((clienteActualizado) => {
      if (clienteActualizado) {
        this.cargarClientes();
      }
    });
  }

  verDetalle(id: string) {
    this.router.navigate(['/dashboard/clientes', id]);
  }

  confirmarEliminarCliente(cliente: Cliente): void {
    const dialogRef = this.dialog.open(EliminarClienteDialogComponent, {
      width: '450px',
      disableClose: true,
      data: { cliente }
    });

    dialogRef.afterClosed().subscribe((confirmado) => {
      if (confirmado && cliente.id) {
        this.clientesService.eliminarCliente(cliente.id).subscribe({
          next: () => {
            this.snackBar.open(`🗑️ Cliente "${cliente.name}" eliminado correctamente.`, 'Entendido', {
              duration: 3500
            });
            this.cargarClientes();
          },
          error: (err) => {
            console.error('Error al eliminar cliente:', err);
            this.snackBar.open('Error al eliminar el cliente. Intentá nuevamente.', 'Cerrar', {
              duration: 4000
            });
          }
        });
      }
    });
  }
}

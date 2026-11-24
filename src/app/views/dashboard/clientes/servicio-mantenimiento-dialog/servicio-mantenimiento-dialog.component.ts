import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ClientesService, Cliente, ServicioMantenimiento, TipoServicioSoporte, EstadoPagoSoporte } from '../../../../service/clientes.service';
import { Proyecto } from '../../../../service/proyectos.service';

export interface ServicioMantenimientoDialogData {
  cliente: Cliente;
  proyectos: Proyecto[];
  servicio?: ServicioMantenimiento;
}

@Component({
  selector: 'app-servicio-mantenimiento-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './servicio-mantenimiento-dialog.component.html',
  styleUrl: './servicio-mantenimiento-dialog.component.scss',
})
export class ServicioMantenimientoDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<ServicioMantenimientoDialogComponent>);
  private clientesService = inject(ClientesService);
  private snackBar = inject(MatSnackBar);
  data = inject<ServicioMantenimientoDialogData>(MAT_DIALOG_DATA);

  guardando = signal<boolean>(false);
  form!: FormGroup;
  esEdicion = false;

  tiposSoporte: { value: TipoServicioSoporte; label: string; icon: string }[] = [
    { value: 'soporte_mensual', label: 'Soporte y Mesa de Ayuda Mensual', icon: 'support_agent' },
    { value: 'infraestructura_cloud', label: 'Hosting, Dominio y Servidores Cloud', icon: 'cloud' },
    { value: 'seguridad_backups', label: 'Ciberseguridad, Auditoría y Backups', icon: 'security' },
    { value: 'bolsa_horas', label: 'Bolsa Mensual de Horas de Mejoras', icon: 'hourglass_bottom' },
    { value: 'otro', label: 'Otro Servicio Recurrente', icon: 'more_horiz' },
  ];

  estadosPago: { value: EstadoPagoSoporte; label: string }[] = [
    { value: 'al_dia', label: 'Al Día (Pago Acreditado)' },
    { value: 'pendiente_pago', label: 'Pendiente de Pago (Vencido / Por Cobrar)' },
    { value: 'pausado', label: 'Servicio Pausado / En Suspenso' },
  ];

  ngOnInit(): void {
    const serv = this.data?.servicio;
    this.esEdicion = !!serv?.id;

    this.form = this.fb.group({
      proyectoId: [serv?.proyectoId || null],
      tipo: [serv?.tipo || 'soporte_mensual', [Validators.required]],
      nombre: [serv?.nombre || 'Abono Mensual de Soporte Técnico', [Validators.required]],
      monto: [serv?.monto ?? 120, [Validators.required, Validators.min(0)]],
      currency: [serv?.currency || 'USD', [Validators.required]],
      diaCobro: [serv?.diaCobro ?? 5, [Validators.required, Validators.min(1), Validators.max(31)]],
      estadoPago: [serv?.estadoPago || 'al_dia', [Validators.required]],
      horasIncluidas: [serv?.horasIncluidas ?? 10, [Validators.min(0)]],
      horasConsumidas: [serv?.horasConsumidas ?? 0, [Validators.min(0)]],
      notasSLA: [serv?.notasSLA || 'Tiempo de respuesta < 4hs. Soporte preventivo y correctivo de lunes a viernes.'],
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    const val = this.form.value;
    const clienteId = this.data.cliente.id!;

    const proy = val.proyectoId
      ? this.data.proyectos.find((p) => p.id === val.proyectoId)
      : null;

    const servicioPayload = {
      proyectoId: proy ? proy.id : null,
      proyectoTitulo: proy ? proy.title : null,
      tipo: val.tipo,
      nombre: val.nombre.trim(),
      monto: Number(val.monto) || 0,
      currency: val.currency,
      diaCobro: Number(val.diaCobro) || 5,
      estadoPago: val.estadoPago,
      horasIncluidas: Number(val.horasIncluidas) || 0,
      horasConsumidas: Number(val.horasConsumidas) || 0,
      notasSLA: val.notasSLA?.trim() || '',
    };

    if (this.esEdicion && this.data.servicio?.id) {
      this.clientesService
        .actualizarServicioSoporte(clienteId, this.data.servicio.id, servicioPayload)
        .subscribe({
          next: () => {
            this.guardando.set(false);
            this.snackBar.open('🛠️ Abono de soporte actualizado.', 'Cerrar', { duration: 3000 });
            this.dialogRef.close(true);
          },
          error: (e) => {
            console.error(e);
            this.guardando.set(false);
            this.snackBar.open('Error al actualizar servicio de soporte.', 'Cerrar', { duration: 3500 });
          },
        });
    } else {
      this.clientesService
        .agregarServicioSoporte(clienteId, servicioPayload)
        .subscribe({
          next: () => {
            this.guardando.set(false);
            this.snackBar.open('🛡️ Servicio de soporte asignado exitosamente al cliente.', 'Cerrar', { duration: 3000 });
            this.dialogRef.close(true);
          },
          error: (e) => {
            console.error(e);
            this.guardando.set(false);
            this.snackBar.open('Error al asignar servicio de soporte.', 'Cerrar', { duration: 3500 });
          },
        });
    }
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}

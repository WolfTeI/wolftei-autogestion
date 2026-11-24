import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ClientesService, Cliente } from '../../../../service/clientes.service';
import { ProyectosService, Proyecto } from '../../../../service/proyectos.service';

export interface NuevoProyectoDialogData {
  cliente?: Cliente;
  clientId?: string;
  proyectoMadre?: Proyecto;
}

@Component({
  selector: 'app-nuevo-proyecto-dialog',
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
    MatCheckboxModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './nuevo-proyecto-dialog.component.html',
  styleUrl: './nuevo-proyecto-dialog.component.scss',
})
export class NuevoProyectoDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<NuevoProyectoDialogComponent>);
  private clientesService = inject(ClientesService);
  private proyectosService = inject(ProyectosService);
  private snackBar = inject(MatSnackBar);
  data = inject<NuevoProyectoDialogData>(MAT_DIALOG_DATA, { optional: true });

  clientes = signal<Cliente[]>([]);
  proyectosCliente = signal<Proyecto[]>([]);
  cargando = signal<boolean>(true);
  guardando = signal<boolean>(false);
  form!: FormGroup;

  clienteFijo = false;

  ngOnInit(): void {
    const cliInicial = this.data?.cliente;
    const cliIdInicial = this.data?.clientId || cliInicial?.id || '';
    if (cliIdInicial) {
      this.clienteFijo = true;
    }

    this.form = this.fb.group({
      clientId: [cliIdInicial, [Validators.required]],
      title: ['', [Validators.required, Validators.maxLength(120)]],
      description: [''],
      totalAmount: [0, [Validators.min(0)]],
      currency: ['USD', [Validators.required]],
      currentPhase: ['Planificación y Alcance', [Validators.required]],
      status: ['esperando_anticipo', [Validators.required]],
      // Hitos y calendario
      deliveryDays: [20, [Validators.min(1)]],
      fechaVistaPrevia: [''],
      fechaDemo: [''],
      fechaMvp: [''],
      fechaEntrega: [''],
      // Evolución / Ampliación
      esAmpliacion: [!!this.data?.proyectoMadre],
      parentProjectId: [this.data?.proyectoMadre?.id || null],
      versionTag: [this.data?.proyectoMadre ? 'v1.1' : 'v1.0'],
      tipoEvolucion: [this.data?.proyectoMadre ? 'modulo_nuevo' : 'inicial'],
      // Mantenimiento
      incluyeSoporte: [false],
      montoSoporte: [100],
      diaCobroSoporte: [5],
    });

    this.cargarClientes();

    this.form.get('clientId')?.valueChanges.subscribe((cid) => {
      if (cid) this.cargarProyectosDelCliente(cid);
    });

    if (cliIdInicial) {
      this.cargarProyectosDelCliente(cliIdInicial);
    }
  }

  cargarClientes(): void {
    this.clientesService.getClientes().subscribe({
      next: (list) => {
        this.clientes.set(list);
        this.cargando.set(false);
      },
      error: (e) => {
        console.error('Error al cargar clientes:', e);
        this.cargando.set(false);
      },
    });
  }

  cargarProyectosDelCliente(clientId: string): void {
    this.proyectosService.getProyectosPorCliente(clientId).subscribe({
      next: (list) => this.proyectosCliente.set(list),
      error: (e) => console.warn('Error al cargar proyectos del cliente:', e),
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    const val = this.form.value;
    const clienteSeleccionado = this.clientes().find((c) => c.id === val.clientId) || this.data?.cliente;

    if (!clienteSeleccionado) {
      this.snackBar.open('Debés seleccionar un cliente válido para el proyecto.', 'Cerrar', { duration: 3000 });
      this.guardando.set(false);
      return;
    }

    const parentProj = val.parentProjectId
      ? this.proyectosCliente().find((p) => p.id === val.parentProjectId)
      : null;

    const nuevoProyecto: Omit<Proyecto, 'id'> = {
      clientId: clienteSeleccionado.id!,
      clientName: clienteSeleccionado.name,
      clientCompany: clienteSeleccionado.company || clienteSeleccionado.name,
      clientPhone: clienteSeleccionado.phone,
      clientEmail: clienteSeleccionado.email,
      clientTaxId: clienteSeleccionado.taxId,
      title: val.title.trim(),
      description: val.description?.trim() || '',
      status: val.status,
      currentPhase: val.currentPhase,
      totalAmount: Number(val.totalAmount) || 0,
      currency: val.currency,
      deliveryDays: Number(val.deliveryDays) || 20,
      fechaVistaPrevia: val.fechaVistaPrevia || null,
      fechaDemo: val.fechaDemo || null,
      fechaMvp: val.fechaMvp || null,
      fechaEntrega: val.fechaEntrega || null,
      esProyectoMadre: !val.esAmpliacion,
      parentProjectId: parentProj ? parentProj.id : null,
      parentProjectTitle: parentProj ? parentProj.title : null,
      versionTag: val.versionTag?.trim() || 'v1.0',
      tipoEvolucion: val.tipoEvolucion,
      tieneSoporteActivo: !!val.incluyeSoporte,
      anticipoCobrado: false,
      saldoCobrado: false,
    };

    this.proyectosService.crearProyecto(nuevoProyecto as Proyecto).subscribe({
      next: (res) => {
        const proyectoId = res.id;

        // Si se estipuló soporte recurrente para este proyecto, registrarlo en el cliente
        if (val.incluyeSoporte && clienteSeleccionado.id) {
          this.clientesService
            .agregarServicioSoporte(clienteSeleccionado.id, {
              proyectoId,
              proyectoTitulo: val.title,
              tipo: 'soporte_mensual',
              nombre: `Abono de Soporte: ${val.title}`,
              monto: Number(val.montoSoporte) || 100,
              currency: val.currency,
              diaCobro: Number(val.diaCobroSoporte) || 5,
              estadoPago: 'al_dia',
              notasSLA: 'Mantenimiento preventivo mensual, backups y soporte L2',
            })
            .subscribe();
        }

        this.guardando.set(false);
        this.snackBar.open(`🚀 Proyecto "${val.title}" creado con éxito para ${clienteSeleccionado.name}.`, 'Cerrar', { duration: 3500 });
        this.dialogRef.close({ id: proyectoId, proyecto: nuevoProyecto });
      },
      error: (err) => {
        console.error(err);
        this.guardando.set(false);
        this.snackBar.open('Error al crear el proyecto.', 'Cerrar', { duration: 3500 });
      },
    });
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}

import { Component, OnInit, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { startWith, map, timeout } from 'rxjs/operators';

import { InformesTecnicosService, InformeTecnico } from '../../../../service/informes-tecnicos.service';
import { ClientesService, Cliente } from '../../../../service/clientes.service';
import { NuevoClienteDialogComponent } from '../../clientes/nuevo-cliente-dialog/nuevo-cliente-dialog.component';

@Component({
  selector: 'app-nuevo-informe',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatAutocompleteModule,
    MatDialogModule,
  ],
  templateUrl: './nuevo-informe.component.html',
  styleUrl: './nuevo-informe.component.scss',
})
export class NuevoInformeComponent implements OnInit {
  private fb = inject(FormBuilder);
  private informesService = inject(InformesTecnicosService);
  private clientesService = inject(ClientesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);

  guardando = signal<boolean>(false);
  cargandoDatos = signal<boolean>(false);
  esEdicion = signal<boolean>(false);
  informeId: string | null = null;

  clientes: Cliente[] = [];
  filteredClientes!: Observable<Cliente[]>;

  form: FormGroup = this.fb.group({
    clientId: [null],
    clientName: ['', Validators.required],
    clientCompany: [''],
    clientEmail: ['', Validators.email],
    clientPhone: [''],
    title: ['', Validators.required],
    situacionActual: ['', Validators.required],
    problemasDetectados: this.fb.array([
      this.fb.control('Falta de centralización operativa y duplicación de tareas manuales', Validators.required),
    ]),
    resumenSolucion: ['', Validators.required],
    modulosSolucion: this.fb.array([this.nuevoModuloSolucion()]),
    beneficiosClave: this.fb.array([
      this.fb.control('Ahorro de horas hombre y automatización de procesos críticos'),
      this.fb.control('Escalabilidad y visibilidad en tiempo real desde cualquier dispositivo'),
    ]),
    prospectoFuturo: [''],
    tecnologiasRecomendadas: [''],
    status: ['borrador', Validators.required],
  });

  get problemasArray(): FormArray {
    return this.form.get('problemasDetectados') as FormArray;
  }

  get modulosArray(): FormArray {
    return this.form.get('modulosSolucion') as FormArray;
  }

  get beneficiosArray(): FormArray {
    return this.form.get('beneficiosClave') as FormArray;
  }

  nuevoModuloSolucion(): FormGroup {
    return this.fb.group({
      titulo: ['', Validators.required],
      descripcion: ['', Validators.required],
      impactoOValor: [''],
      tiempoEstimadoSugerido: [''],
    });
  }

  agregarProblema(): void {
    this.problemasArray.push(this.fb.control('', Validators.required));
  }

  quitarProblema(index: number): void {
    if (this.problemasArray.length > 1) {
      this.problemasArray.removeAt(index);
    }
  }

  agregarModulo(): void {
    this.modulosArray.push(this.nuevoModuloSolucion());
  }

  quitarModulo(index: number): void {
    if (this.modulosArray.length > 1) {
      this.modulosArray.removeAt(index);
    }
  }

  agregarBeneficio(): void {
    this.beneficiosArray.push(this.fb.control(''));
  }

  quitarBeneficio(index: number): void {
    if (this.beneficiosArray.length > 1) {
      this.beneficiosArray.removeAt(index);
    }
  }

  ngOnInit(): void {
    this.cargarClientes();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.esEdicion.set(true);
      this.informeId = id;
      this.cargarInforme(id);
    }
  }

  cargarClientes(): void {
    this.clientesService.getClientes().subscribe({
      next: (data) => {
        this.clientes = data;
        this.filteredClientes = this.form.get('clientName')!.valueChanges.pipe(
          startWith(''),
          map((val) => this._filtrarClientes(val || ''))
        );
      },
      error: (e) => console.warn('Error al cargar clientes:', e),
    });
  }

  private _filtrarClientes(val: string | Cliente): Cliente[] {
    const filter = typeof val === 'string' ? val.toLowerCase() : val.name.toLowerCase();
    return this.clientes.filter(
      (c) =>
        c.name.toLowerCase().includes(filter) ||
        (c.company && c.company.toLowerCase().includes(filter))
    );
  }

  onClienteSelected(event: any): void {
    const cli: Cliente = event.option.value;
    this.form.patchValue({
      clientId: cli.id,
      clientName: cli.name,
      clientCompany: cli.company || '',
      clientEmail: cli.email || '',
      clientPhone: cli.phone || '',
    });
  }

  displayClienteFn(val: Cliente | string): string {
    return typeof val === 'string' ? val : val ? val.name : '';
  }

  abrirNuevoClienteDialog(): void {
    const dialogRef = this.dialog.open(NuevoClienteDialogComponent, {
      width: '560px',
      disableClose: true,
      autoFocus: true,
    });

    dialogRef.afterClosed().subscribe((nuevoCliente: Cliente) => {
      if (nuevoCliente) {
        this.clientes.unshift(nuevoCliente);
        this.form.patchValue({
          clientId: nuevoCliente.id,
          clientName: nuevoCliente.name,
          clientCompany: nuevoCliente.company || '',
          clientEmail: nuevoCliente.email || '',
          clientPhone: nuevoCliente.phone || '',
        });
        this.snackBar.open(`✅ Cliente "${nuevoCliente.name}" registrado y seleccionado.`, 'Cerrar', { duration: 3500 });
      }
    });
  }

  cargarInforme(id: string): void {
    this.cargandoDatos.set(true);
    this.informesService
      .getInforme(id)
      .pipe(timeout(8000))
      .subscribe({
        next: (inf) => {
          try {
            // Cargar problemas
            this.problemasArray.clear();
            if (inf.problemasDetectados?.length) {
              inf.problemasDetectados.forEach((p) => this.problemasArray.push(this.fb.control(p, Validators.required)));
            } else {
              this.problemasArray.push(this.fb.control(''));
            }

            // Cargar módulos
            this.modulosArray.clear();
            if (inf.modulosSolucion?.length) {
              inf.modulosSolucion.forEach((m) => {
                this.modulosArray.push(
                  this.fb.group({
                    titulo: [m.titulo, Validators.required],
                    descripcion: [m.descripcion, Validators.required],
                    impactoOValor: [m.impactoOValor || ''],
                    tiempoEstimadoSugerido: [m.tiempoEstimadoSugerido || ''],
                  })
                );
              });
            } else {
              this.modulosArray.push(this.nuevoModuloSolucion());
            }

            // Cargar beneficios
            this.beneficiosArray.clear();
            if (inf.beneficiosClave?.length) {
              inf.beneficiosClave.forEach((b) => this.beneficiosArray.push(this.fb.control(b)));
            } else {
              this.beneficiosArray.push(this.fb.control(''));
            }

            this.form.patchValue({
              clientId: inf.clientId || null,
              clientName: inf.clientName || '',
              clientCompany: inf.clientCompany || '',
              clientEmail: inf.clientEmail || '',
              clientPhone: inf.clientPhone || '',
              title: inf.title || '',
              situacionActual: inf.situacionActual || '',
              resumenSolucion: inf.resumenSolucion || '',
              prospectoFuturo: inf.prospectoFuturo || '',
              tecnologiasRecomendadas: inf.tecnologiasRecomendadas || '',
              status: inf.status || 'borrador',
            });
          } catch (err) {
            console.error('Error al procesar datos del informe:', err);
          } finally {
            this.cargandoDatos.set(false);
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.cargandoDatos.set(false);
          this.cdr.markForCheck();
          console.error('Error al cargar informe:', err);
          this.snackBar.open('No se pudo cargar el informe o la conexión tardó demasiado.', 'Cerrar', { duration: 3500 });
          this.router.navigate(['/dashboard/informes']);
        },
      });
  }

  guardar(): void {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    const val = { ...this.form.value };

    if (typeof val.clientName === 'object') {
      val.clientName = val.clientName.name;
    }

    // Vincular clientId si existe coincidencia de nombre
    if (!val.clientId && val.clientName) {
      const match = this.clientes.find((c) => c.name.trim().toLowerCase() === val.clientName.trim().toLowerCase());
      if (match?.id) {
        val.clientId = match.id;
      }
    }

    // Limpiar arrays vacíos
    val.problemasDetectados = (val.problemasDetectados || []).filter((p: string) => p?.trim());
    val.beneficiosClave = (val.beneficiosClave || []).filter((b: string) => b?.trim());

    if (this.esEdicion() && this.informeId) {
      this.informesService.actualizarInforme(this.informeId, val).subscribe({
        next: () => {
          this.guardando.set(false);
          this.snackBar.open('✅ Propuesta Técnica actualizada exitosamente.', 'Cerrar', { duration: 3500 });
          this.router.navigate(['/dashboard/informes', this.informeId]);
        },
        error: (err) => {
          this.guardando.set(false);
          console.error(err);
          this.snackBar.open('Error al actualizar el informe.', 'Cerrar', { duration: 3000 });
        },
      });
    } else {
      this.informesService.crearInforme(val).subscribe({
        next: (resp) => {
          this.guardando.set(false);
          this.snackBar.open(`✅ Propuesta Técnica creada con éxito (Ref: ${resp.token}).`, 'Ver Detalle', { duration: 4000 })
            .onAction().subscribe(() => this.router.navigate(['/dashboard/informes', resp.id]));
          this.router.navigate(['/dashboard/informes', resp.id]);
        },
        error: (err) => {
          this.guardando.set(false);
          console.error(err);
          this.snackBar.open('Error al crear el informe.', 'Cerrar', { duration: 3000 });
        },
      });
    }
  }
}

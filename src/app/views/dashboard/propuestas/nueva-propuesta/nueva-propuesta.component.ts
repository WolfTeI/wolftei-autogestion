import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
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

import { PropuestasService, Propuesta } from '../../../../service/propuestas.service';
import { ClientesService, Cliente } from '../../../../service/clientes.service';
import { CurrencyService, DolarCotizacion } from '../../../../service/currency.service';
import { Observable } from 'rxjs';
import { startWith, map } from 'rxjs/operators';

@Component({
  selector: 'app-nueva-propuesta',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
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
    MatAutocompleteModule
  ],
  templateUrl: './nueva-propuesta.component.html',
  styleUrl: './nueva-propuesta.component.scss',
})
export class NuevaPropuestaComponent implements OnInit {
  private fb = inject(FormBuilder);
  private propuestasService = inject(PropuestasService);
  private clientesService = inject(ClientesService);
  private currencyService = inject(CurrencyService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);

  guardando = false;
  cargandoDatos = false;
  esEdicion = false;
  propuestaId: string | null = null;
  clientes: Cliente[] = [];
  filteredClientes!: Observable<Cliente[]>;
  cotizacionesDolar: DolarCotizacion[] = [];

  form: FormGroup = this.fb.group({
    clientId: [null], // Si se selecciona cliente
    clientPreviewName: ['', Validators.required],
    clientPreviewEmail: ['', Validators.email],
    title: ['', Validators.required],
    objective: ['', Validators.required],
    platform: ['WebApp', Validators.required],
    techStack: ['', Validators.required],
    persistence: [''],
    totalAmount: [0, [Validators.required, Validators.min(1)]],
    currency: ['USD', Validators.required],
    exchangeRateType: ['blue'], // oficial, blue, mep, cripto
    discountPercent: [0, [Validators.min(0), Validators.max(100)]], // Descuento a aplicar
    paymentTerms: ['50% anticipo / 50% contra entrega final'],
    validDays: [15, [Validators.required, Validators.min(1)]],
    warrantyDays: [30, Validators.min(0)],
    notes: [''],
    modules: this.fb.array([this.nuevoModulo()]),
    phases: this.fb.array([this.nuevaFase()]),
    infrastructureItems: this.fb.array([]), // Gastos fijos
    
    // Configuración de Cotización (Calculadora Interna)
    pricing: this.fb.group({
      baseRate: [25, Validators.required], // USD por hora
      pmMarginPercent: [15, Validators.required], // % Project Management
      riskMarginPercent: [10, Validators.required], // % Riesgo/Contingencia
      investigationMarginPercent: [5, Validators.required], // % Estudio/R&D
    })
  });

  ngOnInit() {
    this.cargarClientes();

    this.currencyService.getExchangeRates().subscribe(rates => {
      this.cotizacionesDolar = rates;
      this.calcularTotal(); // Recalcular con cotizaciones listas
    });

    // Escuchar cambios en la calculadora, las horas, la moneda y los ítems de infra
    this.form.get('pricing')?.valueChanges.subscribe(() => this.calcularTotal());
    this.modulesArray.valueChanges.subscribe(() => this.calcularTotal());
    this.infrastructureItemsArray.valueChanges.subscribe(() => this.calcularTotal());
    this.form.get('currency')?.valueChanges.subscribe(() => this.calcularTotal());
    this.form.get('exchangeRateType')?.valueChanges.subscribe(() => this.calcularTotal());
    this.form.get('discountPercent')?.valueChanges.subscribe(() => this.calcularTotal());

    // Detectar si estamos en modo edición
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.esEdicion = true;
      this.propuestaId = id;
      this.cargarPropuestaParaEdicion(id);
    }
  }

  cargarPropuestaParaEdicion(id: string) {
    this.cargandoDatos = true;
    this.propuestasService.getById(id).subscribe({
      next: (p: Propuesta) => {
        this.cargandoDatos = false;

        // Cargar módulos
        this.modulesArray.clear();
        if (p.modules && p.modules.length > 0) {
          const horasPromedio = p.pricingDetails?.devHours
            ? Math.round(p.pricingDetails.devHours / p.modules.length)
            : 10;
          p.modules.forEach((m: any) => {
            this.modulesArray.push(this.fb.group({
              name: [m.name, Validators.required],
              description: [m.description || ''],
              estimatedHours: [m.estimatedHours || horasPromedio, [Validators.required, Validators.min(1)]]
            }));
          });
        } else {
          this.modulesArray.push(this.nuevoModulo());
        }

        // Cargar fases
        this.phasesArray.clear();
        if (p.phases && p.phases.length > 0) {
          p.phases.forEach((f: any) => {
            this.phasesArray.push(this.fb.group({
              label: [f.label, Validators.required],
              weeks: [f.weeks || '']
            }));
          });
        } else {
          this.phasesArray.push(this.nuevaFase());
        }

        // Cargar ítems de infraestructura
        this.infrastructureItemsArray.clear();
        if (p.infrastructureItems && p.infrastructureItems.length > 0) {
          p.infrastructureItems.forEach((infra: any) => {
            this.infrastructureItemsArray.push(this.fb.group({
              name: [infra.name, Validators.required],
              price: [infra.price || 0, [Validators.required, Validators.min(0)]],
              currency: [infra.currency || 'USD', Validators.required]
            }));
          });
        }

        // Cargar datos en el formulario
        this.form.patchValue({
          clientId: p.clientId || null,
          clientPreviewName: p.clientPreviewName || '',
          clientPreviewEmail: p.clientPreviewEmail || '',
          title: p.title || '',
          objective: p.objective || '',
          platform: p.platform || 'WebApp',
          techStack: p.techStack || '',
          persistence: p.persistence || '',
          totalAmount: p.totalAmount || 0,
          currency: p.currency || 'USD',
          exchangeRateType: (p as any).exchangeRateType || 'blue',
          discountPercent: p.discountPercent || 0,
          paymentTerms: p.paymentTerms || '50% anticipo / 50% contra entrega final',
          validDays: p.validDays || 15,
          warrantyDays: p.warrantyDays ?? 30,
          notes: p.notes || ''
        });

        if (p.pricingDetails) {
          this.form.get('pricing')?.patchValue({
            baseRate: p.pricingDetails.baseRate || 25,
            pmMarginPercent: p.pricingDetails.pmMarginPercent ?? 15,
            riskMarginPercent: p.pricingDetails.riskMarginPercent ?? 10,
            investigationMarginPercent: p.pricingDetails.investigationMarginPercent ?? 5
          });
        }

        this.calcularTotal();
      },
      error: (err) => {
        this.cargandoDatos = false;
        console.error('Error al cargar propuesta para edición:', err);
        this.snackBar.open('Error al cargar la propuesta para edición.', 'Cerrar', { duration: 3000 });
        this.router.navigate(['/dashboard/propuestas']);
      }
    });
  }

  cargarClientes() {
    this.clientesService.getClientes().subscribe(data => {
      this.clientes = data;
      this.filteredClientes = this.form.get('clientPreviewName')!.valueChanges.pipe(
        startWith(''),
        map(value => this._filterClientes(value || ''))
      );
    });
  }

  private _filterClientes(value: string | Cliente): Cliente[] {
    const filterValue = typeof value === 'string' ? value.toLowerCase() : value.name.toLowerCase();
    return this.clientes.filter(cliente => cliente.name.toLowerCase().includes(filterValue));
  }

  onClienteSelected(event: any) {
    const cliente: Cliente = event.option.value;
    this.form.patchValue({
      clientId: cliente.id,
      clientPreviewName: cliente.name,
      clientPreviewEmail: cliente.email
    });
  }

  displayClienteFn(cliente: Cliente | string): string {
    return typeof cliente === 'string' ? cliente : (cliente ? cliente.name : '');
  }

  /** FormArray de módulos */
  get modulesArray(): FormArray {
    return this.form.get('modules') as FormArray;
  }

  /** FormArray de fases */
  get phasesArray(): FormArray {
    return this.form.get('phases') as FormArray;
  }

  /** FormArray de ítems de infraestructura */
  get infrastructureItemsArray(): FormArray {
    return this.form.get('infrastructureItems') as FormArray;
  }

  /** Crea un FormGroup vacío para un módulo */
  private nuevoModulo(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      description: [''],
      estimatedHours: [10, [Validators.required, Validators.min(1)]] // Añadimos horas para cálculo
    });
  }

  /** Crea un FormGroup vacío para una fase */
  private nuevaFase(): FormGroup {
    return this.fb.group({
      label: ['', Validators.required],
      weeks: [''],
    });
  }

  /** Crea un FormGroup vacío para un ítem de infraestructura */
  private nuevoItemInfra(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required], // Ej: Hosting
      price: [0, [Validators.required, Validators.min(0)]],
      currency: ['USD', Validators.required] // ARS o USD
    });
  }

  agregarModulo() {
    this.modulesArray.push(this.nuevoModulo());
    this.calcularTotal();
  }

  quitarModulo(index: number) {
    this.modulesArray.removeAt(index);
    this.calcularTotal();
  }

  agregarFase() {
    this.phasesArray.push(this.nuevaFase());
  }

  quitarFase(index: number) {
    this.phasesArray.removeAt(index);
  }

  agregarItemInfra() {
    this.infrastructureItemsArray.push(this.nuevoItemInfra());
    this.calcularTotal();
  }

  quitarItemInfra(index: number) {
    this.infrastructureItemsArray.removeAt(index);
    this.calcularTotal();
  }

  /** Calcula el precio final automáticamente basándose en la configuración */
  calcularTotal() {
    const pricing = this.form.get('pricing')?.value;
    const modules = this.modulesArray.value;
    const finalCurrency = this.form.get('currency')?.value;
    const exchangeType = this.form.get('exchangeRateType')?.value;
    const discount = this.form.get('discountPercent')?.value || 0;

    let totalHours = 0;
    modules.forEach((mod: any) => {
      totalHours += Number(mod.estimatedHours) || 0;
    });

    // Subtotal siempre se calcula en USD primero
    const baseCostUSD = totalHours * (pricing.baseRate || 0);
    
    // Se agregan los porcentajes al costo base en USD
    const pmCostUSD = baseCostUSD * ((pricing.pmMarginPercent || 0) / 100);
    const riskCostUSD = baseCostUSD * ((pricing.riskMarginPercent || 0) / 100);
    const invCostUSD = baseCostUSD * ((pricing.investigationMarginPercent || 0) / 100);
    
    let subtotalUSD = baseCostUSD + pmCostUSD + riskCostUSD + invCostUSD;

    // Obtener tasa de cambio (usamos el valor de 'venta')
    const rateData = this.cotizacionesDolar.find(c => c.casa === exchangeType);
    const exchangeRate = rateData ? rateData.venta : 1000; // fallback a 1000 si no hay rate
    
    // Calcular infraestructura
    const infraItems = this.infrastructureItemsArray.value;
    let infraARS = 0;
    let infraUSD = 0;

    infraItems.forEach((item: any) => {
      const p = Number(item.price) || 0;
      if (item.currency === 'ARS') {
        infraARS += p;
        infraUSD += (p / exchangeRate);
      } else {
        infraUSD += p;
        infraARS += (p * exchangeRate);
      }
    });

    let finalAmount = 0;

    if (finalCurrency === 'ARS') {
      let subtotalARS = subtotalUSD * exchangeRate;
      finalAmount = subtotalARS + infraARS;
      finalAmount = finalAmount - (finalAmount * (discount / 100));
    } else {
      finalAmount = subtotalUSD + infraUSD;
      finalAmount = finalAmount - (finalAmount * (discount / 100));
    }
    
    this.form.patchValue({ totalAmount: Math.ceil(finalAmount) }, { emitEvent: false });
  }

  /** Envía o actualiza la propuesta en el servidor */
  guardar() {
    if (this.form.invalid || this.guardando) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando = true;

    // Formatear payload
    const payload = { ...this.form.value };
    
    // El control de autocomplete puede dejar un objeto, aseguramos que sea string
    if (typeof payload.clientPreviewName === 'object') {
      payload.clientPreviewName = payload.clientPreviewName.name;
    }

    // Reempacar pricing en "pricingDetails" con las horas totales sumadas
    const totalHours = payload.modules.reduce((acc: number, mod: any) => acc + (mod.estimatedHours || 0), 0);
    payload.pricingDetails = {
      ...payload.pricing,
      devHours: totalHours
    };
    delete payload.pricing;

    if (this.esEdicion && this.propuestaId) {
      // Modo Edición: Actualizar propuesta existente
      this.propuestasService.actualizar(this.propuestaId, payload).subscribe({
        next: () => {
          this.guardando = false;
          const ref = this.snackBar.open(
            '✅ Presupuesto actualizado correctamente.',
            'Ver detalle',
            { duration: 5000 }
          );
          ref.onAction().subscribe(() => {
            this.router.navigate(['/dashboard/propuestas', this.propuestaId]);
          });
          this.router.navigate(['/dashboard/propuestas', this.propuestaId]);
        },
        error: (err) => {
          this.guardando = false;
          console.error('Error al actualizar propuesta:', err);
          this.snackBar.open('Error al actualizar la propuesta. Revisá la conexión.', 'Cerrar', { duration: 4000 });
        }
      });
    } else {
      // Modo Creación: Registrar nueva propuesta
      this.propuestasService.crear(payload).subscribe({
        next: (resp) => {
          this.guardando = false;
          const ref = this.snackBar.open(
            `✅ Propuesta creada. Token: ${resp.token}`,
            'Ver detalle',
            { duration: 6000 }
          );
          ref.onAction().subscribe(() => {
            this.router.navigate(['/dashboard/propuestas', resp.id]);
          });
          // Copiar link automáticamente al portapapeles
          const url = `https://wolftei.com.ar/propuesta/${resp.token}`;
          navigator.clipboard.writeText(url).catch(() => {});
          this.router.navigate(['/dashboard/propuestas', resp.id]);
        },
        error: (err) => {
          this.guardando = false;
          console.error('Error al crear propuesta:', err);
          this.snackBar.open('Error al crear la propuesta. Revisá la conexión.', 'Cerrar', { duration: 4000 });
        },
      });
    }
  }
}

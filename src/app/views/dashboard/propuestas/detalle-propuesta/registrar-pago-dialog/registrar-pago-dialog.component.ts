import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PagosService, Pago } from '../../../../../service/pagos.service';
import { obtenerFirmaActiva } from '../../../../../utils/firma-oficial';

export interface RegistrarPagoDialogData {
  propuestaId: string;
  clientId?: string;
  clientName: string;
  currency: 'ARS' | 'USD';
  totalAmount: number;
  saldoPendiente: number;
}

@Component({
  selector: 'app-registrar-pago-dialog',
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
    MatProgressSpinnerModule
  ],
  templateUrl: './registrar-pago-dialog.component.html',
  styleUrls: ['./registrar-pago-dialog.component.scss']
})
export class RegistrarPagoDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private pagosService = inject(PagosService);
  private dialogRef = inject(MatDialogRef<RegistrarPagoDialogComponent>);
  public data: RegistrarPagoDialogData = inject(MAT_DIALOG_DATA);
  private snackBar = inject(MatSnackBar);

  guardando = false;

  form: FormGroup = this.fb.group({
    amount: [0, [Validators.required, Validators.min(1)]],
    currency: ['USD', Validators.required],
    concept: ['anticipo', Validators.required],
    paymentMethod: ['transferencia', Validators.required],
    exchangeRate: [1, [Validators.required, Validators.min(1)]],
    receiptNumber: [''],
    notes: ['']
  });

  ngOnInit(): void {
    const defaultAmount = this.data.saldoPendiente > 0 
      ? this.data.saldoPendiente 
      : Math.ceil(this.data.totalAmount / 2);

    this.form.patchValue({
      amount: defaultAmount,
      currency: this.data.currency || 'USD',
      concept: this.data.saldoPendiente === this.data.totalAmount ? 'anticipo' : 'saldo'
    });
  }

  guardar(): void {
    if (this.form.invalid || this.guardando) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando = true;
    const formVal = this.form.value;

    const nuevoPago: Pago = {
      propuestaId: this.data.propuestaId,
      clientId: this.data.clientId,
      amount: Number(formVal.amount),
      currency: formVal.currency,
      exchangeRate: Number(formVal.exchangeRate) || 1,
      concept: formVal.concept,
      paymentMethod: formVal.paymentMethod,
      receiptNumber: formVal.receiptNumber?.trim() || undefined,
      notes: formVal.notes?.trim() || undefined
    };

    this.pagosService.registrar(nuevoPago).subscribe({
      next: (resp) => {
        this.guardando = false;
        this.snackBar.open('✅ Cobranza registrada exitosamente.', 'Cerrar', { duration: 3500 });
        this.dialogRef.close(resp.pago || true);
      },
      error: (err) => {
        this.guardando = false;
        console.error('Error al registrar pago:', err);
        const msg = err.error?.error || 'Error al conectar con la base de datos.';
        this.snackBar.open(`❌ ${msg}`, 'Cerrar', { duration: 4000 });
      }
    });
  }

  get currentAmount(): number {
    return Number(this.form.get('amount')?.value) || 0;
  }

  get porcentajeCalculado(): number {
    if (!this.data.totalAmount || this.data.totalAmount <= 0) return 0;
    return Math.round((this.currentAmount / this.data.totalAmount) * 100);
  }

  get saldoRestanteCalculado(): number {
    return Math.max(0, this.data.saldoPendiente - this.currentAmount);
  }

  setPorcentaje(pct: number): void {
    const calculated = Math.round(this.data.totalAmount * (pct / 100));
    this.form.patchValue({
      amount: calculated,
      concept: pct === 50 ? 'anticipo' : pct === 100 ? 'total' : 'cuota'
    });
  }

  setSaldoRestante(): void {
    this.form.patchValue({
      amount: this.data.saldoPendiente,
      concept: 'saldo'
    });
  }

  tieneFirmaPersonalizada(): boolean {
    return typeof window !== 'undefined' && !!localStorage.getItem('wolftei_firma_carlos');
  }

  obtenerPreviewFirma(): string {
    return obtenerFirmaActiva();
  }

  cargarFirmaArchivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      localStorage.setItem('wolftei_firma_carlos', base64);
      this.snackBar.open('✍️ Firma personalizada guardada con éxito.', 'Cerrar', { duration: 3500 });
    };
    reader.readAsDataURL(file);
  }

  restablecerFirmaOficial(): void {
    localStorage.removeItem('wolftei_firma_carlos');
    this.snackBar.open('Firma oficial de Carlos Alberto Prost restablecida.', '', { duration: 3000 });
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}

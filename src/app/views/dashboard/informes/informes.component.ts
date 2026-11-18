import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { Subscription } from 'rxjs';

import { InformesTecnicosService, InformeTecnico } from '../../../service/informes-tecnicos.service';
import { WhatsAppService } from '../../../service/whatsapp.service';
import { generateInformePDF } from '../../../utils/informe-pdf-generator';

const ESTADOS_INFORME: Record<string, { label: string; color: string; icon: string }> = {
  borrador: { label: 'Borrador', color: '#64748b', icon: 'edit_note' },
  enviado: { label: 'Presentado / Enviado', color: '#f59e0b', icon: 'send' },
  en_revision: { label: 'En Revisión', color: '#3b82f6', icon: 'hourglass_empty' },
  aprobado: { label: 'Aprobado / Visto Bueno', color: '#10b981', icon: 'check_circle' },
  presupuestado: { label: 'Presupuestado', color: '#8b5cf6', icon: 'request_quote' },
  rechazado: { label: 'Descartado', color: '#ef4444', icon: 'cancel' },
};

@Component({
  selector: 'app-informes',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatSnackBarModule,
    MatCardModule,
    MatChipsModule,
  ],
  templateUrl: './informes.component.html',
  styleUrl: './informes.component.scss',
})
export class InformesComponent implements OnInit, OnDestroy {
  private informesService = inject(InformesTecnicosService);
  private whatsappService = inject(WhatsAppService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  private sub?: Subscription;
  informes = signal<InformeTecnico[]>([]);
  cargando = signal<boolean>(true);

  displayedColumns: string[] = ['titulo', 'cliente', 'estado', 'fecha', 'acciones'];

  ngOnInit(): void {
    this.iniciarEscucha();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  iniciarEscucha(): void {
    this.cargando.set(true);
    this.sub = this.informesService.listenInformes().subscribe({
      next: (data) => {
        this.informes.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al escuchar informes técnicos:', err);
        this.cargando.set(false);
      },
    });
  }

  getEstadoInfo(status: string) {
    return ESTADOS_INFORME[status] || { label: status, color: '#64748b', icon: 'info' };
  }

  descargarPdf(informe: InformeTecnico, event?: Event): void {
    event?.stopPropagation();
    generateInformePDF(informe);
    this.snackBar.open('📄 PDF de la Propuesta Técnica generado.', 'Cerrar', { duration: 3000 });
  }

  async compartirWhatsApp(informe: InformeTecnico, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!informe.clientPhone) {
      this.snackBar.open('⚠️ El cliente no tiene teléfono para WhatsApp.', 'Cerrar', { duration: 3000 });
      return;
    }

    const mensaje =
      `¡Hola ${informe.clientName}! Te comparto el Informe Técnico y Propuesta de Solución que preparamos desde WolfTeI sobre "${informe.title}". ` +
      `Quedo a tu disposición para revisar cualquier detalle o evacuar dudas.`;

    await this.whatsappService.abrirChat(informe.clientPhone, mensaje);
  }

  cambiarEstado(informe: InformeTecnico, nuevoEstado: InformeTecnico['status']): void {
    if (!informe.id) return;
    this.informesService.actualizarInforme(informe.id, { status: nuevoEstado }).subscribe({
      next: () => {
        this.snackBar.open(`Estado actualizado a: ${this.getEstadoInfo(nuevoEstado).label}`, 'Cerrar', { duration: 2500 });
      },
      error: () => this.snackBar.open('Error al actualizar estado.', 'Cerrar', { duration: 3000 }),
    });
  }

  convertirEnPresupuesto(informe: InformeTecnico, event?: Event): void {
    event?.stopPropagation();
    // Navegar a nuevo presupuesto pasando el estado del informe en state
    this.router.navigate(['/dashboard/propuestas/nueva'], {
      state: {
        fromInforme: {
          informeId: informe.id,
          clientId: informe.clientId,
          clientName: informe.clientName,
          clientEmail: informe.clientEmail,
          title: informe.title,
          objective: informe.resumenSolucion,
          modules: informe.modulosSolucion.map((m) => ({
            name: m.titulo,
            description: m.descripcion + (m.impactoOValor ? ` (Impacto: ${m.impactoOValor})` : ''),
          })),
        },
      },
    });
  }

  eliminarInforme(informe: InformeTecnico, event?: Event): void {
    event?.stopPropagation();
    if (!informe.id) return;
    const ok = confirm(`¿Estás seguro de que deseás eliminar el informe "${informe.title}"?`);
    if (!ok) return;

    this.informesService.eliminarInforme(informe.id).subscribe({
      next: () => this.snackBar.open('Informe eliminado.', 'Cerrar', { duration: 2500 }),
      error: () => this.snackBar.open('Error al eliminar.', 'Cerrar', { duration: 3000 }),
    });
  }
}

import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { InformesTecnicosService, InformeTecnico } from '../../../../service/informes-tecnicos.service';
import { WhatsAppService } from '../../../../service/whatsapp.service';
import { generateInformePDF } from '../../../../utils/informe-pdf-generator';

@Component({
  selector: 'app-detalle-informe',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './detalle-informe.component.html',
  styleUrl: './detalle-informe.component.scss',
})
export class DetalleInformeComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private informesService = inject(InformesTecnicosService);
  private whatsappService = inject(WhatsAppService);
  private snackBar = inject(MatSnackBar);

  informe = signal<InformeTecnico | null>(null);
  isLoading = signal<boolean>(true);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cargarInforme(id);
    }
  }

  cargarInforme(id: string): void {
    this.isLoading.set(true);
    this.informesService.getInforme(id).subscribe({
      next: (data) => {
        this.informe.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar informe:', err);
        this.isLoading.set(false);
      },
    });
  }

  descargarPdf(): void {
    const inf = this.informe();
    if (!inf) return;
    generateInformePDF(inf);
    this.snackBar.open('📄 PDF de la Propuesta Técnica generado.', 'Cerrar', { duration: 3000 });
  }

  async compartirWhatsApp(): Promise<void> {
    const inf = this.informe();
    if (!inf?.clientPhone) {
      this.snackBar.open('⚠️ El cliente no tiene teléfono para WhatsApp.', 'Cerrar', { duration: 3000 });
      return;
    }

    const mensaje =
      `¡Hola ${inf.clientName}! Te comparto el Informe Técnico y Propuesta de Solución sobre "${inf.title}". ` +
      `Quedamos atentos a tus comentarios y dudas.`;

    await this.whatsappService.abrirChat(inf.clientPhone, mensaje);
  }

  convertirEnPresupuesto(): void {
    const inf = this.informe();
    if (!inf) return;

    this.router.navigate(['/dashboard/propuestas/nueva'], {
      state: {
        fromInforme: {
          informeId: inf.id,
          clientId: inf.clientId,
          clientName: inf.clientName,
          clientEmail: inf.clientEmail,
          title: inf.title,
          objective: inf.resumenSolucion,
          modules: (inf.modulosSolucion || []).map((m) => ({
            name: m.titulo,
            description: m.descripcion + (m.impactoOValor ? ` (Impacto: ${m.impactoOValor})` : ''),
          })),
        },
      },
    });
  }

  goBack(): void {
    this.location.back();
  }
}

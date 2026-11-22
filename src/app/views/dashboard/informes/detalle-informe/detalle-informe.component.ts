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
import { openUrl } from '@tauri-apps/plugin-opener';

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

  copiarLink(): void {
    const inf = this.informe();
    if (!inf?.token) {
      this.snackBar.open('⚠️ Esta propuesta no tiene token público generado.', 'Cerrar', { duration: 3000 });
      return;
    }
    const link = `https://wolftei.com.ar/informe/${inf.token}`;
    navigator.clipboard.writeText(link).then(() => {
      this.snackBar.open('🔗 Enlace web copiado al portapapeles.', 'Entendido', { duration: 3000 });
    });
  }

  async verEnLaWeb(): Promise<void> {
    const inf = this.informe();
    if (!inf?.token) {
      this.snackBar.open('⚠️ Esta propuesta no tiene token público generado.', 'Cerrar', { duration: 3000 });
      return;
    }
    const link = `https://wolftei.com.ar/informe/${inf.token}`;
    try {
      await openUrl(link);
    } catch {
      window.open(link, '_blank');
    }
  }

  async compartirWhatsApp(): Promise<void> {
    const inf = this.informe();
    if (!inf?.clientPhone) {
      this.snackBar.open('⚠️ El cliente no tiene teléfono para WhatsApp.', 'Cerrar', { duration: 3000 });
      return;
    }

    const linkWeb = inf.token ? `\n\n🔗 *Ver Propuesta Online:* https://wolftei.com.ar/informe/${inf.token}` : '';
    const mensaje =
      `¡Hola ${inf.clientName}! Te comparto el Diagnóstico y Propuesta Técnica sobre *"${inf.title}"*.${linkWeb}\n\n` +
      `Quedamos atentos a tus comentarios y dudas.\n\n` +
      `Saludos,\n*WolfTeI* — Soluciones Digitales`;

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

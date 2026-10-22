import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ClientesService, Cliente } from '../../../../service/clientes.service';
import { ProyectosService, Proyecto } from '../../../../service/proyectos.service';
import { WhatsAppService } from '../../../../service/whatsapp.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { generateContractPDF, generateNDAPDF, generateBothLegalPDFs } from '../../../../utils/contract-pdf-generator';

@Component({
  selector: 'app-detalle-cliente',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    RouterModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatListModule,
    MatSnackBarModule,
    MatMenuModule,
    MatTooltipModule
  ],
  templateUrl: './detalle-cliente.component.html',
  styleUrls: ['./detalle-cliente.component.scss']
})
export class DetalleClienteComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private clientesService = inject(ClientesService);
  private proyectosService = inject(ProyectosService);
  private whatsAppService = inject(WhatsAppService);
  private snackBar = inject(MatSnackBar);

  cliente: Cliente | null = null;
  proyectos: Proyecto[] = [];
  isLoading = true;

  async contactarWhatsApp(): Promise<void> {
    if (!this.cliente?.phone) {
      this.snackBar.open('⚠️ El cliente no tiene teléfono registrado.', 'Cerrar', { duration: 3000 });
      return;
    }
    this.snackBar.open(`💬 Abriendo chat con ${this.cliente.name}...`, 'Cerrar', { duration: 3000 });
    await this.whatsAppService.abrirChat(this.cliente.phone, `¡Hola ${this.cliente.name}! Te escribo desde WolfTeI.`);
  }

  descargarContrato(): void {
    if (!this.cliente) return;
    generateContractPDF(this.cliente);
    this.snackBar.open('📄 Contrato de Desarrollo generado con éxito.', 'Cerrar', { duration: 3000 });
  }

  descargarNDA(): void {
    if (!this.cliente) return;
    generateNDAPDF(this.cliente);
    this.snackBar.open('🔒 Acuerdo de Confidencialidad (NDA) generado con éxito.', 'Cerrar', { duration: 3000 });
  }

  descargarAmbos(): void {
    if (!this.cliente) return;
    generateBothLegalPDFs(this.cliente);
    this.snackBar.open('📦 Contrato de Desarrollo y NDA generados con éxito.', 'Cerrar', { duration: 3000 });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cargarDatos(id);
    }
  }

  cargarDatos(id: string) {
    this.isLoading = true;
    this.clientesService.getCliente(id).subscribe({
      next: (clienteData) => {
        this.cliente = clienteData;
        this.cargarProyectos(id);
      },
      error: (err) => {
        console.error('Error al cargar cliente:', err);
        this.isLoading = false;
      }
    });
  }

  cargarProyectos(clientId: string) {
    this.proyectosService.getProyectosPorCliente(clientId).subscribe({
      next: (proyectosData) => {
        this.proyectos = proyectosData;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar proyectos del cliente:', err);
        this.isLoading = false;
      }
    });
  }

  goBack() {
    this.location.back();
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'entregado': return 'primary';
      case 'en_progreso': return 'accent';
      case 'pendiente': return 'warn';
      default: return '';
    }
  }
}

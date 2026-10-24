import { Component, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { Proyecto } from '../../../../service/proyectos.service';
import { Cliente } from '../../../../service/clientes.service';
import { Propuesta } from '../../../../service/propuestas.service';
import { Pago } from '../../../../service/pagos.service';
import { EditarClienteDialogComponent } from '../../clientes/editar-cliente-dialog/editar-cliente-dialog.component';
import { generateContractPDF, generateNDAPDF } from '../../../../utils/contract-pdf-generator';
import { generateActaGarantiaPDF } from '../../../../utils/acta-garantia-pdf-generator';
import { generateReceiptPDF } from '../../../../utils/receipt-pdf-generator';

export interface ExpedienteDialogData {
  proyecto: Proyecto;
  cliente?: Cliente;
  propuesta?: Propuesta;
  pagos: Pago[];
}

export interface TimelineHito {
  fecha: string;
  titulo: string;
  descripcion: string;
  icono: string;
  color: string;
  badge?: string;
}

@Component({
  selector: 'app-expediente-dialog',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="expediente-dialog">
      <div class="dialog-header">
        <div class="header-info">
          <div class="header-badge">EXPEDIENTE DIGITAL AUDITADO</div>
          <h2>{{ data.proyecto.title }}</h2>
          <p class="client-subtitle" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <mat-icon>business</mat-icon>
            {{ data.cliente?.name || data.proyecto.clientName || 'Cliente' }} — {{ data.cliente?.company || 'Particular' }}
            <span class="cuit-badge" *ngIf="data.cliente?.taxId || data.proyecto.clientTaxId">CUIT/DNI: {{ data.cliente?.taxId || data.proyecto.clientTaxId }}</span>
            <button mat-icon-button (click)="abrirEditarCliente()" matTooltip="Editar o completar datos del cliente" class="btn-inline-edit">
              <mat-icon>edit</mat-icon>
            </button>
          </p>
        </div>

        <button mat-icon-button (click)="cerrar()" matTooltip="Cerrar expediente">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-divider></mat-divider>

      <div class="dialog-content">
        <!-- Resumen Financiero y Documental -->
        <div class="kpis-bar">
          <div class="kpi-item">
            <span class="kpi-label">Inversión Total</span>
            <strong class="kpi-val">{{ data.proyecto.totalAmount | currency: data.proyecto.currency : 'symbol' : '1.0-0' }} {{ data.proyecto.currency }}</strong>
          </div>
          <div class="kpi-item">
            <span class="kpi-label">Recibos Emitidos</span>
            <strong class="kpi-val">{{ data.pagos.length }} foliados</strong>
          </div>
          <div class="kpi-item">
            <span class="kpi-label">Garantía Técnica</span>
            <strong class="kpi-val" [class.garantia-vencida]="esGarantiaVencida()">
              {{ esGarantiaVencida() ? '30 Días Vencidos' : 'Vigente / Activa' }}
            </strong>
          </div>
          <div class="kpi-item" *ngIf="data.proyecto.reviewStars">
            <span class="kpi-label">Satisfacción Cliente</span>
            <strong class="kpi-val stars-val">
              ⭐ {{ data.proyecto.reviewStars }}/5
            </strong>
          </div>
        </div>

        <!-- ── LÍNEA DE TIEMPO (TIMELINE VISUAL) ── -->
        <div class="timeline-section">
          <h3>
            <mat-icon color="primary">history</mat-icon>
            Línea de Tiempo del Proyecto (Trazabilidad 100%)
          </h3>

          <div class="timeline-container">
            @for (hito of hitosTimeline; track hito.titulo) {
              <div class="timeline-item">
                <div class="timeline-marker" [style.background-color]="hito.color">
                  <mat-icon>{{ hito.icono }}</mat-icon>
                </div>
                <div class="timeline-body">
                  <div class="timeline-top">
                    <strong>{{ hito.titulo }}</strong>
                    <span class="timeline-date">{{ hito.fecha | date: 'dd/MM/yyyy HH:mm' }}</span>
                  </div>
                  <p class="timeline-desc">{{ hito.descripcion }}</p>
                  <span class="timeline-pill" *ngIf="hito.badge">{{ hito.badge }}</span>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- ── DOCUMENTACIÓN LEGAL ASOCIADA ── -->
        <div class="docs-section">
          <h3>
            <mat-icon color="accent">folder_shared</mat-icon>
            Documentos y Comprobantes Foliados
          </h3>

          <div class="docs-grid">
            <button mat-stroked-button class="doc-btn" (click)="descargarContrato()">
              <mat-icon style="color: #60a5fa;">description</mat-icon>
              <span>Contrato de Desarrollo (PDF)</span>
            </button>

            <button mat-stroked-button class="doc-btn" (click)="descargarNDA()">
              <mat-icon style="color: #a78bfa;">lock</mat-icon>
              <span>Acuerdo Confidencialidad NDA</span>
            </button>

            <button mat-stroked-button class="doc-btn" (click)="descargarActaGarantia()">
              <mat-icon style="color: #10b981;">verified</mat-icon>
              <span>Acta de Entrega y Garantía</span>
            </button>

            @for (pago of data.pagos; track pago.id) {
              <button mat-stroked-button class="doc-btn" (click)="descargarRecibo(pago)">
                <mat-icon style="color: #34d399;">receipt</mat-icon>
                <span>Recibo {{ pago.receiptNumber || 'Oficial' }} ({{ pago.amount }} {{ pago.currency }})</span>
              </button>
            }
          </div>
        </div>

        <!-- Reseña del Cliente -->
        <div class="review-box" *ngIf="data.proyecto.reviewCompleted">
          <div class="review-box-header">
            <span class="review-badge">VALORACIÓN DEL CLIENTE</span>
            <div class="stars-gold">
              @for (s of [1,2,3,4,5]; track s) {
                <mat-icon>{{ s <= (data.proyecto.reviewStars || 0) ? 'star' : 'star_border' }}</mat-icon>
              }
            </div>
          </div>
          <p class="review-comment">"{{ data.proyecto.reviewComment || 'Sin comentario adicional.' }}"</p>
        </div>
      </div>

      <mat-divider></mat-divider>

      <div class="dialog-actions">
        <button mat-button (click)="cerrar()">Cerrar Expediente</button>
        <button mat-flat-button color="primary" (click)="descargarDossierCompleto()">
          <mat-icon>file_download</mat-icon>
          Descargar Dossier Completo (PDFs)
        </button>
      </div>
    </div>
  `,
  styles: [`
    .expediente-dialog {
      padding: 12px 16px;
      color: #f1f5f9;
      max-width: 780px;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;

      .header-badge {
        font-size: 0.68rem;
        letter-spacing: 0.08em;
        font-weight: 700;
        color: #38bdf8;
        background: rgba(56, 189, 248, 0.15);
        padding: 3px 8px;
        border-radius: 4px;
        display: inline-block;
        margin-bottom: 6px;
      }

      h2 {
        margin: 0;
        font-size: 1.45rem;
        font-weight: 700;
        color: #f8fafc;
      }

      .client-subtitle {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #94a3b8;
        font-size: 0.88rem;
        margin: 4px 0 0;

        mat-icon { font-size: 16px; width: 16px; height: 16px; }
        .cuit-badge {
          background: rgba(255, 255, 255, 0.06);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.75rem;
        }
      }
    }

    .dialog-content {
      padding: 20px 0;
      max-height: 65vh;
      overflow-y: auto;
    }

    .kpis-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      background: #1e293b;
      padding: 14px 18px;
      border-radius: 10px;
      margin-bottom: 24px;
      border: 1px solid rgba(255, 255, 255, 0.06);

      .kpi-item {
        display: flex;
        flex-direction: column;

        .kpi-label {
          font-size: 0.72rem;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .kpi-val {
          font-size: 1.1rem;
          font-weight: 700;
          color: #f1f5f9;
          margin-top: 2px;

          &.garantia-vencida { color: #94a3b8; font-weight: 600; }
          &.stars-val { color: #f59e0b; }
        }
      }
    }

    .timeline-section, .docs-section {
      margin-bottom: 24px;

      h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1.05rem;
        font-weight: 600;
        color: #e2e8f0;
        margin: 0 0 16px;

        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }
    }

    .timeline-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      position: relative;
      padding-left: 20px;
      border-left: 2px solid rgba(255, 255, 255, 0.1);
      margin-left: 12px;

      .timeline-item {
        position: relative;

        .timeline-marker {
          position: absolute;
          left: -32px;
          top: 0;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;

          mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
            color: #ffffff;
          }
        }

        .timeline-body {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 10px 14px;

          .timeline-top {
            display: flex;
            justify-content: space-between;
            align-items: center;

            strong { color: #f8fafc; font-size: 0.88rem; }
            .timeline-date { color: #64748b; font-size: 0.75rem; }
          }

          .timeline-desc {
            color: #94a3b8;
            font-size: 0.82rem;
            margin: 4px 0 0;
            line-height: 1.4;
          }

          .timeline-pill {
            display: inline-block;
            margin-top: 6px;
            font-size: 0.7rem;
            background: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
            padding: 2px 8px;
            border-radius: 4px;
            font-family: monospace;
          }
        }
      }
    }

    .docs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;

      .doc-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        font-size: 0.82rem;
        justify-content: flex-start;
        text-align: left;
      }
    }

    .review-box {
      background: rgba(245, 158, 11, 0.06);
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: 10px;
      padding: 14px 18px;

      .review-box-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .review-badge {
          font-size: 0.7rem;
          font-weight: 700;
          color: #f59e0b;
        }

        .stars-gold mat-icon {
          color: #f59e0b;
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }

      .review-comment {
        font-style: italic;
        color: #e2e8f0;
        font-size: 0.88rem;
        margin: 0;
      }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 14px;
    }
  `]
})
export class ExpedienteDialogComponent {
  private dialogRef = inject(MatDialogRef<ExpedienteDialogComponent>);
  public data: ExpedienteDialogData = inject(MAT_DIALOG_DATA);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  abrirEditarCliente(): void {
    const dialogRef = this.dialog.open(EditarClienteDialogComponent, {
      width: '640px',
      data: {
        cliente: this.data.cliente,
        nombreSugerido: this.data.cliente?.name || this.data.proyecto.clientName || 'Cliente',
        emailSugerido: this.data.cliente?.email || this.data.proyecto.clientEmail || '',
        telefonoSugerido: this.data.cliente?.phone || this.data.proyecto.clientPhone || '',
        cuitSugerido: this.data.cliente?.taxId || this.data.proyecto.clientTaxId || '',
        proyectoId: this.data.proyecto.id,
        propuestaId: this.data.propuesta?.id,
      }
    });

    dialogRef.afterClosed().subscribe((res: Cliente | null) => {
      if (res) {
        this.data.cliente = res;
        this.data.proyecto.clientName = res.name;
        this.data.proyecto.clientPhone = res.phone;
        this.data.proyecto.clientTaxId = res.taxId;
        this.data.proyecto.clientEmail = res.email;
      }
    });
  }

  get hitosTimeline(): TimelineHito[] {
    const list: TimelineHito[] = [];
    const p = this.data.proyecto;
    const prop = this.data.propuesta;

    // 1. Emisión de Presupuesto
    if (prop?.createdAt || p.createdAt) {
      list.push({
        fecha: prop?.createdAt || p.createdAt || '',
        titulo: 'Propuesta Comercial Emitida',
        descripcion: `Cotización inicial elaborada por ${p.totalAmount} ${p.currency} con ${p.deliveryDays || 20} días de plazo.`,
        icono: 'description',
        color: '#64748b',
        badge: prop?.token ? `Token: ${prop.token}` : undefined,
      });
    }

    // 2. Visto por el cliente
    if (prop?.viewedAt) {
      list.push({
        fecha: prop.viewedAt,
        titulo: 'Apertura Confirmada (Visto)',
        descripcion: 'El cliente accedió al visor público del presupuesto en wolftei.com.ar.',
        icono: 'visibility',
        color: '#3b82f6',
      });
    }

    // 3. Aceptación y Consentimiento Legal
    if (prop?.acceptedAt) {
      const ip = (prop as any).acceptance?.clientIp || 'Registrada';
      list.push({
        fecha: prop.acceptedAt,
        titulo: 'Propuesta Aprobada & Contrato Sello Legal',
        descripcion: `Firmado electrónicamente por ${prop.clientLegalName || prop.clientPreviewName}.`,
        icono: 'check_circle',
        color: '#10b981',
        badge: `IP Firmante: ${ip}`,
      });
    }

    // 4. Cobros y Recibos
    for (const pago of this.data.pagos) {
      list.push({
        fecha: pago.createdAt || '',
        titulo: `Cobro Registrado — ${pago.concept.toUpperCase()}`,
        descripcion: `Acreditación de ${pago.amount} ${pago.currency} mediante ${pago.paymentMethod}.`,
        icono: 'receipt',
        color: '#34d399',
        badge: pago.receiptNumber || 'REC-S/N',
      });
    }

    // 5. Inicio de Desarrollo
    if (p.startDate) {
      list.push({
        fecha: p.startDate,
        titulo: 'Inicio de Fase de Desarrollo',
        descripcion: 'Proyecto dado de alta formalmente en el tablero de producción.',
        icono: 'code',
        color: '#8b5cf6',
      });
    }

    // 6. Entrega y Garantía Técnica
    if (p.actaGarantiaFecha || p.endDate) {
      list.push({
        fecha: p.actaGarantiaFecha || p.endDate || '',
        titulo: 'Entrega Formal & Activación de Garantía 30d',
        descripcion: 'Emisión del Acta de Entrega Técnica inaugurando los 30 días de soporte.',
        icono: 'verified',
        color: '#10b981',
      });
    }

    // 7. Reseña de Calidad
    if (p.reviewCompleted) {
      list.push({
        fecha: p.updatedAt || '',
        titulo: `Reseña de Cliente Recibida (${p.reviewStars} ⭐)`,
        descripcion: p.reviewComment ? `"${p.reviewComment}"` : 'Calificación completada sin texto.',
        icono: 'star',
        color: '#f59e0b',
      });
    }

    // Ordenar cronológicamente
    return list.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }

  esGarantiaVencida(): boolean {
    const fecha = this.data.proyecto.actaGarantiaFecha || this.data.proyecto.endDate;
    if (!fecha) return false;
    const dias = (Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24);
    return dias > 30;
  }

  descargarContrato(): void {
    const cliente = this.data.cliente || ({
      name: this.data.propuesta?.clientPreviewName || 'Cliente',
      email: this.data.propuesta?.clientPreviewEmail || '',
      taxId: this.data.propuesta?.clientTaxId || '',
    } as any);

    generateContractPDF(cliente, this.data.propuesta);
    this.snackBar.open('📄 Contrato descargado con éxito.', '', { duration: 2500 });
  }

  descargarNDA(): void {
    const cliente = this.data.cliente || ({
      name: this.data.propuesta?.clientPreviewName || 'Cliente',
      email: this.data.propuesta?.clientPreviewEmail || '',
      taxId: this.data.propuesta?.clientTaxId || '',
    } as any);

    generateNDAPDF(cliente, this.data.propuesta);
    this.snackBar.open('🔒 Acuerdo NDA descargado con éxito.', '', { duration: 2500 });
  }

  descargarActaGarantia(): void {
    generateActaGarantiaPDF({
      proyectoTitulo: this.data.proyecto.title,
      clienteNombre: this.data.cliente?.name || 'Cliente',
      clienteCuit: this.data.cliente?.taxId || '',
      proveedorInfra: this.data.proyecto.proveedorInfra,
      cuentaInfra: this.data.proyecto.cuentaInfra,
      dominio: this.data.proyecto.dominio,
      fechaEntrega: this.data.proyecto.actaGarantiaFecha || this.data.proyecto.endDate || undefined,
      garantiaDias: 30,
    });
    this.snackBar.open('🛡️ Acta de Garantía descargada con éxito.', '', { duration: 2500 });
  }

  descargarRecibo(pago: Pago): void {
    const clientName = this.data.cliente?.name || 'Cliente';
    const clientTaxId = this.data.cliente?.taxId || '';
    const projectTitle = this.data.proyecto.title;

    generateReceiptPDF({
      pago,
      clientName,
      clientTaxId,
      projectTitle,
      totalAmount: this.data.proyecto.totalAmount,
    });
    this.snackBar.open(`🧾 Recibo ${pago.receiptNumber || ''} descargado.`, '', { duration: 2500 });
  }

  descargarDossierCompleto(): void {
    this.descargarContrato();
    setTimeout(() => this.descargarActaGarantia(), 400);
    if (this.data.pagos.length > 0) {
      setTimeout(() => this.descargarRecibo(this.data.pagos[0]), 800);
    }
    this.snackBar.open('📦 Dossier completo descargado (Contrato, Garantía y Recibos).', 'Cerrar', { duration: 4000 });
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}

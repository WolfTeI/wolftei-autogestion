import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import jsPDF from 'jspdf';

import { PropuestasService, Propuesta } from '../../../../service/propuestas.service';
import { ClientesService, Cliente } from '../../../../service/clientes.service';
import { CurrencyService } from '../../../../service/currency.service';
import { PagosService, Pago } from '../../../../service/pagos.service';
import { WhatsAppService } from '../../../../service/whatsapp.service';
import { RegistrarPagoDialogComponent } from './registrar-pago-dialog/registrar-pago-dialog.component';
import { generateReceiptPDF } from '../../../../utils/receipt-pdf-generator';
import { generateContractPDF, generateNDAPDF, generateBothLegalPDFs } from '../../../../utils/contract-pdf-generator';
import { obtenerFirmaActiva } from '../../../../utils/firma-oficial';
import { LOGO_WOLFTEI_BASE64 } from '../../../../utils/logo-oficial';

const ESTADOS = [
  { value: 'borrador',      label: 'Borrador',      color: '#888' },
  { value: 'enviado',       label: 'Enviado',        color: '#f59e0b' },
  { value: 'visto',         label: 'Visto',          color: '#3b82f6' },
  { value: 'aceptado',      label: 'Aceptado',       color: '#10b981' },
  { value: 'en_desarrollo', label: 'En Desarrollo',  color: '#8b5cf6' },
  { value: 'finalizado',    label: 'Finalizado',     color: '#6b7280' },
  { value: 'cancelado',     label: 'Cancelado',      color: '#ef4444' },
];

@Component({
  selector: 'app-detalle-propuesta',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatMenuModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './detalle-propuesta.component.html',
  styleUrl: './detalle-propuesta.component.scss',
})
export class DetallePropuestaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private propuestasService = inject(PropuestasService);
  private currencyService = inject(CurrencyService);
  private pagosService = inject(PagosService);
  private clientesService = inject(ClientesService);
  private whatsAppService = inject(WhatsAppService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  cargando = signal(true);
  propuesta = signal<Propuesta | null>(null);
  cliente = signal<Cliente | null>(null);
  pagos = signal<Pago[]>([]);
  estadosValidos = ESTADOS;
  actualizandoPrecio = signal(false);

  totalPagado = computed(() => {
    return this.pagos().reduce((acc, p) => acc + (p.amount || 0), 0);
  });

  saldoPendiente = computed(() => {
    const total = this.propuesta()?.totalAmount || 0;
    const pagado = this.totalPagado();
    return Math.max(0, total - pagado);
  });

  porcentajePagado = computed(() => {
    const total = this.propuesta()?.totalAmount || 0;
    if (total <= 0) return 0;
    return Math.min(100, Math.round((this.totalPagado() / total) * 100));
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.router.navigate(['/dashboard/propuestas']); return; }

    this.propuestasService.getById(id).subscribe({
      next: (data) => {
        this.propuesta.set(data);
        this.cargando.set(false);
        this.cargarPagos(id);
        if (data.clientId) {
          this.clientesService.getCliente(data.clientId).subscribe({
            next: (cli) => this.cliente.set(cli),
            error: () => {}
          });
        }
      },
      error: () => {
        this.snackBar.open('Error al cargar la propuesta.', 'Cerrar', { duration: 3000 });
        this.router.navigate(['/dashboard/propuestas']);
      },
    });
  }

  private getClienteObj(): Cliente {
    if (this.cliente()) return this.cliente()!;
    const p = this.propuesta();
    return {
      id: p?.clientId || '',
      name: p?.clientPreviewName || 'Cliente',
      email: p?.clientPreviewEmail || '',
      company: '',
      phone: '',
      address: '',
      taxId: ''
    };
  }

  descargarContrato() {
    const p = this.propuesta();
    if (!p) return;
    generateContractPDF(this.getClienteObj(), p);
    this.snackBar.open('📄 Contrato de Desarrollo generado con éxito.', 'Cerrar', { duration: 3000 });
  }

  descargarNDA() {
    const p = this.propuesta();
    if (!p) return;
    generateNDAPDF(this.getClienteObj(), p);
    this.snackBar.open('🔒 Acuerdo de Confidencialidad (NDA) generado con éxito.', 'Cerrar', { duration: 3000 });
  }

  descargarAmbosDocumentos() {
    const p = this.propuesta();
    if (!p) return;
    generateBothLegalPDFs(this.getClienteObj(), p);
    this.snackBar.open('📦 Contrato de Desarrollo y NDA generados con éxito.', 'Cerrar', { duration: 3000 });
  }

  getPublicUrl(): string {
    const p = this.propuesta();
    return p?.token ? `https://wolftei.com.ar/propuesta/${p.token}` : '';
  }

  copiarLink() {
    const url = this.getPublicUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      this.snackBar.open('🔗 Enlace copiado al portapapeles.', '', { duration: 3000 });
    });
  }

  descargarCarpetaCompleta() {
    const p = this.propuesta();
    if (!p) return;
    this.descargarPDF();
    setTimeout(() => {
      this.descargarContrato();
    }, 450);
    setTimeout(() => {
      this.descargarNDA();
    }, 900);
    this.snackBar.open('🖨️ Carpeta completa descargada: Presupuesto + Contrato + NDA listos para imprimir.', 'Cerrar', { duration: 4000 });
  }

  cargarPagos(propuestaId: string) {
    this.pagosService.listarPorPropuesta(propuestaId).subscribe({
      next: (lista) => this.pagos.set(lista),
      error: (err) => console.error('Error al cargar pagos:', err)
    });
  }

  async enviarPorWhatsApp() {
    const p = this.propuesta();
    if (!p?.token) return;
    const msg = this.whatsAppService.generarMensajePropuesta(
      p.clientPreviewName,
      p.title,
      p.token,
      p.validDays || 15
    );
    const phone = this.cliente()?.phone || '';
    if (phone) {
      this.snackBar.open(`💬 Abriendo WhatsApp con ${p.clientPreviewName}...`, 'Cerrar', { duration: 3500 });
    } else {
      this.snackBar.open('💬 Abriendo WhatsApp Web (mensaje copiado al portapapeles)...', 'Cerrar', { duration: 4000 });
    }
    await this.whatsAppService.abrirChat(phone, msg);
  }

  abrirRegistrarPagoDialog() {
    const p = this.propuesta();
    if (!p?.id) return;

    const dialogRef = this.dialog.open(RegistrarPagoDialogComponent, {
      width: '560px',
      data: {
        propuestaId: p.id,
        clientId: p.clientId,
        clientName: p.clientPreviewName,
        currency: p.currency,
        totalAmount: p.totalAmount,
        saldoPendiente: this.saldoPendiente()
      }
    });

    dialogRef.afterClosed().subscribe((pagoCreado) => {
      if (pagoCreado && p.id) {
        this.cargarPagos(p.id);
      }
    });
  }

  descargarRecibo(pago: Pago) {
    const p = this.propuesta();
    if (!p) return;
    generateReceiptPDF({
      pago,
      clientName: p.clientPreviewName,
      clientTaxId: p.clientTaxId,
      projectTitle: p.title,
      totalAmount: p.totalAmount,
      saldoRestante: this.saldoPendiente()
    });
    this.snackBar.open(`📄 Recibo descargado: ${pago.receiptNumber || 'recibo'}.pdf`, '', { duration: 3000 });
  }

  eliminarPago(pago: Pago) {
    if (!pago.id) return;
    if (!confirm(`¿Anular el pago ${pago.receiptNumber || ''} de ${pago.currency} ${pago.amount}?`)) return;

    this.pagosService.eliminar(pago.id).subscribe({
      next: () => {
        this.snackBar.open('Pago eliminado correctamente.', 'Cerrar', { duration: 3000 });
        if (this.propuesta()?.id) {
          this.cargarPagos(this.propuesta()!.id!);
        }
      },
      error: () => this.snackBar.open('Error al eliminar el pago.', 'Cerrar', { duration: 3000 })
    });
  }

  getStatusLabel(s: string) { return ESTADOS.find(e => e.value === s)?.label ?? s; }
  getStatusColor(s: string) { return ESTADOS.find(e => e.value === s)?.color ?? '#888'; }

  editarPropuesta() {
    const p = this.propuesta();
    if (!p?.id) return;
    this.router.navigate(['/dashboard/propuestas', p.id, 'editar']);
  }

  cambiarEstado(nuevoEstado: string) {
    const p = this.propuesta();
    if (!p?.id) return;
    this.propuestasService.cambiarEstado(p.id, nuevoEstado).subscribe({
      next: () => {
        this.propuesta.update(prev => prev ? { ...prev, status: nuevoEstado } : prev);
        this.snackBar.open(`Estado → "${this.getStatusLabel(nuevoEstado)}"`, '', { duration: 2500 });
      },
      error: () => this.snackBar.open('Error al cambiar estado.', 'Cerrar', { duration: 3000 }),
    });
  }

  revivirPropuesta() {
    const p = this.propuesta();
    if (!p?.id || !p.pricingDetails) {
      this.snackBar.open('Faltan datos de pricing para recalcular.', 'Cerrar', { duration: 3000 });
      return;
    }

    if (!confirm('¿Estás seguro de que querés revivir esta propuesta? Esto recalculará el monto usando el dólar actual y la devolverá a estado "borrador".')) {
      return;
    }

    this.actualizandoPrecio.set(true);

    this.currencyService.getExchangeRates().subscribe({
      next: (rates) => {
        const pricing = p.pricingDetails!;
        const baseCostUSD = (pricing.devHours || 0) * (pricing.baseRate || 0);
        const pmCostUSD = baseCostUSD * ((pricing.pmMarginPercent || 0) / 100);
        const riskCostUSD = baseCostUSD * ((pricing.riskMarginPercent || 0) / 100);
        const invCostUSD = baseCostUSD * ((pricing.investigationMarginPercent || 0) / 100);

        let subtotalUSD = baseCostUSD + pmCostUSD + riskCostUSD + invCostUSD;

        // Buscar el dólar blue o fallback a 1000
        const rateData = rates.find(c => c.casa === 'blue');
        const exchangeRate = rateData ? rateData.venta : 1000;

        // Calcular ítems de infraestructura
        let infraARS = 0;
        let infraUSD = 0;
        (p.infrastructureItems || []).forEach(item => {
          const price = Number(item.price) || 0;
          if (item.currency === 'ARS') {
            infraARS += price;
            infraUSD += price / exchangeRate;
          } else {
            infraUSD += price;
            infraARS += price * exchangeRate;
          }
        });

        let finalAmount = 0;
        const discount = p.discountPercent || 0;

        if (p.currency === 'ARS') {
          let subtotalARS = subtotalUSD * exchangeRate;
          finalAmount = subtotalARS + infraARS;
        } else {
          finalAmount = subtotalUSD + infraUSD;
        }

        finalAmount = finalAmount - (finalAmount * (discount / 100));
        finalAmount = Math.ceil(finalAmount);

        // Actualizar en backend
        this.propuestasService.actualizar(p.id!, {
          status: 'borrador',
          totalAmount: finalAmount
        }).subscribe({
          next: () => {
            this.propuesta.update(prev => prev ? { ...prev, status: 'borrador', totalAmount: finalAmount } : prev);
            this.actualizandoPrecio.set(false);
            this.snackBar.open('¡Propuesta revivida y precio actualizado con el dólar actual!', 'Cerrar', { duration: 4000 });
          },
          error: () => {
            this.actualizandoPrecio.set(false);
            this.snackBar.open('Error al actualizar la propuesta.', 'Cerrar', { duration: 3000 });
          }
        });
      },
      error: () => {
        this.actualizandoPrecio.set(false);
        this.snackBar.open('Error al obtener la cotización del dólar.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  /**
   * Genera el PDF del Presupuesto (Anexo I) usando jsPDF de forma nativa.
   * No depende de html2canvas — cero vulnerabilidades de seguridad.
   */
  async descargarPDF() {
    const p = this.propuesta();
    if (!p) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const marginLeft = 40; 
    const marginRight = 15; 
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - marginLeft - marginRight;
    let y = 20;

    const addLine = (text: string, size = 10, bold = false, color = [30, 30, 50] as [number,number,number]) => {
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, marginLeft, y);
      y += (lines.length * (size * 0.45)) + 2;
    };

    const addSection = (num: string, title: string, requiredSpace: number = 25) => {
      if (y + requiredSpace > 270) { doc.addPage(); y = 20; }
      else { y += 6; }
      
      doc.setFillColor(102, 126, 234);
      doc.rect(marginLeft, y, maxWidth, 8, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(`${num}. ${title}`, marginLeft + 3, y + 5.5);
      y += 12;
    };

    const checkPage = (requiredSpace: number = 10) => {
      if (y + requiredSpace > 280) { doc.addPage(); y = 20; }
    };

    // ── Cabecera ──
    doc.setFillColor(10, 10, 25);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    // Isotipo WolfTeI Oficial
    try {
      doc.addImage(LOGO_WOLFTEI_BASE64, 'PNG', 10, 8, 24, 24);
    } catch (_) {}
    
    const headerTextX = 38;
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('WOLFTEI', headerTextX, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 200);
    doc.text('Soluciones de Software & Desarrollo Digital', headerTextX, 22);
    doc.text('info@wolftei.com.ar  |  wolftei.com.ar', headerTextX, 28);
    y = 50;

    addLine('ANEXO I — PROPUESTA TÉCNICA Y PRESUPUESTO', 14, true, [30, 30, 80]);
    y += 4;
    addLine(`Cliente: ${p.clientPreviewName}`, 10);
    addLine(`Proyecto: ${p.title}`, 10);
    if (p.token) addLine(`Token: ${p.token}`, 10, false, [100, 100, 140]);
    addLine(`Fecha de emisión: ${new Date(p.createdAt!).toLocaleDateString('es-AR')}`, 10);
    addLine(`Validez de la oferta: ${p.validDays} días corridos`, 10);
    y += 2;

    // ── Objetivo ──
    addSection('1', 'DIAGNÓSTICO Y OBJETIVO', 30);
    addLine(p.objective || 'Sin descripción.', 10);

    // ── Alcance Funcional ──
    addSection('2', 'ALCANCE FUNCIONAL', 35);
    (p.modules || []).forEach((m, i) => {
      checkPage(15);
      addLine(`• Módulo ${i + 1} — ${m.name}`, 10, true);
      if (m.description) addLine(`  ${m.description}`, 9, false, [70, 70, 100]);
      y += 2;
    });

    // ── Specs Técnicas ──
    addSection('3', 'ESPECIFICACIONES TÉCNICAS', 35);
    addLine(`Plataforma: ${p.platform}`, 10);
    addLine(`Stack tecnológico: ${p.techStack}`, 10);
    if (p.persistence) addLine(`Persistencia / Base de datos: ${p.persistence}`, 10);
    addLine('Estándares: Arquitectura modular, validación estricta de datos y buenas prácticas de seguridad.', 10);

    // ── Cronograma ──
    addSection('4', 'CRONOGRAMA ESTIMADO', 35);
    (p.phases || []).forEach(f => {
      checkPage(10);
      addLine(`• ${f.label}  -  ${f.weeks}`, 10);
    });

    // ── Inversión ──
    addSection('5', 'INVERSIÓN Y CONDICIONES COMERCIALES', 45);
    const montoFmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: p.currency, maximumFractionDigits: 0 }).format(p.totalAmount);
    
    addLine(`Inversión Total: ${montoFmt} ${p.currency}`, 11, true, [60, 30, 100]);
    if (p.discountPercent && p.discountPercent > 0) {
      addLine(`(Incluye descuento especial del ${p.discountPercent}% en el total)`, 9, false, [16, 185, 129]);
    }
    
    y += 2;
    addLine(`• 50% de Anticipo para iniciar: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: p.currency, maximumFractionDigits: 0 }).format(p.totalAmount / 2)} ${p.currency}`, 10, true);
    addLine(`• 50% de Saldo contra entrega: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: p.currency, maximumFractionDigits: 0 }).format(p.totalAmount / 2)} ${p.currency}`, 10, true);
    y += 2;

    addLine(`Esquema de pago: ${p.paymentTerms}`, 10);
    addLine(`Garantía técnica: ${p.warrantyDays} días corridos post-entrega.`, 10);
    if (p.notes) { addLine(`Notas: ${p.notes}`, 9); }

    // ── Sección de Firma ──
    checkPage(40);
    y += 12;
    doc.setDrawColor(180, 180, 220);
    doc.line(marginLeft, y, pageWidth - marginRight, y);
    y += 8;
    
    const rightSignatureX = pageWidth - marginRight - 60;
    
    // Firma Cliente (Izquierda)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Por EL CLIENTE:', marginLeft, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Firma: ____________________', marginLeft, y + 6);
    doc.text('Aclaración: ________________', marginLeft, y + 11);
    doc.text('DNI / CUIT: _______________', marginLeft, y + 16);
    doc.text('Fecha: ____ / ____ / _______', marginLeft, y + 21);

    // Firma WolfTeI (Derecha)
    const firmaActiva = obtenerFirmaActiva();
    if (firmaActiva) {
      try {
        doc.addImage(firmaActiva, 'PNG', rightSignatureX + 16, y - 18, 18, 38);
      } catch (_) {}
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Por WolfTeI (El Prestador):', rightSignatureX, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Firma: ____________________', rightSignatureX, y + 6);
    doc.text('Aclaración: Carlos Alberto Prost', rightSignatureX, y + 11);
    doc.text('CUIT/CUIL: 20-33607855-6', rightSignatureX, y + 16);
    doc.text('H. Quiroga 3343, Libertad, Merlo', rightSignatureX, y + 21);
    
    y += 30;

    // ── Pie de página ──
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 180);
      doc.text(`WolfTeI — Propuesta ${p.token ?? ''}  |  Página ${i} de ${pageCount}`, marginLeft, 292);
    }

    const filename = `WolfTeI_Presupuesto_${p.token ?? 'draft'}.pdf`;
    doc.save(filename);
    this.snackBar.open(`📄 PDF descargado: ${filename}`, '', { duration: 3000 });
  }

  volver() {
    this.router.navigate(['/dashboard/propuestas']);
  }
}




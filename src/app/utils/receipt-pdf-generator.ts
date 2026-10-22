import jsPDF from 'jspdf';
import { Pago } from '../service/pagos.service';
import { obtenerFirmaActiva } from './firma-oficial';
import { LOGO_WOLFTEI_BASE64 } from './logo-oficial';

export interface ReceiptData {
  pago: Pago;
  clientName: string;
  clientTaxId?: string;
  projectTitle: string;
  totalAmount?: number;
  saldoRestante?: number;
}

/**
 * Genera y descarga el Recibo Oficial de Cobranza en PDF usando jsPDF de forma nativa.
 */
export function generateReceiptPDF(data: ReceiptData): void {
  const { pago, clientName, clientTaxId, projectTitle, totalAmount, saldoRestante } = data;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const marginLeft = 35;
  const marginRight = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginLeft - marginRight;
  let y = 20;

  // ── Cabecera Corporativa ──
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Isotipo WolfTeI Oficial
  try {
    doc.addImage(LOGO_WOLFTEI_BASE64, 'PNG', 10, 9, 24, 24);
  } catch (_) {}

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('WOLFTEI', 38, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('Soluciones de Software & Desarrollo Digital', 38, 24);
  doc.text('info@wolftei.com.ar | wolftei.com.ar', 38, 29);

  // Recuadro de número de recibo (Derecha)
  const boxWidth = 55;
  const boxX = pageWidth - marginRight - boxWidth;
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.roundedRect(boxX, 10, boxWidth, 24, 2, 2, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('RECIBO OFICIAL', boxX + 6, 17);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(129, 140, 248); // Indigo 400
  doc.text(pago.receiptNumber || 'REC-000000', boxX + 6, 23);

  const fechaStr = new Date(pago.createdAt || Date.now()).toLocaleDateString('es-AR');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Fecha: ${fechaStr}`, boxX + 6, 29);

  y = 56;

  // ── Datos del Pagador (Cliente) ──
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.rect(marginLeft, y, maxWidth, 24, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('RECIBIMOS DE:', marginLeft + 4, y + 7);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(clientName || 'Cliente Particular', marginLeft + 35, y + 7);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  if (clientTaxId) {
    doc.text(`CUIT / Identificación: ${clientTaxId}`, marginLeft + 35, y + 13);
  }
  doc.text(`Proyecto Asociado: ${projectTitle}`, marginLeft + 35, y + 19);

  y += 34;

  // ── Detalle del Pago ──
  doc.setFillColor(102, 126, 234);
  doc.rect(marginLeft, y, maxWidth, 8, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('DETALLE DEL COBRO', marginLeft + 4, y + 5.5);

  y += 14;

  const conceptLabels: Record<string, string> = {
    anticipo: 'Anticipo inicial para inicio de desarrollo',
    saldo: 'Saldo contra entrega final del proyecto',
    total: 'Cancelación total del 100% del proyecto',
    cuota: 'Cuota correspondiente al plan de pagos',
    otro: 'Cobro de servicios de software'
  };

  const methodLabels: Record<string, string> = {
    transferencia: 'Transferencia Bancaria',
    usdt: 'Criptomoneda (USDT / Binance)',
    mercadopago: 'Mercado Pago',
    efectivo: 'Efectivo / Cash'
  };

  const labelConcept = conceptLabels[pago.concept] || pago.concept;
  const labelMethod = methodLabels[pago.paymentMethod] || pago.paymentMethod;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`• Concepto:`, marginLeft, y);
  doc.setFont('helvetica', 'bold');
  doc.text(labelConcept, marginLeft + 28, y);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.text(`• Forma de Pago:`, marginLeft, y);
  doc.setFont('helvetica', 'bold');
  doc.text(labelMethod, marginLeft + 28, y);

  if (pago.exchangeRate && pago.exchangeRate > 1) {
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.text(`• Tipo de Cambio:`, marginLeft, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`1 USD = ${pago.exchangeRate} ARS`, marginLeft + 28, y);
  }

  if (pago.notes) {
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.text(`• Comprobante/Ref:`, marginLeft, y);
    doc.setFont('helvetica', 'normal');
    doc.text(pago.notes, marginLeft + 28, y);
  }

  y += 14;

  // ── Cuadro de Liquidación y Desglose Financiero ──
  const fmt = (val: number) => new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: pago.currency,
    maximumFractionDigits: 0
  }).format(val);

  if (totalAmount && totalAmount > 0) {
    const calcPct = Math.round((pago.amount / totalAmount) * 100);
    const saldoFinal = saldoRestante !== undefined ? saldoRestante : Math.max(0, totalAmount - pago.amount);

    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginLeft, y, maxWidth, 24, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Inversión Total Acordada:', marginLeft + 6, y + 7);
    doc.text(`Cobro Percibido (${calcPct}%):`, marginLeft + 6, y + 14);
    doc.text('Saldo Restante por Cancelar:', marginLeft + 6, y + 21);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`${fmt(totalAmount)} ${pago.currency}`, pageWidth - marginRight - 6, y + 7, { align: 'right' });
    doc.setTextColor(16, 185, 129); // Verde
    doc.text(`${fmt(pago.amount)} ${pago.currency}`, pageWidth - marginRight - 6, y + 14, { align: 'right' });
    doc.setTextColor(239, 68, 68); // Rojo
    doc.text(`${fmt(saldoFinal)} ${pago.currency}`, pageWidth - marginRight - 6, y + 21, { align: 'right' });

    y += 28;
  }

  // ── Cuadro de Importe Total Percibido ──
  doc.setFillColor(238, 242, 255); // Indigo 50
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(marginLeft, y, maxWidth, 16, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(67, 56, 202); // Indigo 700
  doc.text('TOTAL PERCIBIDO EN ESTE ACTO:', marginLeft + 6, y + 10.5);

  doc.setFontSize(14);
  doc.text(`${fmt(pago.amount)} ${pago.currency}`, pageWidth - marginRight - 6, y + 10.5, { align: 'right' });

  y += 28;

  // ── Bloque de Firma y Validez ──
  doc.setDrawColor(203, 213, 225);
  doc.line(marginLeft, y, pageWidth - marginRight, y);

  y += 7;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Comprobante emitido de forma digital por WolfTeI. Válido como constancia de recepción de fondos.', marginLeft, y);

  y += 14;
  const signX = pageWidth - marginRight - 65;

  // Estampado de Firma Real Oficial de Carlos Alberto Prost
  const firmaActiva = obtenerFirmaActiva();
  if (firmaActiva) {
    try {
      // Estampado de firma vertical auténtica
      doc.addImage(firmaActiva, 'PNG', signX + 16, y - 24, 18, 38);
    } catch (_) {
      // Fallback silencioso si falla formato
    }
  }

  y += 4;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Por WolfTeI:', signX, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Carlos Alberto Prost', signX, y + 5);
  doc.text('CUIT/CUIL: 20-33607855-6', signX, y + 10);
  doc.text('H. Quiroga 3343, Libertad, Merlo', signX, y + 15);

  const filename = `WolfTeI_${pago.receiptNumber || 'Recibo'}.pdf`;
  doc.save(filename);
}

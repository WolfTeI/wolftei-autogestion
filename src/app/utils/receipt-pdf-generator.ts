import jsPDF from 'jspdf';
import { Pago } from '../service/pagos.service';
import { FiscalSettings, FISCAL_DEFAULTS } from '../service/fiscal.service';
import { obtenerFirmaActiva } from './firma-oficial';
import { LOGO_WOLFTEI_BASE64 } from './logo-oficial';
import { BRAND_CONFIG } from '../service/brand.service';

export interface ReceiptData {
  pago: Pago;
  clientName: string;
  clientTaxId?: string;
  projectTitle: string;
  totalAmount?: number;
  saldoRestante?: number;
  fiscal?: FiscalSettings;
}

/**
 * Genera y descarga el Recibo Oficial de Cobranza en PDF usando jsPDF de forma nativa.
 * Diseñado bajo el estándar corporativo premium de WolfTeI, con márgenes simétricos,
 * text wrapping dinámico en proyectos y conceptos, y estética financiera de alta fidelidad.
 */
export function generateReceiptPDF(data: ReceiptData): void {
  const { pago, clientName, clientTaxId, projectTitle, totalAmount, saldoRestante } = data;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const marginLeft = 18;
  const marginRight = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginLeft - marginRight; // 174 mm
  let y = 18;

  // ══════════════════════════════════════════════════════════════════════
  // 1. CABECERA CORPORATIVA WOLFTEI
  // ══════════════════════════════════════════════════════════════════════
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Filete tecnológico inferior en azul WolfTeI
  doc.setFillColor(59, 130, 246); // Blue 500
  doc.rect(0, 36.8, pageWidth, 1.2, 'F');

  // Isotipo Oficial de WolfTeI
  try {
    doc.addImage(LOGO_WOLFTEI_BASE64, 'PNG', 14, 7, 24, 24);
  } catch (_) {}

  // Datos de la Marca
  doc.setFontSize(21);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(BRAND_CONFIG.name, 42, 17);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text(BRAND_CONFIG.tagline, 42, 23);
  doc.text(`${BRAND_CONFIG.website} · ${BRAND_CONFIG.email}`, 42, 28);

  // Tarjeta de Metadatos del Recibo (Derecha)
  const metaBoxW = 62;
  const metaBoxX = pageWidth - marginRight - metaBoxW;
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.roundedRect(metaBoxX, 8, metaBoxW, 22, 2, 2, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(96, 165, 250); // Blue 400
  doc.text('RECIBO OFICIAL', metaBoxX + metaBoxW / 2, 14, { align: 'center' });

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(pago.receiptNumber || 'REC-000000', metaBoxX + metaBoxW / 2, 19.5, { align: 'center' });

  const fechaStr = new Date(pago.createdAt || Date.now()).toLocaleDateString('es-AR');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text(`Fecha: ${fechaStr}`, metaBoxX + metaBoxW / 2, 24.5, { align: 'center' });

  y = 45;

  // ══════════════════════════════════════════════════════════════════════
  // 2. TARJETA DE RECEPTOR (CLIENTE) Y PROYECTO ASOCIADO
  // ══════════════════════════════════════════════════════════════════════
  const cardPadX = 6;
  const cardContentW = maxWidth - cardPadX * 2;

  // Cálculo seguro del texto del proyecto para evitar desbordes
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const projectLabelW = 28; // Ancho reservado para "Proyecto Asociado:"
  const projectTextAvailableW = cardContentW - projectLabelW;
  const rawProjectTitle = projectTitle || 'Servicios Digitales y Desarrollo de Software';
  const projectLines = doc.splitTextToSize(rawProjectTitle, projectTextAvailableW);

  // Cálculo dinámico de altura de tarjeta
  let clienteCardHeight = 18 + (clientTaxId ? 5 : 0) + Math.max(1, projectLines.length) * 4.5;
  clienteCardHeight = Math.max(clienteCardHeight, 26);

  // Contenedor tarjeta
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.3);
  doc.roundedRect(marginLeft, y, maxWidth, clienteCardHeight, 2, 2, 'FD');

  let curCardY = y + 5.5;

  // Etiqueta "RECIBIMOS DE"
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text('RECIBIMOS DE:', marginLeft + cardPadX, curCardY);

  // Nombre del Cliente
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(clientName || 'Cliente Particular', marginLeft + cardPadX + 26, curCardY);

  curCardY += 6;

  // CUIT / Identificación fiscal
  if (clientTaxId) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105); // Slate 600
    doc.text(`CUIT / Identificación: ${clientTaxId}`, marginLeft + cardPadX, curCardY);
    curCardY += 5;
  }

  // Proyecto Asociado con Text Wrapping estricto
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105); // Slate 600
  doc.text('Proyecto Asociado:', marginLeft + cardPadX, curCardY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42); // Slate 900
  projectLines.forEach((line: string, idx: number) => {
    doc.text(line, marginLeft + cardPadX + projectLabelW, curCardY + idx * 4.5);
  });

  y += clienteCardHeight + 8;

  // ══════════════════════════════════════════════════════════════════════
  // 3. DETALLE DEL COBRO (CONCEPTO, MÉTODO, NOTAS)
  // ══════════════════════════════════════════════════════════════════════
  const conceptLabels: Record<string, string> = {
    anticipo: 'Anticipo inicial para inicio de desarrollo',
    saldo: 'Saldo contra entrega final del proyecto',
    total: 'Cancelación total del 100% del proyecto',
    cuota: 'Cuota correspondiente al plan de pagos',
    otro: 'Cobro de servicios de software y consultoría tecnológica'
  };

  const methodLabels: Record<string, string> = {
    transferencia: 'Transferencia Bancaria',
    usdt: 'Criptomoneda (USDT / Red Binance)',
    mercadopago: 'Mercado Pago',
    efectivo: 'Efectivo / Cash'
  };

  const labelConcept = conceptLabels[pago.concept] || pago.concept;
  const labelMethod = methodLabels[pago.paymentMethod] || pago.paymentMethod;

  // Encabezado de Sección
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.roundedRect(marginLeft, y, maxWidth, 7.5, 1.5, 1.5, 'F');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('DETALLE DEL COBRO', marginLeft + 5, y + 5);

  y += 12;

  // Fila: Concepto
  const valColX = marginLeft + 34;
  const valAvailableW = maxWidth - 36;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text('• Concepto:', marginLeft + 2, y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59); // Slate 800
  const conceptLines = doc.splitTextToSize(labelConcept, valAvailableW);
  conceptLines.forEach((line: string, idx: number) => {
    doc.text(line, valColX, y + idx * 4.5);
  });
  y += Math.max(1, conceptLines.length) * 4.5 + 2.5;

  // Fila: Forma de Pago
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('• Forma de Pago:', marginLeft + 2, y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(labelMethod, valColX, y);
  y += 6.5;

  // Fila opcional: Tipo de Cambio
  if (pago.exchangeRate && pago.exchangeRate > 1) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('• Tipo de Cambio:', marginLeft + 2, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`1 USD = $ ${pago.exchangeRate.toLocaleString('es-AR')} ARS`, valColX, y);
    y += 6.5;
  }

  // Fila opcional: Comprobante / Referencia
  if (pago.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('• Comprobante/Ref:', marginLeft + 2, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const noteLines = doc.splitTextToSize(pago.notes, valAvailableW);
    noteLines.forEach((line: string, idx: number) => {
      doc.text(line, valColX, y + idx * 4.5);
    });
    y += Math.max(1, noteLines.length) * 4.5 + 2.5;
  }

  y += 4;

  // ══════════════════════════════════════════════════════════════════════
  // 4. DESGLOSE FINANCIERO Y SALDO (SI HAY PRESUPUESTO ASOCIADO)
  // ══════════════════════════════════════════════════════════════════════
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
    doc.text('Inversión Total Acordada:', marginLeft + 6, y + 6.5);
    doc.text(`Cobro Percibido en este Acto (${calcPct}%):`, marginLeft + 6, y + 13);
    doc.text('Saldo Restante por Cancelar:', marginLeft + 6, y + 19.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`${fmt(totalAmount)} ${pago.currency}`, pageWidth - marginRight - 6, y + 6.5, { align: 'right' });

    doc.setTextColor(16, 185, 129); // Verde esmeralda
    doc.text(`${fmt(pago.amount)} ${pago.currency}`, pageWidth - marginRight - 6, y + 13, { align: 'right' });

    doc.setTextColor(saldoFinal > 0 ? 239 : 100, saldoFinal > 0 ? 68 : 116, saldoFinal > 0 ? 68 : 139);
    doc.text(`${fmt(saldoFinal)} ${pago.currency}`, pageWidth - marginRight - 6, y + 19.5, { align: 'right' });

    y += 30;
  } else {
    y += 4;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 5. CAJA DESTACADA DE TOTAL PERCIBIDO
  // ══════════════════════════════════════════════════════════════════════
  doc.setFillColor(240, 253, 244); // Green 50
  doc.setDrawColor(187, 247, 208); // Green 200
  doc.setLineWidth(0.4);
  doc.roundedRect(marginLeft, y, maxWidth, 18, 2, 2, 'FD');

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52); // Green 800
  doc.text('TOTAL PERCIBIDO EN ESTE ACTO:', marginLeft + 6, y + 11);

  doc.setFontSize(14.5);
  doc.setTextColor(21, 128, 61); // Green 700
  doc.text(`${fmt(pago.amount)} ${pago.currency}`, pageWidth - marginRight - 6, y + 11.5, { align: 'right' });

  y += 26;

  // ══════════════════════════════════════════════════════════════════════
  // 6. BLOQUE DE VALIDEZ LEGAL Y FIRMA OFICIAL
  // ══════════════════════════════════════════════════════════════════════
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.3);
  doc.line(marginLeft, y, pageWidth - marginRight, y);

  y += 7;

  // Leyenda de validez
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate 400
  const legalText = 'Comprobante digital emitido por WolfTeI. Válido como constancia de recepción de fondos y acreditación financiera.';
  const legalLines = doc.splitTextToSize(legalText, maxWidth - 75);
  legalLines.forEach((l: string, i: number) => {
    doc.text(l, marginLeft, y + i * 4);
  });

  // Estampado de Firma Oficial a la derecha
  const signX = pageWidth - marginRight - 65;
  const firmaActiva = obtenerFirmaActiva();
  if (firmaActiva) {
    try {
      // Posición calibrada para integrarse armoniosamente sobre la línea de firma
      doc.addImage(firmaActiva, 'PNG', signX + 16, y - 10, 18, 36);
    } catch (_) {}
  }

  const signInfoY = y + 16;
  const fiscalData = data.fiscal || FISCAL_DEFAULTS;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text('Por WolfTeI:', signX, signInfoY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(fiscalData.razonSocial, signX, signInfoY + 4.5);
  doc.text(`CUIT: ${fiscalData.cuit}`, signX, signInfoY + 9);
  doc.text(`${fiscalData.localidad}, ${fiscalData.provincia}`, signX, signInfoY + 13.5);

  // ══════════════════════════════════════════════════════════════════════
  // 7. PIE DE PÁGINA CORPORATIVO
  // ══════════════════════════════════════════════════════════════════════
  const footerY = pageHeight - 12;
  doc.setDrawColor(241, 245, 249);
  doc.line(marginLeft, footerY - 4, pageWidth - marginRight, footerY - 4);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const footerText = `${BRAND_CONFIG.name} · ${BRAND_CONFIG.tagline} · ${BRAND_CONFIG.fullSlogan}`;
  doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });

  // Guardar archivo
  const filename = `WolfTeI_${pago.receiptNumber || 'Recibo'}.pdf`;
  doc.save(filename);
}

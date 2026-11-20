import jsPDF from 'jspdf';
import { LOGO_WOLFTEI_BASE64 } from './logo-oficial';
import { InformeTecnico } from '../service/informes-tecnicos.service';
import { BRAND_CONFIG } from '../service/brand.service';

/**
 * Genera y descarga el Informe Diagnóstico & Propuesta Técnica en PDF.
 * Diseñado con estética corporativa de alto impacto fiel al estilo visual de WolfTeI,
 * resolviendo el renderizado vectorial, evitando caracteres rotos y optimizando la paginación.
 */
export function generateInformePDF(informe: InformeTecnico): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 18;
  const marginRight = 18;
  const maxWidth = pageWidth - marginLeft - marginRight;
  let y = 18;

  /**
   * Comprueba si el contenido requiere un salto de página preventivo.
   */
  const checkPageBreak = (spaceNeeded: number) => {
    if (y + spaceNeeded >= pageHeight - 20) {
      doc.addPage();
      y = 22; // Margen superior en páginas subsecuentes para el running header
    }
  };

  /**
   * Dibuja un icono vectorial de tilde (checkmark) en un círculo verde.
   * Evita problemas de codificación Unicode en jsPDF.
   */
  const drawCheckmark = (cx: number, cy: number, r = 2.2) => {
    doc.setFillColor(16, 185, 129); // Esmeralda / Verde éxito
    doc.circle(cx, cy, r, 'F');

    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.45);
    doc.line(cx - 1.0, cy - 0.1, cx - 0.3, cy + 0.8);
    doc.line(cx - 0.3, cy + 0.8, cx + 1.1, cy - 0.8);
  };

  /**
   * Dibuja un icono vectorial de alerta (cruz o punto) en un círculo rojo.
   */
  const drawAlertIcon = (cx: number, cy: number, r = 2.2) => {
    doc.setFillColor(239, 68, 68); // Rojo acento
    doc.circle(cx, cy, r, 'F');

    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.45);
    doc.line(cx - 0.8, cy - 0.8, cx + 0.8, cy + 0.8);
    doc.line(cx - 0.8, cy + 0.8, cx + 0.8, cy - 0.8);
  };

  // ══════════════════════════════════════════════════════════════════════
  // PÁGINA 1: CABECERA CORPORATIVA PRINCIPAL
  // ══════════════════════════════════════════════════════════════════════
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Acento tecnológico inferior en la cabecera
  doc.setFillColor(59, 130, 246); // Blue 500
  doc.rect(0, 36.8, pageWidth, 1.2, 'F');

  // Logo Oficial
  try {
    doc.addImage(LOGO_WOLFTEI_BASE64, 'PNG', 14, 7, 24, 24);
  } catch (_) {}

  doc.setFontSize(21);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(BRAND_CONFIG.name, 42, 17);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text(BRAND_CONFIG.tagline, 42, 23);
  doc.text(`${BRAND_CONFIG.website} · ${BRAND_CONFIG.email}`, 42, 28);

  // Recuadro de Metadatos Documentales (Derecha)
  const metaBoxW = 62;
  const metaBoxX = pageWidth - marginRight - metaBoxW;
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.roundedRect(metaBoxX, 8, metaBoxW, 22, 2, 2, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(96, 165, 250); // Blue 400
  doc.text('PROPUESTA TÉCNICA', metaBoxX + metaBoxW / 2, 15, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.setFontSize(7.5);
  doc.text(`Ref: ${informe.token || 'WLF-INF'}`, metaBoxX + metaBoxW / 2, 20.5, { align: 'center' });
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, metaBoxX + metaBoxW / 2, 25.5, { align: 'center' });

  y = 46;

  // ── Tarjeta de Destinatario / Cliente ──
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.3);
  doc.roundedRect(marginLeft, y, maxWidth, 20, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text('PREPARADO PARA:', marginLeft + 6, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFontSize(10.5);
  const clienteStr = `${informe.clientName}${informe.clientCompany ? ' (' + informe.clientCompany + ')' : ''}`;
  doc.text(clienteStr, marginLeft + 6, y + 12);

  if (informe.clientEmail || informe.clientPhone) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const contactoStr = [
      informe.clientEmail ? `Email: ${informe.clientEmail}` : '',
      informe.clientPhone ? `Tel: ${informe.clientPhone}` : '',
    ].filter(Boolean).join('  ·  ');
    doc.text(contactoStr, marginLeft + 6, y + 16.5);
  }

  y += 26;

  // ── Título Principal del Informe ──
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(informe.title, maxWidth);
  doc.text(titleLines, marginLeft, y);
  y += titleLines.length * 6.5 + 4;

  // ══════════════════════════════════════════════════════════════════════
  // SECCIÓN 1: DIAGNÓSTICO & PROBLEMÁTICA DETECTADA
  // ══════════════════════════════════════════════════════════════════════
  checkPageBreak(32);
  doc.setFillColor(239, 68, 68); // Rojo alerta
  doc.rect(marginLeft, y, 3, 7, 'F');
  doc.setFontSize(11.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('1. Diagnóstico & Problemática Detectada', marginLeft + 6, y + 5.5);
  y += 11;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85); // Slate 700
  const situacionLines = doc.splitTextToSize(informe.situacionActual, maxWidth);
  doc.text(situacionLines, marginLeft, y);
  y += situacionLines.length * 4.6 + 5;

  // Puntos Críticos Identificados
  if (informe.problemasDetectados && informe.problemasDetectados.length > 0) {
    checkPageBreak(18);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(153, 27, 27); // Red 800
    doc.text('PUNTOS CRÍTICOS IDENTIFICADOS:', marginLeft, y);
    y += 5.5;

    informe.problemasDetectados.forEach((prob) => {
      const probLines = doc.splitTextToSize(prob, maxWidth - 10);
      const itemH = Math.max(7, probLines.length * 4.3 + 3);
      checkPageBreak(itemH + 2);

      // Fondo sutil para cada item
      doc.setFillColor(254, 242, 242); // Red 50
      doc.setDrawColor(254, 202, 202); // Red 200
      doc.setLineWidth(0.2);
      doc.roundedRect(marginLeft, y, maxWidth, itemH, 1.2, 1.2, 'FD');

      drawAlertIcon(marginLeft + 4.5, y + 3.8, 1.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(185, 28, 28); // Red 700
      doc.text(probLines, marginLeft + 9, y + 4.2);

      y += itemH + 2.5;
    });
    y += 3;
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECCIÓN 2: PROPUESTA DE SOLUCIÓN & ALCANCES
  // ══════════════════════════════════════════════════════════════════════
  checkPageBreak(35);
  doc.setFillColor(59, 130, 246); // Azul Tech
  doc.rect(marginLeft, y, 3, 7, 'F');
  doc.setFontSize(11.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('2. Propuesta de Solución & Arquitectura', marginLeft + 6, y + 5.5);
  y += 11;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const solucionLines = doc.splitTextToSize(informe.resumenSolucion, maxWidth);
  doc.text(solucionLines, marginLeft, y);
  y += solucionLines.length * 4.6 + 5;

  // Desglose de Componentes a Desarrollar
  if (informe.modulosSolucion && informe.modulosSolucion.length > 0) {
    // Si queda poco espacio, salta de página ANTES de poner el título de los componentes
    checkPageBreak(42);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('COMPONENTES & DESARROLLO DE FONDO:', marginLeft, y);
    y += 6;

    informe.modulosSolucion.forEach((mod, idx) => {
      const descLines = doc.splitTextToSize(mod.descripcion, maxWidth - 14);
      const impactoLines = mod.impactoOValor
        ? doc.splitTextToSize(`Impacto: ${mod.impactoOValor}`, maxWidth - 16)
        : [];

      const impactBoxH = impactoLines.length > 0 ? impactoLines.length * 4 + 4 : 0;
      const cardHeight = 11 + descLines.length * 4.2 + impactBoxH + (mod.tiempoEstimadoSugerido ? 5 : 0);

      checkPageBreak(cardHeight + 4);

      // Card Container
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.setLineWidth(0.25);
      doc.roundedRect(marginLeft, y, maxWidth, cardHeight, 1.8, 1.8, 'FD');

      // Título del Componente
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 138); // Blue 900
      doc.text(`${idx + 1}. ${mod.titulo}`, marginLeft + 6, y + 6);

      // Descripción del Componente
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // Slate 600
      doc.text(descLines, marginLeft + 6, y + 11);

      let innerY = y + 11 + descLines.length * 4.2;

      // Badge de Impacto / Valor
      if (impactoLines.length > 0) {
        innerY += 1.5;
        doc.setFillColor(236, 253, 245); // Emerald 50
        doc.setDrawColor(167, 243, 208); // Emerald 200
        doc.setLineWidth(0.2);
        doc.roundedRect(marginLeft + 5, innerY, maxWidth - 10, impactBoxH, 1.2, 1.2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(5, 150, 105); // Emerald 600
        doc.text(impactoLines, marginLeft + 8, innerY + 3.8);

        innerY += impactBoxH;
      }

      if (mod.tiempoEstimadoSugerido) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Dedicación sugerida: ${mod.tiempoEstimadoSugerido}`, marginLeft + 6, innerY + 3.5);
      }

      y += cardHeight + 3.5;
    });
    y += 2;
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECCIÓN 3: BENEFICIOS CLAVE PARA EL NEGOCIO (CORREGIDO SIN UNICODE)
  // ══════════════════════════════════════════════════════════════════════
  if (informe.beneficiosClave && informe.beneficiosClave.length > 0) {
    checkPageBreak(32);
    doc.setFillColor(16, 185, 129); // Esmeralda
    doc.rect(marginLeft, y, 3, 7, 'F');
    doc.setFontSize(11.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('3. Beneficios Clave para el Negocio', marginLeft + 6, y + 5.5);
    y += 11;

    informe.beneficiosClave.forEach((ben) => {
      // Cálculo preciso de ancho sin símbolos extraños que rompan las fuentes de jsPDF
      const bLines = doc.splitTextToSize(ben, maxWidth - 10);
      const rowHeight = Math.max(6.5, bLines.length * 4.4 + 2);
      checkPageBreak(rowHeight + 2);

      // Icono vectorial nativo de checkmark (100% compatible y nítido)
      drawCheckmark(marginLeft + 4.5, y + 2.5, 2.0);

      doc.setFontSize(8.8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(bLines, marginLeft + 9, y + 3.4);

      y += rowHeight + 1.5;
    });
    y += 4;
  }

  // ══════════════════════════════════════════════════════════════════════
  // SECCIÓN 4: PROSPECTO A FUTURO, ESCALABILIDAD & STACK
  // ══════════════════════════════════════════════════════════════════════
  if (informe.prospectoFuturo || informe.tecnologiasRecomendadas) {
    checkPageBreak(35);
    doc.setFillColor(139, 92, 246); // Púrpura Evolución
    doc.rect(marginLeft, y, 3, 7, 'F');
    doc.setFontSize(11.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('4. Prospecto de Evolución a Futuro & Escalabilidad', marginLeft + 6, y + 5.5);
    y += 11;

    if (informe.prospectoFuturo) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const futLines = doc.splitTextToSize(informe.prospectoFuturo, maxWidth);
      doc.text(futLines, marginLeft, y);
      y += futLines.length * 4.6 + 6;
    }

    // Tarjeta Destacada de Stack Recomendado (Fiel a la Dark UI de la app)
    if (informe.tecnologiasRecomendadas) {
      const techLines = doc.splitTextToSize(informe.tecnologiasRecomendadas, maxWidth - 16);
      const techBoxH = 11 + techLines.length * 4.2;
      checkPageBreak(techBoxH + 4);

      doc.setFillColor(15, 23, 42); // Slate 900
      doc.setDrawColor(51, 65, 85); // Slate 700
      doc.setLineWidth(0.3);
      doc.roundedRect(marginLeft, y, maxWidth, techBoxH, 1.8, 1.8, 'FD');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(167, 139, 250); // Purple 400
      doc.text('STACK TECNOLÓGICO RECOMENDADO:', marginLeft + 6, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(248, 250, 252); // Blanco
      doc.text(techLines, marginLeft + 6, y + 10.5);

      y += techBoxH + 6;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // ENCABEZADOS Y PIES DE PÁGINA REPETIBLES (PÁGINA X DE Y)
  // ══════════════════════════════════════════════════════════════════════
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Running Header en páginas 2 en adelante
    if (i > 1) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `${BRAND_CONFIG.name} · ${BRAND_CONFIG.tagline}  —  Propuesta Técnica & Diagnóstico`,
        marginLeft,
        12
      );
      doc.text(
        `Ref: ${informe.token || 'WLF-INF'}`,
        pageWidth - marginRight,
        12,
        { align: 'right' }
      );

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(marginLeft, 14, pageWidth - marginRight, 14);
    }

    // Running Footer en todas las páginas
    const footerY = pageHeight - 12;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginLeft, footerY - 4, pageWidth - marginRight, footerY - 4);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${BRAND_CONFIG.name} · ${BRAND_CONFIG.fullSlogan}  |  Documento confidencial`,
      marginLeft,
      footerY
    );
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - marginRight,
      footerY,
      { align: 'right' }
    );
  }

  // ── Guardado y Descarga ──
  const cleanTitle = (informe.title || 'Propuesta')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 30);
  doc.save(`Informe_Tecnico_${cleanTitle}.pdf`);
}

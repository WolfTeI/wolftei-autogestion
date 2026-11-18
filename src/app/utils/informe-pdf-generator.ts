import jsPDF from 'jspdf';
import { LOGO_WOLFTEI_BASE64 } from './logo-oficial';
import { InformeTecnico } from '../service/informes-tecnicos.service';

/**
 * Genera y descarga el Informe Diagnóstico & Propuesta Técnica en PDF.
 * Enfatiza el valor del desarrollo, la problemática detectada y la solución sin números fríos.
 */
export function generateInformePDF(informe: InformeTecnico): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 20;
  const marginRight = 20;
  const maxWidth = pageWidth - marginLeft - marginRight;
  let y = 18;

  const checkPageBreak = (spaceNeeded: number) => {
    if (y + spaceNeeded >= pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // ── Cabecera Corporativa ──
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Logo Oficial
  try {
    doc.addImage(LOGO_WOLFTEI_BASE64, 'PNG', 12, 7, 24, 24);
  } catch (_) {}

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('WOLFTEI', 40, 17);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('Soluciones de Software & Arquitectura Digital', 40, 23);
  doc.text('wolftei.com.ar · info@wolftei.com.ar', 40, 28);

  // Recuadro derecho
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.roundedRect(pageWidth - 75, 8, 60, 22, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(96, 165, 250); // Blue 400
  doc.text('INFORME TÉCNICO', pageWidth - 45, 15, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.setFontSize(7.5);
  doc.text(`Ref: ${informe.token || 'WLF-INF'}`, pageWidth - 45, 21, { align: 'center' });
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, pageWidth - 45, 26, { align: 'center' });

  y = 48;

  // ── Destinatario & Cliente ──
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginLeft, y, maxWidth, 22, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('PREPARADO PARA:', marginLeft + 6, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(`${informe.clientName}${informe.clientCompany ? ' (' + informe.clientCompany + ')' : ''}`, marginLeft + 6, y + 14);

  if (informe.clientEmail) {
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Contacto: ${informe.clientEmail}${informe.clientPhone ? ' · Tel: ' + informe.clientPhone : ''}`, marginLeft + 6, y + 19);
  }

  y += 28;

  // ── Título del Informe ──
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(informe.title, maxWidth);
  doc.text(titleLines, marginLeft, y);
  y += titleLines.length * 7 + 4;

  // ── 1. Diagnóstico y Situación Actual ──
  checkPageBreak(30);
  doc.setFillColor(239, 68, 68); // Rojo acento
  doc.rect(marginLeft, y, 3, 7, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('1. Diagnóstico & Problemática Detectada', marginLeft + 6, y + 5.5);
  y += 11;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const situacionLines = doc.splitTextToSize(informe.situacionActual, maxWidth);
  doc.text(situacionLines, marginLeft, y);
  y += situacionLines.length * 5 + 4;

  if (informe.problemasDetectados && informe.problemasDetectados.length > 0) {
    informe.problemasDetectados.forEach((prob) => {
      checkPageBreak(12);
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(254, 202, 202);
      const probLines = doc.splitTextToSize(`• ${prob}`, maxWidth - 10);
      const boxH = Math.max(8, probLines.length * 5 + 4);
      doc.roundedRect(marginLeft, y, maxWidth, boxH, 1, 1, 'FD');
      doc.setTextColor(185, 28, 28);
      doc.text(probLines, marginLeft + 5, y + 5.5);
      y += boxH + 3;
    });
    y += 4;
  }

  // ── 2. Solución Propuesta & Arquitectura ──
  checkPageBreak(35);
  doc.setFillColor(59, 130, 246); // Azul
  doc.rect(marginLeft, y, 3, 7, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('2. Propuesta de Solución & Arquitectura', marginLeft + 6, y + 5.5);
  y += 11;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const solucionLines = doc.splitTextToSize(informe.resumenSolucion, maxWidth);
  doc.text(solucionLines, marginLeft, y);
  y += solucionLines.length * 5 + 5;

  // ── Módulos y Alcance de la Solución ──
  if (informe.modulosSolucion && informe.modulosSolucion.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Desglose de Componentes a Desarrollar:', marginLeft, y);
    y += 6;

    informe.modulosSolucion.forEach((mod, idx) => {
      checkPageBreak(25);
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      
      const descLines = doc.splitTextToSize(mod.descripcion, maxWidth - 12);
      const impactoLines = mod.impactoOValor ? doc.splitTextToSize(`Valor/Impacto: ${mod.impactoOValor}`, maxWidth - 12) : [];
      const totalBoxH = 10 + descLines.length * 4.5 + (impactoLines.length > 0 ? impactoLines.length * 4 + 3 : 0);

      doc.roundedRect(marginLeft, y, maxWidth, totalBoxH, 1.5, 1.5, 'FD');
      
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 138); // Blue 900
      doc.text(`${idx + 1}. ${mod.titulo}`, marginLeft + 6, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(descLines, marginLeft + 6, y + 11);

      if (impactoLines.length > 0) {
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(16, 185, 129); // Verde éxito
        doc.text(impactoLines, marginLeft + 6, y + 11 + descLines.length * 4.5);
      }

      y += totalBoxH + 4;
    });
    y += 4;
  }

  // ── 3. Beneficios Clave ──
  if (informe.beneficiosClave && informe.beneficiosClave.length > 0) {
    checkPageBreak(30);
    doc.setFillColor(16, 185, 129); // Verde
    doc.rect(marginLeft, y, 3, 7, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('3. Beneficios Clave para el Negocio', marginLeft + 6, y + 5.5);
    y += 11;

    informe.beneficiosClave.forEach((ben) => {
      checkPageBreak(10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const bLines = doc.splitTextToSize(`✓ ${ben}`, maxWidth);
      doc.text(bLines, marginLeft + 4, y);
      y += bLines.length * 5 + 2;
    });
    y += 5;
  }

  // ── 4. Prospecto a Futuro & Escalabilidad ──
  if (informe.prospectoFuturo) {
    checkPageBreak(30);
    doc.setFillColor(139, 92, 246); // Púrpura
    doc.rect(marginLeft, y, 3, 7, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('4. Prospecto de Evolución a Futuro', marginLeft + 6, y + 5.5);
    y += 11;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const futLines = doc.splitTextToSize(informe.prospectoFuturo, maxWidth);
    doc.text(futLines, marginLeft, y);
    y += futLines.length * 5 + 8;
  }

  // ── Pie de página y Firma ──
  checkPageBreak(25);
  doc.setDrawColor(226, 232, 240);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('WolfTeI · Desarrollo Profesional y Consultoría de Software', marginLeft, y);
  doc.text('Documento confidencial preparado para evaluación del cliente.', marginLeft, y + 4);

  const cleanTitle = informe.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  doc.save(`Informe_Tecnico_${cleanTitle}.pdf`);
}

import jsPDF from 'jspdf';
import { obtenerFirmaActiva } from './firma-oficial';
import { LOGO_WOLFTEI_BASE64 } from './logo-oficial';

export interface ActaGarantiaData {
  proyectoTitulo: string;
  clienteNombre: string;
  clienteCuit?: string;
  proveedorInfra?: string;
  cuentaInfra?: string;
  dominio?: string;
  fechaEntrega?: string;
  garantiaDias?: number;
}

/**
 * Genera y descarga el Acta Oficial de Entrega, Recepción y Garantía Técnica (30 días) en PDF.
 * Delimita responsabilidades de hosting y formaliza el inicio/fin del período de garantía.
 */
export function generateActaGarantiaPDF(data: ActaGarantiaData): void {
  const {
    proyectoTitulo,
    clienteNombre,
    clienteCuit = 'Consumidor Final / No informado',
    proveedorInfra = 'Hostinger',
    cuentaInfra = 'Cuenta directa del cliente',
    dominio = 'No aplica / Dominio propio',
    fechaEntrega = new Date().toISOString().split('T')[0],
    garantiaDias = 30,
  } = data;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 20;
  const marginRight = 20;
  const maxWidth = pageWidth - marginLeft - marginRight;
  let y = 18;

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
  doc.text('Soluciones de Software & Desarrollo Digital', 40, 23);
  doc.text('info@wolftei.com.ar | wolftei.com.ar', 40, 28);

  // Recuadro de Título Documental (Derecha)
  const boxWidth = 65;
  const boxX = pageWidth - marginRight - boxWidth;
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(boxX, 8, boxWidth, 22, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ACTA DE ENTREGA', boxX + 5, 14);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(129, 140, 248); // Indigo 400
  doc.text('Y GARANTÍA TÉCNICA', boxX + 5, 19);

  const fechaObj = new Date(fechaEntrega);
  const fechaFinObj = new Date(fechaObj.getTime() + garantiaDias * 24 * 60 * 60 * 1000);
  const fechaInicioStr = fechaObj.toLocaleDateString('es-AR');
  const fechaFinStr = fechaFinObj.toLocaleDateString('es-AR');

  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Fecha: ${fechaInicioStr}`, boxX + 5, 25);

  y = 48;

  // ── Título Central ──
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('ACTA DE ENTREGA, RECEPCIÓN Y GARANTÍA TÉCNICA', pageWidth / 2, y, { align: 'center' });

  y += 7;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `En la Ciudad Autónoma de Buenos Aires, a los ${fechaObj.getDate()} días del mes de ${fechaObj.toLocaleString('es-AR', { month: 'long' })} de ${fechaObj.getFullYear()}, se suscribe la presente Acta entre:`,
    marginLeft,
    y,
    { maxWidth }
  );

  y += 9;

  // ── Partes Intervinientes ──
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginLeft, y, maxWidth, 24, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginLeft, y, maxWidth, 24, 2, 2, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('EL PRESTADOR:', marginLeft + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text('Carlos Alberto Prost (en representación de WolfTeI) - info@wolftei.com.ar', marginLeft + 35, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('EL CLIENTE:', marginLeft + 4, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(`${clienteNombre} (CUIT/DNI: ${clienteCuit})`, marginLeft + 35, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.text('PROYECTO:', marginLeft + 4, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.text(`${proyectoTitulo}`, marginLeft + 35, y + 21);

  y += 30;

  // ── 1. Declaración de Entrega y Recepción ──
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('1. Declaración de Entrega y Conformidad Operativa', marginLeft, y);

  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const textoP1 =
    'EL PRESTADOR hace entrega formal a EL CLIENTE de los entregables acordados, el despliegue operativo en entorno de producción y las credenciales de administración. EL CLIENTE manifiesta haber verificado la correcta operatividad de las funcionalidades y otorga su plena conformidad técnica.';
  doc.text(textoP1, marginLeft, y, { maxWidth, align: 'justify' });

  y += 15;

  // ── 2. Detalle de Infraestructura y Traspaso ──
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('2. Detalle de Infraestructura y Deslinde de Custodia', marginLeft, y);

  y += 5;
  const textoP2 =
    `• Proveedor de Infraestructura / Servidor: ${proveedorInfra}\n` +
    `• Identificador de Cuenta / Acceso: ${cuentaInfra}\n` +
    `• Dominio Web Asociado: ${dominio}\n` +
    '• Responsabilidad de Renovación: EL CLIENTE asume la titularidad y custodia exclusiva de la infraestructura a partir de la firma de la presente, siendo el único responsable de asociar su propio medio de pago para garantizar la continuidad del servicio tras el vencimiento del período inicial.';
  doc.text(textoP2, marginLeft, y, { maxWidth });

  y += 24;

  // ── 3. Términos de la Garantía Técnica (30 Días) ──
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`3. Términos de la Garantía Técnica (${garantiaDias} Días Corridos)`, marginLeft, y);

  y += 5;
  const textoP3 =
    `1. Vigencia: Desde el ${fechaInicioStr} hasta el ${fechaFinStr} inclusive (${garantiaDias} días corridos).\n` +
    '2. Cobertura: Corrección sin cargo de fallos lógicos o desvíos funcionales (bugs) atribuibles al código fuente entregado y dentro del alcance originalmente aprobado.\n' +
    '3. Exclusiones: Modificaciones o manipulaciones realizadas por EL CLIENTE o terceros no autorizados; caídas de APIs externas o infraestructura; nuevas funcionalidades o cambios de diseño estético fuera de alcance.\n' +
    '4. Finalización: Concluido el plazo de garantía, cualquier tarea evolutiva o de mantenimiento se cotizará bajo un nuevo presupuesto o abono mensual independiente.';
  doc.text(textoP3, marginLeft, y, { maxWidth });

  y += 28;

  // ── Cuadro de Firmas ──
  doc.setDrawColor(203, 213, 225);
  doc.line(marginLeft, y, pageWidth - marginRight, y);

  y += 10;

  // Firma Prestador
  const firmaX = marginLeft + 10;
  const firmaActiva = obtenerFirmaActiva();
  if (firmaActiva) {
    try {
      doc.addImage(firmaActiva, 'PNG', firmaX, y - 5, 42, 18);
    } catch (_) {}
  }

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Por WolfTeI (EL PRESTADOR)', firmaX, y + 18);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Carlos Alberto Prost', firmaX, y + 23);
  doc.text('Desarrollo & Seguridad de Software', firmaX, y + 27);

  // Firma Cliente
  const firmaClienteX = pageWidth / 2 + 15;
  doc.setDrawColor(148, 163, 184);
  doc.line(firmaClienteX, y + 14, firmaClienteX + 65, y + 14);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Por EL CLIENTE', firmaClienteX, y + 18);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Firma y Aclaración: ${clienteNombre}`, firmaClienteX, y + 23);
  doc.text(`CUIT/DNI: ${clienteCuit}`, firmaClienteX, y + 27);

  // ── Pie de Página ──
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'WolfTeI — Soluciones de Software | Documento oficial de constancia de entrega de desarrollo y garantía técnica.',
    pageWidth / 2,
    285,
    { align: 'center' }
  );

  // Guardar y descargar PDF
  const nombreArchivo = `Acta_Garantia_${proyectoTitulo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(nombreArchivo);
}

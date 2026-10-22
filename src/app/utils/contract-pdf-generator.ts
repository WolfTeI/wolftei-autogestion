import jsPDF from "jspdf";
import { Cliente } from "../service/clientes.service";
import { Propuesta } from "../service/propuestas.service";
import { obtenerFirmaActiva } from "./firma-oficial";
import { LOGO_WOLFTEI_BASE64 } from "./logo-oficial";

/**
 * Helper para formatear párrafos y saltos de página con jsPDF.
 */
function createPDFWriter(
  doc: jsPDF,
  marginLeft: number,
  marginRight: number,
  startY = 48,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginLeft - marginRight;
  let y = startY;

  const addLine = (
    text: string,
    size = 9.5,
    bold = false,
    color: [number, number, number] = [30, 41, 59],
  ) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxWidth);

    if (y + lines.length * (size * 0.45) > 275) {
      doc.addPage();
      y = 20;
    }

    doc.text(lines, marginLeft, y);
    y += lines.length * (size * 0.45) + 2.5;
  };

  const addClause = (title: string, content: string) => {
    if (y + 25 > 275) {
      doc.addPage();
      y = 20;
    }
    addLine(title, 10, true, [15, 23, 42]);
    addLine(content, 9, false, [51, 65, 85]);
    y += 2;
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > 275) {
      doc.addPage();
      y = 20;
    }
  };

  return {
    addLine,
    addClause,
    checkPageBreak,
    getY: () => y,
    setY: (val: number) => {
      y = val;
    },
    pageWidth,
    maxWidth,
  };
}

/**
 * Agrega el pie de página numerado en todas las páginas generadas.
 */
function addFooter(doc: jsPDF, label: string, marginLeft: number) {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `WolfTeI — ${label}  |  Página ${i} de ${totalPages}`,
      marginLeft,
      292,
    );
  }
}

/**
 * Agrega el bloque de firmas formales.
 */
function addSignatures(
  doc: jsPDF,
  writer: ReturnType<typeof createPDFWriter>,
  cliente: Cliente,
  marginLeft: number,
  marginRight: number,
) {
  writer.checkPageBreak(52);
  let y = writer.getY() + 6;

  doc.setDrawColor(203, 213, 225);
  doc.line(marginLeft, y, writer.pageWidth - marginRight, y);
  y += 8;

  const signX = writer.pageWidth - marginRight - 65;
  const clienteTaxId = cliente.taxId?.trim()
    ? cliente.taxId.trim()
    : "____________________";

  // Firma Cliente (Izquierda)
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Por EL CLIENTE:", marginLeft, y);
  doc.setFont("helvetica", "normal");
  doc.text("Firma: ____________________", marginLeft, y + 6);
  doc.text(`Aclaración: ${cliente.name}`, marginLeft, y + 11);
  doc.text(`CUIT/CUIL/DNI: ${clienteTaxId}`, marginLeft, y + 16);

  // Firma WolfTeI (Derecha)
  const firmaActiva = obtenerFirmaActiva();
  if (firmaActiva) {
    try {
      doc.addImage(firmaActiva, "PNG", signX + 16, y - 18, 18, 38);
    } catch (_) {}
  }

  doc.setFont("helvetica", "bold");
  doc.text("Por EL PRESTADOR (WolfTeI):", signX, y);
  doc.setFont("helvetica", "normal");
  doc.text("Firma: ____________________", signX, y + 6);
  doc.text("Aclaración: Carlos Alberto Prost", signX, y + 11);
  doc.text("CUIT/CUIL: 20-33607855-6", signX, y + 16);
  doc.text("H. Quiroga 3343, Libertad, Merlo", signX, y + 21);
}

/**
 * Genera el CONTRATO DE DESARROLLO Y PRESTACIÓN DE SERVICIOS DE SOFTWARE.
 * Incluye:
 * - Titularidad y explotación del software para el cliente.
 * - Autoría moral inalienable para Carlos Alberto Prost (WolfTeI).
 * - Reserva expresa de reutilización de módulos y código técnico en otros proyectos.
 * - Cesión de derecho de uso de marca / logo como partner y portfolio en la web oficial.
 */
export function generateContractPDF(
  cliente: Cliente,
  propuesta?: Propuesta | null,
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const marginLeft = 35;
  const marginRight = 20;
  const writer = createPDFWriter(doc, marginLeft, marginRight);

  // ── Cabecera ──
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, writer.pageWidth, 40, "F");

  // Isotipo WolfTeI Oficial
  try {
    doc.addImage(LOGO_WOLFTEI_BASE64, "PNG", 10, 8, 24, 24);
  } catch (_) {}

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("CONTRATO DE DESARROLLO", 38, 15);
  doc.text("Y PRESTACIÓN DE SERVICIOS DE SOFTWARE", 38, 22);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(
    "WolfTeI — Soluciones de Software & Desarrollo Digital  |  wolftei.com.ar",
    38,
    32,
  );

  const fechaHoy = new Date().toLocaleDateString("es-AR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const clienteTaxId = cliente.taxId?.trim()
    ? cliente.taxId.trim()
    : "____________________";
  const clienteEmailText = cliente.email?.trim()
    ? `, correo ${cliente.email.trim()}`
    : "";
  const clienteDomicilioText = cliente.address?.trim()
    ? ` y domicilio en ${cliente.address.trim()}`
    : "";

  writer.addLine(
    `Celebrado de común acuerdo de forma digital y/o presencial con plenos efectos jurídicos en la localidad de Libertad, Partido de Merlo, Provincia de Buenos Aires, a los ${fechaHoy}, entre:`,
    9.5,
  );
  writer.setY(writer.getY() + 1.5);

  writer.addLine(
    `• EL PRESTADOR: Carlos Alberto Prost (WolfTeI), CUIT/CUIL N° 20-33607855-6, con domicilio profesional y legal constituido en H. Quiroga 3343, localidad de Libertad, Partido de Merlo, Provincia de Buenos Aires, República Argentina.`,
    9,
  );
  writer.addLine(
    `• EL CLIENTE: ${cliente.name}${cliente.company ? " (en representación de " + cliente.company + ")" : ""}, con CUIT/CUIL/DNI: ${clienteTaxId}${clienteEmailText}${clienteDomicilioText}.`,
    9,
  );
  writer.setY(writer.getY() + 3);

  writer.addLine(
    "Ambas partes acuerdan libre y voluntariamente celebrar el presente instrumento sujeto a las siguientes cláusulas:",
    9.5,
    true,
  );
  writer.setY(writer.getY() + 2);

  // Cláusulas
  writer.addClause(
    "PRIMERA: OBJETO DEL CONTRATO",
    `El presente contrato tiene por objeto regular la prestación de servicios profesionales de diseño, arquitectura, programación y puesta en marcha del proyecto de software${propuesta?.title ? ' denominado "' + propuesta.title + '"' : ""}, de conformidad con el alcance, especificaciones técnicas y requerimientos homologados entre las partes.`,
  );

  writer.addClause(
    "SEGUNDA: TITULARIDAD DEL SOFTWARE DEL CLIENTE",
    "Una vez cancelado el 100% del valor total acordado para el desarrollo, EL CLIENTE adquiere de forma definitiva la titularidad, propiedad y los derechos exclusivos de explotación comercial sobre el producto de software final implementado para su negocio, contando con plena libertad para su uso, administración y operación sin limitaciones temporales.",
  );

  writer.addClause(
    "TERCERA: AUTORÍA INTELECTUAL Y DERECHOS MORALES",
    "De conformidad con la Ley 11.723 de Propiedad Intelectual y los tratados internacionales pertinentes, los derechos morales y la autoría intelectual inalienable de la creación técnica, estructura, arquitectura y código fuente desarrollado corresponden a Carlos Alberto Prost (WolfTeI) en su calidad de autor y creador del software.",
  );

  writer.addClause(
    "CUARTA: RESERVA DE REUTILIZACIÓN MODULAR Y KNOW-HOW",
    "EL PRESTADOR se reserva de manera expresa, perpetua e irrestricta el derecho de reutilizar, incorporar, modificar, licenciar o adaptar en cualesquiera otros proyectos —presentes o futuros, sean propios o para terceros clientes— todos los módulos funcionales genéricos, bibliotecas, algoritmos, utilitarios, arquitecturas y patrones técnicos elaborados durante la prestación. Bajo ninguna circunstancia dicha reutilización incluirá marcas, logotipos, datos confidenciales, secretos de negocio específicos ni bases de datos de usuarios pertenecientes al CLIENTE.",
  );

  writer.addClause(
    "QUINTA: REFERENCIA COMERCIAL, PORTFOLIO Y CESIÓN DE USO DE MARCA / PARTNER",
    "EL CLIENTE autoriza expresamente a EL PRESTADOR (WolfTeI) a utilizar y exhibir su nombre comercial, marca, imagotipo/logotipo, capturas ilustrativas del producto y una breve descripción técnica del proyecto desarrollado, única y exclusivamente con fines de difusión profesional, portfolio comercial, presentación de casos de éxito y mención como cliente o partner tecnológico en el sitio web oficial (wolftei.com.ar), redes sociales o presentaciones de credenciales de WolfTeI. Dicha autorización es no exclusiva, de carácter gratuito y sin derecho a contraprestación dineraria adicional.",
  );

  writer.addClause(
    "SEXTA: GARANTÍA TÉCNICA Y SOPORTE POST-ENTREGA",
    `EL PRESTADOR otorga una garantía técnica de correcto funcionamiento por el plazo de ${propuesta?.warrantyDays || 30} días corridos computados a partir de la entrega final homologada. Durante dicho período, cualquier discrepancia funcional o fallo imputable directamente al código desarrollado será subsanado sin costo adicional. Quedan excluidas de la garantía fallas originadas por modificaciones no autorizadas, ataques externos de terceros o caídas de infraestructura ajenas al PRESTADOR.`,
  );

  writer.addClause(
    "SÉPTIMA: CONDICIONES DE PAGO Y RESCISIÓN",
    "Los honorarios se abonarán según el esquema y modalidades de pago detallados en la propuesta comercial aprobada. La falta de pago faculta al PRESTADOR a pausar la entrega de avances hasta su regularización. Cualquiera de las partes podrá rescindir el contrato mediante notificación fehaciente con 15 días corridos de anticipación, reconociéndose y liquidándose las horas y módulos efectivamente terminados a dicha fecha.",
  );

  writer.addClause(
    "OCTAVA: JURISDICCIÓN Y COMPETENCIA EXCLUSIVA",
    "Para todos los efectos legales, extrajudiciales y judiciales emergentes de este contrato, su interpretación, validez, cumplimiento o eventual rescisión, las partes constituyen sus domicilios especiales en los precedentemente consignados y acuerdan someterse en forma única, improrrogable y excluyente a la jurisdicción y competencia de los Tribunales Ordinarios en lo Civil y Comercial del Departamento Judicial de Morón, Provincia de Buenos Aires. Las partes renuncian de forma expresa, irrevocable e incondicional a cualquier otro fuero, fuero federal o jurisdicción territorial que pudiera corresponderles por cualquier concepto, dejando expresa constancia de la renuncia total a la jurisdicción de la Ciudad Autónoma de Buenos Aires.",
  );

  // Firmas y pie
  addSignatures(doc, writer, cliente, marginLeft, marginRight);
  addFooter(doc, "Contrato de Desarrollo de Software", marginLeft);

  const filename = `WolfTeI_Contrato_Desarrollo_${cliente.name.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}

/**
 * Genera el ACUERDO DE CONFIDENCIALIDAD Y NO DIVULGACIÓN (NDA INDEPENDIENTE).
 * Documento formal, autónomo y blindado para intercambio de información sensible.
 */
export function generateNDAPDF(
  cliente: Cliente,
  propuesta?: Propuesta | null,
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const marginLeft = 35;
  const marginRight = 20;
  const writer = createPDFWriter(doc, marginLeft, marginRight);

  // ── Cabecera ──
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, writer.pageWidth, 40, "F");

  // Isotipo WolfTeI Oficial
  try {
    doc.addImage(LOGO_WOLFTEI_BASE64, "PNG", 10, 8, 24, 24);
  } catch (_) {}

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("ACUERDO DE CONFIDENCIALIDAD", 38, 15);
  doc.text("Y NO DIVULGACIÓN (NDA)", 38, 22);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(
    "WolfTeI — Seguridad & Protección de la Información  |  wolftei.com.ar",
    38,
    32,
  );

  const fechaHoy = new Date().toLocaleDateString("es-AR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const clienteTaxId = cliente.taxId?.trim()
    ? cliente.taxId.trim()
    : "____________________";
  const clienteEmailText = cliente.email?.trim()
    ? `, correo ${cliente.email.trim()}`
    : "";
  const clienteDomicilioText = cliente.address?.trim()
    ? `, domicilio en ${cliente.address.trim()}`
    : "";

  writer.addLine(
    `Celebrado de mutuo acuerdo de forma digital y/o presencial con plenos efectos jurídicos en la localidad de Libertad, Partido de Merlo, Provincia de Buenos Aires, a los ${fechaHoy}, entre:`,
    9.5,
  );
  writer.setY(writer.getY() + 1.5);

  writer.addLine(
    `• LA PARTE RECEPTORA / WolfTeI: Carlos Alberto Prost, titular y responsable técnico de WolfTeI, CUIT/CUIL N° 20-33607855-6, con domicilio legal constituido en H. Quiroga 3343, localidad de Libertad, Partido de Merlo, Provincia de Buenos Aires, República Argentina.`,
    9,
  );
  writer.addLine(
    `• LA PARTE EMISORA / EL CLIENTE: ${cliente.name}${cliente.company ? " (" + cliente.company + ")" : ""}, CUIT/CUIL/DNI: ${clienteTaxId}${clienteEmailText}${clienteDomicilioText}.`,
    9,
  );
  writer.setY(writer.getY() + 3);

  writer.addLine(
    "Ambas partes acuerdan suscribir el presente Acuerdo de Confidencialidad sujeto a las siguientes cláusulas y condiciones:",
    9.5,
    true,
  );
  writer.setY(writer.getY() + 2);

  // Cláusulas del NDA
  writer.addClause(
    "PRIMERA: DEFINICIÓN DE INFORMACIÓN CONFIDENCIAL",
    'A los efectos del presente Acuerdo, se considerará "Información Confidencial" toda información técnica, financiera, comercial, estratégica, código fuente, credenciales de acceso a servidores o bases de datos, esquemas de bases de datos, fórmulas, procesos operativos, listados de clientes y cualquier documentación escrita, digital o verbal revelada entre las partes en el marco de la prestación de servicios o evaluaciones conjuntas.',
  );

  writer.addClause(
    "SEGUNDA: OBLIGACIÓN ESTRICTA DE SIGILO Y NO DIVULGACIÓN",
    "Las partes se comprometen a: a) Mantener la más rigurosa reserva sobre toda la Información Confidencial recibida; b) No divulgar, copiar, publicar, transmitir ni ceder dicha información a terceras personas naturales o jurídicas sin previo consentimiento expreso por escrito de la otra parte; c) Adoptar las mismas medidas de seguridad y cuidado que aplicarían para resguardar su propia información confidencial más valiosa, nunca inferiores a un estándar de diligencia razonable.",
  );

  writer.addClause(
    "TERCERA: FINALIDAD EXCLUSIVA DE USO",
    "La Información Confidencial será utilizada únicamente con el fin exclusivo y legítimo de evaluar, diseñar, desarrollar y ejecutar los servicios informáticos y de software convenidos entre las partes, quedando prohibida su explotación en beneficio propio o de terceros para cualquier fin ajeno al proyecto.",
  );

  writer.addClause(
    "CUARTA: EXCEPCIONES AL DEBER DE CONFIDENCIALIDAD",
    "Las obligaciones de confidencialidad no aplicarán a información que: a) Sea o devenga de conocimiento público sin mediar incumplimiento del presente Acuerdo; b) Se encuentre en posesión legítima de la parte receptora con anterioridad a su divulgación; c) Sea desarrollada de manera autónoma e independiente sin acceso ni uso de la información confidencial; d) Sea requerida por orden de autoridad judicial o administrativa competente, mediando previa notificación inmediata a la parte emisora.",
  );

  writer.addClause(
    "QUINTA: VIGENCIA Y DURACIÓN DEL DEBER DE SIGILO",
    "Las obligaciones de confidencialidad asumidas en este instrumento tendrán una vigencia de tres (3) años computados a partir de la firma del presente o desde la finalización efectiva de los servicios vinculados, lo que ocurra más tarde. Aquellos secretos comerciales o credenciales que por su naturaleza mantengan valor estratégico continuarán protegidos por el tiempo máximo que autorice la legislación.",
  );

  writer.addClause(
    "SEXTA: DEVOLUCIÓN O DESTRUCCIÓN DE DATOS",
    "A solicitud por escrito de la parte emisora, o al término del vínculo comercial, la parte receptora procederá de inmediato a la devolución o destrucción fehaciente de toda copia, registro magnético, credenciales y documentos que contengan Información Confidencial, exceptuando copias de respaldo de seguridad automáticas no accesibles con fines operativos.",
  );

  writer.addClause(
    "SÉPTIMA: LEY APLICABLE Y JURISDICCIÓN EXCLUSIVA",
    "El presente Acuerdo se rige en todos sus términos por las leyes de la República Argentina. Ante cualquier divergencia, controversia o reclamo judicial derivado de este instrumento, las partes se someten en forma expresa e improrrogable a la jurisdicción exclusiva de los Tribunales Ordinarios en lo Civil y Comercial del Departamento Judicial de Morón, Provincia de Buenos Aires, con renuncia expresa a cualquier otro fuero o jurisdicción que pudiera corresponderles por sus domicilios presentes o futuros, excluyendo y renunciando expresamente a los fueros de la Ciudad Autónoma de Buenos Aires y a la justicia federal.",
  );

  // Firmas y pie
  addSignatures(doc, writer, cliente, marginLeft, marginRight);
  addFooter(doc, "Acuerdo de Confidencialidad (NDA)", marginLeft);

  const filename = `WolfTeI_Acuerdo_NDA_${cliente.name.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}

/**
 * Descarga ambos documentos (Contrato de Desarrollo + NDA) de manera consecutiva.
 */
export function generateBothLegalPDFs(
  cliente: Cliente,
  propuesta?: Propuesta | null,
): void {
  generateContractPDF(cliente, propuesta);
  setTimeout(() => {
    generateNDAPDF(cliente, propuesta);
  }, 400);
}

/**
 * Compatibilidad hacia atrás para llamadas previas.
 */
export const generateContractNDAPDF = generateContractPDF;

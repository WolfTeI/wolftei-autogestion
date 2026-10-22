import { Injectable } from '@angular/core';
import { openUrl } from '@tauri-apps/plugin-opener';

@Injectable({
  providedIn: 'root'
})
export class WhatsAppService {

  /**
   * Limpia y formatea un número telefónico para la API de WhatsApp (wa.me).
   * Remueve caracteres no numéricos y normaliza prefijos argentinos si aplica.
   * @param rawPhone Teléfono en formato libre (ej: "+54 9 11 1234-5678" o "1112345678")
   */
  formatearTelefono(rawPhone: string): string {
    if (!rawPhone) return '';
    let digits = rawPhone.replace(/\D/g, '');

    // Si comienza con 0 (ej: 011...), remover el 0
    if (digits.startsWith('0')) {
      digits = digits.substring(1);
    }

    // Si tiene 10 dígitos y es de Argentina (ej: 11xxxxxxxx o 221xxxxxxx), agregar 549
    if (digits.length === 10 && !digits.startsWith('54')) {
      digits = `549${digits}`;
    }

    // Si ya empieza con 54 pero le falta el 9 para celular (54 11 ... -> 54 9 11 ...)
    if (digits.startsWith('54') && !digits.startsWith('549') && digits.length === 12) {
      digits = `549${digits.substring(2)}`;
    }

    return digits;
  }

  /**
   * Abre una conversación directamente en la aplicación oficial de WhatsApp para Windows
   * utilizando el protocolo nativo 'whatsapp://' (evitando abrir pestañas innecesarias en el navegador).
   */
  async abrirChat(telefono: string, mensaje: string): Promise<boolean> {
    const cleanPhone = this.formatearTelefono(telefono);
    const encodedMsg = encodeURIComponent(mensaje);
    
    // Protocolo nativo de la aplicación de escritorio de WhatsApp en Windows
    const nativeUrl = cleanPhone
      ? `whatsapp://send?phone=${cleanPhone}&text=${encodedMsg}`
      : `whatsapp://send?text=${encodedMsg}`;

    // Copiar mensaje al portapapeles por comodidad del usuario
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(mensaje);
      }
    } catch (_) {}

    try {
      await openUrl(nativeUrl);
      return true;
    } catch (e) {
      console.warn('No se pudo abrir protocolo nativo whatsapp://, usando fallback:', e);
      try {
        const webUrl = cleanPhone
          ? `https://wa.me/${cleanPhone}?text=${encodedMsg}`
          : `https://wa.me/?text=${encodedMsg}`;
        await openUrl(webUrl);
        return true;
      } catch (err) {
        console.error('Error al abrir WhatsApp:', err);
        return false;
      }
    }
  }

  /**
   * Genera el texto estándar de envío de propuesta comercial / presupuesto.
   */
  generarMensajePropuesta(clienteNombre: string, proyectoTitulo: string, token: string, diasValidez = 15): string {
    const link = `https://wolftei.com.ar/propuesta/${token}`;
    return `¡Hola ${clienteNombre}! 👋

Te comparto la propuesta técnica y el presupuesto que preparamos para el proyecto *"${proyectoTitulo}"*:

🔗 *Ver Propuesta:* ${link}

Tiene una validez de *${diasValidez} días corridos*. Podés revisar el alcance funcional, el cronograma y formalizar el inicio directamente desde el enlace.

Cualquier duda o ajuste que quieras hacer, estoy a disposición.

Saludos,
*WolfTeI* — Soluciones de Software`;
  }

  /**
   * Genera el texto de recordatorio de cobro / confirmación de anticipo.
   */
  generarMensajeCobro(clienteNombre: string, proyectoTitulo: string, monto: number, moneda: string, concepto: string): string {
    const montoFmt = `${moneda} ${monto.toLocaleString('es-AR')}`;
    return `¡Hola ${clienteNombre}! 👋

Te escribo desde *WolfTeI* para confirmar el registro del pago por concepto de *${concepto}* para el proyecto *"${proyectoTitulo}"*, por un monto de *${montoFmt}*.

¡Muchas gracias! Ya avanzamos con la siguiente etapa planificada.

Saludos,
*WolfTeI*`;
  }

  /**
   * Genera mensaje cordial de seguimiento comercial para propuestas frías (>48hs sin respuesta).
   */
  generarMensajeSeguimientoFria(clienteNombre: string, proyectoTitulo: string, token: string): string {
    const link = `https://wolftei.com.ar/propuesta/${token}`;
    return `¡Hola ${clienteNombre}! 👋 ¿Cómo estás?

Te consulto si pudiste revisar la propuesta que te compartimos para *"${proyectoTitulo}"*:

🔗 ${link}

Avisame con total tranquilidad si querés que ajustemos algún alcance, módulo o cronograma según las prioridades actuales de tu negocio. ¡Quedo a tu disposición!

Saludos,
*WolfTeI* — Soluciones de Software`;
  }

  /**
   * Genera mensaje de bienvenida y formalización de inicio de proyecto.
   */
  generarMensajeBienvenidaProyecto(clienteNombre: string, proyectoTitulo: string): string {
    return `¡Hola ${clienteNombre}! 🎉

¡Excelente noticia! Recibimos con éxito la formalización de la propuesta para *"${proyectoTitulo}"*.

Ya agendamos el alcance en nuestro tablero de desarrollo y estamos preparando el inicio del proyecto. En breve nos comunicamos para coordinar los primeros entregables.

¡Muchas gracias por confiar en *WolfTeI*!`;
  }
}

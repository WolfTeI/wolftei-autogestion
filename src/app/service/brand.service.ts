import { Injectable, signal } from '@angular/core';

/** Constantes directas para funciones y utilidades fuera del contexto de inyección de Angular (ej: generadores de PDF) */
export const BRAND_CONFIG = {
  name: 'WolfTeI',
  tagline: 'Soluciones Digitales',
  fullSlogan: 'Transformando ideas en soluciones digitales.',
  website: 'wolftei.com.ar',
  email: 'info@wolftei.com.ar',
  whatsappNumber: '+5491178128754',
  whatsappDisplay: '+54 9 11 7812-8754',
};

/**
 * Servicio centralizado con Signals para la identidad de marca de WolfTeI.
 * Proporciona una única fuente de la verdad para toda la aplicación y la web.
 */
@Injectable({
  providedIn: 'root',
})
export class BrandService {
  /** Nombre comercial oficial */
  readonly brandName = signal<string>(BRAND_CONFIG.name);

  /** Subtítulo / Tagline corto para membretes, badges y cabeceras */
  readonly tagline = signal<string>(BRAND_CONFIG.tagline);

  /** Eslogan institucional completo */
  readonly fullSlogan = signal<string>(BRAND_CONFIG.fullSlogan);

  /** Datos oficiales de contacto */
  readonly website = signal<string>(BRAND_CONFIG.website);
  readonly email = signal<string>(BRAND_CONFIG.email);
  readonly whatsappNumber = signal<string>(BRAND_CONFIG.whatsappNumber);
  readonly whatsappDisplay = signal<string>(BRAND_CONFIG.whatsappDisplay);
}

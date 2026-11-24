import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { FirebaseService } from './firebase.service';

export interface FiscalSettings {
  razonSocial: string;
  nombreFantasia: string;
  cuit: string;
  condicionIva: string;
  categoriaMonotributo: string;
  ingresosBrutos: string;
  inicioActividades: string;
  domicilioFiscal: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  puntoVenta: number;
  // Datos bancarios
  cbu: string;
  alias: string;
  banco: string;
  titularCuenta: string;
  cuitTitular: string;
  // Notas legales
  leyendaComprobante?: string;
  updatedAt?: string;
}

export const FISCAL_DEFAULTS: FiscalSettings = {
  razonSocial: 'Carlos Alberto Prost',
  nombreFantasia: 'WolfTeI · Soluciones Digitales',
  cuit: '20-33607855-6',
  condicionIva: 'Responsable Monotributo',
  categoriaMonotributo: 'Categoría A',
  ingresosBrutos: '20-33607855-6',
  inicioActividades: '2023-10-01',
  domicilioFiscal: 'H. Quiroga 3343',
  localidad: 'Libertad, Merlo',
  provincia: 'Buenos Aires',
  codigoPostal: '1716',
  puntoVenta: 1,
  cbu: '',
  alias: 'WOLFTEI.DIGITAL',
  banco: 'Banco Santander / Brubank',
  titularCuenta: 'Carlos Alberto Prost',
  cuitTitular: '20-33607855-6',
  leyendaComprobante: 'Comprobante digital emitido conforme a normas fiscales y de autogestión de WolfTeI.',
};

@Injectable({
  providedIn: 'root',
})
export class FiscalService {
  private firebaseService = inject(FirebaseService);
  private readonly DOC_PATH = 'settings/fiscal';

  /**
   * Escucha reactivamente la configuración fiscal de la empresa en Firestore.
   * Si no existe o da error, devuelve los valores predeterminados corporativos de WolfTeI.
   */
  listenFiscalSettings(): Observable<FiscalSettings> {
    return new Observable<FiscalSettings>((observer) => {
      const docRef = doc(this.firebaseService.db, this.DOC_PATH);

      const unsubscribe = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            observer.next({ ...FISCAL_DEFAULTS, ...(docSnap.data() as FiscalSettings) });
          } else {
            observer.next(FISCAL_DEFAULTS);
          }
        },
        (error) => {
          console.warn('Fallback a valores por defecto en FiscalService:', error);
          observer.next(FISCAL_DEFAULTS);
        }
      );

      return () => unsubscribe();
    });
  }

  /**
   * Guarda o actualiza los datos fiscales en Firestore.
   */
  guardarConfiguracionFiscal(settings: Partial<FiscalSettings>): Observable<void> {
    const docRef = doc(this.firebaseService.db, this.DOC_PATH);
    const data: FiscalSettings = {
      ...FISCAL_DEFAULTS,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    return from(setDoc(docRef, data, { merge: true }));
  }
}

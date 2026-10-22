import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

export interface DolarCotizacion {
  moneda: string;
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

@Injectable({
  providedIn: 'root',
})
export class CurrencyService {
  private http = inject(HttpClient);
  private apiUrl = 'https://dolarapi.com/v1/dolares';

  // Cache para las tasas de cambio
  private exchangeRatesCache$?: Observable<DolarCotizacion[]>;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 600000; // 10 minutos en milisegundos

  // Tasa de fallback en caso de error
  private readonly FALLBACK_RATES: DolarCotizacion[] = [
    { casa: 'oficial', nombre: 'Oficial', compra: 1000, venta: 1050, moneda: 'USD', fechaActualizacion: '' },
    { casa: 'blue', nombre: 'Blue', compra: 1300, venta: 1350, moneda: 'USD', fechaActualizacion: '' },
    { casa: 'mep', nombre: 'MEP', compra: 1250, venta: 1300, moneda: 'USD', fechaActualizacion: '' },
    { casa: 'cripto', nombre: 'Cripto', compra: 1300, venta: 1320, moneda: 'USD', fechaActualizacion: '' },
  ];

  /**
   * Obtiene todas las tasas de cambio desde DolarApi
   * Usa caché para evitar saturar la API
   */
  getExchangeRates(): Observable<DolarCotizacion[]> {
    const now = Date.now();

    if (this.exchangeRatesCache$ && now - this.cacheTimestamp < this.CACHE_DURATION) {
      return this.exchangeRatesCache$;
    }

    this.cacheTimestamp = now;
    this.exchangeRatesCache$ = this.http
      .get<DolarCotizacion[]>(this.apiUrl)
      .pipe(
        catchError((error) => {
          console.error('Error fetching exchange rates, using fallback:', error);
          return of(this.FALLBACK_RATES);
        }),
        shareReplay(1)
      );

    return this.exchangeRatesCache$;
  }

  /**
   * Formatea un número como moneda ARS
   */
  formatARS(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Formatea un número como moneda USD
   */
  formatUSD(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
}

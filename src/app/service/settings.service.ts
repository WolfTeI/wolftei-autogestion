import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FirebaseService } from './firebase.service';

export interface Settings {
  promoActive: boolean;
  promoEndDate?: string | null;
  discountPercentage?: number;
}

/**
 * Servicio de configuración comercial y promociones conectado directamente con Firestore ('settings/global').
 */
@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private firebaseService = inject(FirebaseService);
  private platformId = inject(PLATFORM_ID);
  private readonly COLLECTION_NAME = 'settings';
  private readonly DOC_ID = 'global';

  private settingsSubject = new BehaviorSubject<Settings>({
    promoActive: false,
    discountPercentage: 15,
  });

  settings$ = this.settingsSubject.asObservable();

  constructor() {
    this.fetchSettings();
  }

  fetchSettings(): void {
    if (isPlatformBrowser(this.platformId)) {
      const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, this.DOC_ID);
      getDoc(docRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            this.settingsSubject.next(docSnap.data() as Settings);
          }
        })
        .catch((err) => console.error('Error fetching settings from Firestore:', err));
    }
  }

  updateSettings(settings: Settings): Observable<any> {
    return from(this.saveSettings(settings));
  }

  private async saveSettings(settings: Settings): Promise<any> {
    const docRef = doc(this.firebaseService.db, this.COLLECTION_NAME, this.DOC_ID);
    await setDoc(docRef, settings, { merge: true });
    this.settingsSubject.next(settings);
    return { message: 'Settings actualizados en Firestore', data: settings };
  }

  getDiscountedPrice(originalPrice: number): number {
    const current = this.settingsSubject.value;
    if (!current.promoActive || !current.discountPercentage) return originalPrice;

    const discount = originalPrice * (current.discountPercentage / 100);
    return Math.floor(originalPrice - discount);
  }
}

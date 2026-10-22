import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Config } from '../interface/config.interface';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AcceptCookiesService {

  private readonly STORAGE_KEY = 'config';

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  getConfig(): Observable<Config> {
    if (isPlatformBrowser(this.platformId)) {
      const configStr = localStorage.getItem(this.STORAGE_KEY);
      console.log('AcceptCookiesService: Reading from localStorage:', configStr);
      if (configStr) {
        try {
          const parsed = JSON.parse(configStr);
          console.log('AcceptCookiesService: Parsed config:', parsed);
          return of(parsed);
        } catch (e) {
          console.error('AcceptCookiesService: Error parsing config', e);
        }
      }
      console.log('AcceptCookiesService: No config found in localStorage, returning false (show banner)');
      return of({ cookies: false } as Config);
    }
    
    console.log('AcceptCookiesService: SSR environment, returning true (hide banner)');
    // Return true on SSR to prevent flash of content
    return of({ cookies: true } as Config);
  }

  setConfig(datos: Config): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        console.log('AcceptCookiesService: Attempting to save config', datos);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(datos));
        console.log('AcceptCookiesService: Config saved successfully');
      } catch (e) {
        console.error('AcceptCookiesService: Error saving to localStorage', e);
      }
    } else {
        console.log('AcceptCookiesService: Not browser platform, skipping save');
    }
  }
}

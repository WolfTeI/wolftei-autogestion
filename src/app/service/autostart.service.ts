import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AutostartService {
  autostartEnabled = signal<boolean>(false);

  constructor() {
    this.checkStatus();
  }

  async checkStatus(): Promise<boolean> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const isEnabled = await invoke<boolean>('get_autostart_status');
      this.autostartEnabled.set(isEnabled);
      return isEnabled;
    } catch {
      // Fallback para entorno web / desarrollo sin Tauri runtime
      const saved = localStorage.getItem('wolftei_autostart') === 'true';
      this.autostartEnabled.set(saved);
      return saved;
    }
  }

  async setAutostart(enable: boolean): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_autostart', { enable });
      this.autostartEnabled.set(enable);
      localStorage.setItem('wolftei_autostart', String(enable));
    } catch (e) {
      console.warn('No se pudo invocar comando nativo de autostart:', e);
      this.autostartEnabled.set(enable);
      localStorage.setItem('wolftei_autostart', String(enable));
    }
  }
}

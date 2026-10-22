/**
 * Plantilla de configuración de entorno para WolfTeI Autogestión.
 * Copiá este archivo a environment.ts y environment.prod.ts con tus credenciales reales.
 */
export const environment = {
  production: false,
  firebase: {
    apiKey: 'TU_FIREBASE_API_KEY',
    authDomain: 'tu-proyecto.firebaseapp.com',
    projectId: 'tu-proyecto-id',
    storageBucket: 'tu-proyecto.firebasestorage.app',
    messagingSenderId: 'TU_SENDER_ID',
    appId: 'TU_APP_ID',
    measurementId: 'TU_MEASUREMENT_ID',
  },
  currencyApiUrl: 'https://api.exchangerate-api.com/v4/latest/USD',
};

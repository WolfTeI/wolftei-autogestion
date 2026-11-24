export interface HitoCalendario {
  titulo: string;
  descripcion: string;
  fecha: string; // Formato YYYY-MM-DD
  cliente?: string;
  proyecto?: string;
  tipo: 'vista_previa' | 'demo' | 'mvp' | 'entrega';
}

/**
 * Convierte una fecha YYYY-MM-DD a formato iCalendar (YYYYMMDD).
 */
function toICalDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/**
 * Genera el contenido de un archivo estándar iCalendar (.ics) compatible con el Calendario de Windows y Outlook.
 */
export function generarArchivoICS(eventos: HitoCalendario[], nombreColeccion: string = 'WolfTeI_Entregas'): void {
  if (!eventos || eventos.length === 0) return;

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WolfTeI Soluciones Digitales//Cronograma de Proyectos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${nombreColeccion}`,
  ];

  for (const ev of eventos) {
    if (!ev.fecha) continue;
    const dt = toICalDate(ev.fecha);
    const uid = `wolftei_${dt}_${Math.random().toString(36).substring(2, 9)}@wolftei.com.ar`;

    ics.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dt}`,
      `DTEND;VALUE=DATE:${dt}`,
      `SUMMARY:${ev.titulo}`,
      `DESCRIPTION:${ev.descripcion.replace(/\n/g, '\\n')}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT1D', // Alerta 1 día antes a las 9am
      'ACTION:DISPLAY',
      `DESCRIPTION:Recordatorio WolfTeI: ${ev.titulo}`,
      'END:VALARM',
      'END:VEVENT'
    );
  }

  ics.push('END:VCALENDAR');

  const blob = new Blob([ics.join('\r\n')], { type: 'text/calendar;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombreColeccion}_${new Date().toISOString().slice(0, 10)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

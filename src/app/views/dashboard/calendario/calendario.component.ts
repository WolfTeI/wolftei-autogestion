import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { ProyectosService, Proyecto } from '../../../service/proyectos.service';
import { NotificationService } from '../../../service/notification.service';
import { WhatsAppService } from '../../../service/whatsapp.service';
import { generarArchivoICS, HitoCalendario } from '../../../utils/ical-generator';

export interface EventoCalendario {
  id: string;
  proyectoId: string;
  proyectoTitulo: string;
  clienteNombre: string;
  clienteTelefono?: string;
  fecha: string; // YYYY-MM-DD
  tipo: 'vista_previa' | 'demo' | 'mvp' | 'entrega';
  tipoEtiqueta: string;
  color: string;
  icono: string;
  diasRestantes: number;
}

export interface DiaCalendario {
  fecha: Date;
  numeroDia: number;
  esMesActual: boolean;
  esHoy: boolean;
  fechaStr: string; // YYYY-MM-DD
  eventos: EventoCalendario[];
}

@Component({
  selector: 'app-calendario',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
  ],
  templateUrl: './calendario.component.html',
  styleUrl: './calendario.component.scss',
})
export class CalendarioComponent implements OnInit {
  private proyectosService = inject(ProyectosService);
  private notificationService = inject(NotificationService);
  private whatsAppService = inject(WhatsAppService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  cargando = signal<boolean>(true);
  proyectos = signal<Proyecto[]>([]);

  // Fecha del mes actualmente visible
  fechaVisualizada = signal<Date>(new Date());

  diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // Todos los hitos extraídos de los proyectos
  todosLosHitos = computed<EventoCalendario[]>(() => {
    const list: EventoCalendario[] = [];
    const projs = this.proyectos().filter((p) => p.status !== 'archivado' && p.status !== 'cancelado');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    for (const p of projs) {
      const pid = p.id || '';
      const ptitle = p.title;
      const cname = p.clientName || 'Cliente';
      const cphone = p.clientPhone;

      const calcDias = (fStr: string) => {
        const d = new Date(fStr + 'T00:00:00');
        const diff = d.getTime() - hoy.getTime();
        return Math.round(diff / (1000 * 60 * 60 * 24));
      };

      if (p.fechaVistaPrevia) {
        list.push({
          id: `${pid}_vp`,
          proyectoId: pid,
          proyectoTitulo: ptitle,
          clienteNombre: cname,
          clienteTelefono: cphone,
          fecha: p.fechaVistaPrevia,
          tipo: 'vista_previa',
          tipoEtiqueta: 'Vista Previa / Wireframe',
          color: '#f59e0b',
          icono: 'design_services',
          diasRestantes: calcDias(p.fechaVistaPrevia),
        });
      }

      if (p.fechaDemo) {
        list.push({
          id: `${pid}_demo`,
          proyectoId: pid,
          proyectoTitulo: ptitle,
          clienteNombre: cname,
          clienteTelefono: cphone,
          fecha: p.fechaDemo,
          tipo: 'demo',
          tipoEtiqueta: 'Demo de Avance',
          color: '#8b5cf6',
          icono: 'live_tv',
          diasRestantes: calcDias(p.fechaDemo),
        });
      }

      if (p.fechaMvp) {
        list.push({
          id: `${pid}_mvp`,
          proyectoId: pid,
          proyectoTitulo: ptitle,
          clienteNombre: cname,
          clienteTelefono: cphone,
          fecha: p.fechaMvp,
          tipo: 'mvp',
          tipoEtiqueta: 'Entrega MVP',
          color: '#38bdf8',
          icono: 'rocket_launch',
          diasRestantes: calcDias(p.fechaMvp),
        });
      }

      const fEntrega = p.fechaEntrega || p.endDate;
      if (fEntrega) {
        list.push({
          id: `${pid}_entrega`,
          proyectoId: pid,
          proyectoTitulo: ptitle,
          clienteNombre: cname,
          clienteTelefono: cphone,
          fecha: fEntrega,
          tipo: 'entrega',
          tipoEtiqueta: 'Puesta en Producción',
          color: '#10b981',
          icono: 'task_alt',
          diasRestantes: calcDias(fEntrega),
        });
      }
    }

    return list.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  });

  // Hitos próximos (ordenados por fecha futura)
  proximosHitos = computed<EventoCalendario[]>(() => {
    return this.todosLosHitos().filter((h) => h.diasRestantes >= -2).slice(0, 10);
  });

  // Matriz de días del mes visualizado
  matrizMes = computed<DiaCalendario[]>(() => {
    const base = this.fechaVisualizada();
    const anio = base.getFullYear();
    const mes = base.getMonth();

    const primerDiaMes = new Date(anio, mes, 1);
    const ultimoDiaMes = new Date(anio, mes + 1, 0);

    // Ajustar para que la semana empiece el Lunes (0=Dom, 1=Lun ... 6=Sáb)
    let diaInicioSemana = primerDiaMes.getDay() - 1;
    if (diaInicioSemana === -1) diaInicioSemana = 6;

    const hoy = new Date();
    const hoyStr = hoy.toISOString().slice(0, 10);

    const hitos = this.todosLosHitos();
    const dias: DiaCalendario[] = [];

    // Días del mes anterior para rellenar
    for (let i = diaInicioSemana; i > 0; i--) {
      const d = new Date(anio, mes, 1 - i);
      const fStr = d.toISOString().slice(0, 10);
      dias.push({
        fecha: d,
        numeroDia: d.getDate(),
        esMesActual: false,
        esHoy: fStr === hoyStr,
        fechaStr: fStr,
        eventos: hitos.filter((h) => h.fecha === fStr),
      });
    }

    // Días del mes actual
    for (let d = 1; d <= ultimoDiaMes.getDate(); d++) {
      const fechaObj = new Date(anio, mes, d);
      const fStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dias.push({
        fecha: fechaObj,
        numeroDia: d,
        esMesActual: true,
        esHoy: fStr === hoyStr,
        fechaStr: fStr,
        eventos: hitos.filter((h) => h.fecha === fStr),
      });
    }

    // Días del mes siguiente para completar la cuadrícula (múltiplo de 7)
    const restante = 7 - (dias.length % 7);
    if (restante < 7) {
      for (let i = 1; i <= restante; i++) {
        const d = new Date(anio, mes + 1, i);
        const fStr = d.toISOString().slice(0, 10);
        dias.push({
          fecha: d,
          numeroDia: d.getDate(),
          esMesActual: false,
          esHoy: fStr === hoyStr,
          fechaStr: fStr,
          eventos: hitos.filter((h) => h.fecha === fStr),
        });
      }
    }

    return dias;
  });

  ngOnInit(): void {
    this.cargarProyectos();
  }

  cargarProyectos(): void {
    this.cargando.set(true);
    this.proyectosService.listenProyectos().subscribe({
      next: (list) => {
        this.proyectos.set(list);
        this.cargando.set(false);
      },
      error: (e) => {
        console.error(e);
        this.cargando.set(false);
      },
    });
  }

  cambiarMes(delta: number): void {
    const actual = this.fechaVisualizada();
    this.fechaVisualizada.set(new Date(actual.getFullYear(), actual.getMonth() + delta, 1));
  }

  irAHoy(): void {
    this.fechaVisualizada.set(new Date());
  }

  abrirProyecto(proyectoId: string): void {
    this.router.navigate(['/dashboard/proyectos', proyectoId]);
  }

  async contactarWhatsApp(evento: EventoCalendario): Promise<void> {
    if (!evento.clienteTelefono) {
      this.snackBar.open('El cliente no tiene teléfono registrado.', 'Cerrar', { duration: 3000 });
      return;
    }
    const mensaje = `¡Hola ${evento.clienteNombre}! Te contacto desde WolfTeI para coordinar el hito "${evento.tipoEtiqueta}" del proyecto "${evento.proyectoTitulo}" estipulado para el ${evento.fecha}.`;
    await this.whatsAppService.abrirChat(evento.clienteTelefono, mensaje);
  }

  exportarCalendarioWindowsICS(): void {
    const hitos = this.todosLosHitos();
    if (hitos.length === 0) {
      this.snackBar.open('No hay fechas de entregas ni hitos programados para exportar.', 'Cerrar', { duration: 3000 });
      return;
    }

    const payload: HitoCalendario[] = hitos.map((h) => ({
      titulo: `[WolfTeI] ${h.tipoEtiqueta}: ${h.proyectoTitulo} (${h.clienteNombre})`,
      descripcion: `Hito: ${h.tipoEtiqueta}\\nProyecto: ${h.proyectoTitulo}\\nCliente: ${h.clienteNombre}\\nPlataforma WolfTeI Autogestión.`,
      fecha: h.fecha,
      cliente: h.clienteNombre,
      proyecto: h.proyectoTitulo,
      tipo: h.tipo,
    }));

    generarArchivoICS(payload, 'WolfTeI_Calendario_Entregas');
    this.snackBar.open('📅 Calendario exportado. Abrilo para sincronizar automáticamente con el Calendario de Windows / Outlook.', 'Cerrar', { duration: 4500 });
  }

  enviarRecordatorioWindows(): void {
    const proximos = this.proximosHitos();
    if (proximos.length === 0) {
      this.snackBar.open('No hay entregas pendientes próximas para recordar.', '', { duration: 3000 });
      return;
    }

    const primero = proximos[0];
    const texto = `Próximo hito: ${primero.tipoEtiqueta} de "${primero.proyectoTitulo}" (${primero.clienteNombre}) el ${primero.fecha}.`;

    this.notificationService.send('📅 Recordatorio WolfTeI', texto);

    this.snackBar.open(`🔔 Alerta de escritorio enviada a Windows: ${primero.tipoEtiqueta}.`, 'Cerrar', { duration: 3500 });
  }
}

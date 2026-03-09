import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule, ReactiveFormsModule,
  FormBuilder, FormGroup, Validators
} from '@angular/forms';

export type EventStatus = 'pending' | 'in-progress' | 'unorganized';

export interface Evento {
  id: string;
  nombre: string;
  descripcion: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  status: EventStatus;
  notificado15min: boolean;
  notificado1h: boolean;
  notificadoInicio: boolean;
  createdAt: Date;
}

export interface Notificacion {
  id: string;
  mensaje: string;
  tipo: 'warning' | 'info' | 'success';
  timestamp: Date;
  leida: boolean;
}

@Component({
  selector: 'app-eventos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './eventos.html',
  styleUrls: ['./eventos.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventosComponent implements OnInit, OnDestroy {
  eventos: Evento[] = [];
  notificaciones: Notificacion[] = [];
  mostrarFormulario = false;
  mostrarNotificaciones = false;
  filtroActual: EventStatus | 'all' = 'all';
  eventoEditando: Evento | null = null;
  menuAbierto: string | null = null;

  form!: FormGroup;
  private timer: any;
  private notifCtrl: Record<string, boolean> = {};

  readonly statusCfg = {
    pending:       { label: 'Pendiente',     icon: '⏳', cssClass: 'status-pending' },
    'in-progress': { label: 'En Progreso',   icon: '▶',  cssClass: 'status-progress' },
    unorganized:   { label: 'Sin Organizar', icon: '◈',  cssClass: 'status-unorganized' },
  };
  readonly statusKeys: EventStatus[] = ['pending', 'in-progress', 'unorganized'];

  constructor(private fb: FormBuilder, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nombre:      ['', [Validators.required, Validators.minLength(3)]],
      descripcion: [''],
      fecha:       ['', Validators.required],
      horaInicio:  ['', Validators.required],
      horaFin:     ['', Validators.required],
    });
    this.cargarDemo();
    this.iniciarMonitoreo();
  }

  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }

  cargarDemo(): void {
    const hoy = new Date();
    const p   = (n: number) => String(n).padStart(2,'0');
    const fH  = `${hoy.getFullYear()}-${p(hoy.getMonth()+1)}-${p(hoy.getDate())}`;
    const h   = hoy.getHours();
    const man = new Date(hoy); man.setDate(man.getDate()+1);
    const fM  = `${man.getFullYear()}-${p(man.getMonth()+1)}-${p(man.getDate())}`;

    this.eventos = [
      { id: this.uid(), nombre: 'Incorporaciones', descripcion: 'Bienvenida a nuevos colaboradores', fecha: fH, horaInicio: `${p(Math.max(0,h-1))}:00`, horaFin: `${p(h+3)}:00`, status: 'in-progress', notificado15min: true, notificado1h: true, notificadoInicio: true, createdAt: new Date() },
      { id: this.uid(), nombre: 'Reunión Planeación Q2', descripcion: 'Revisión de roadmap con producto', fecha: fM, horaInicio: '09:00', horaFin: '11:00', status: 'pending', notificado15min: false, notificado1h: false, notificadoInicio: false, createdAt: new Date() },
      { id: this.uid(), nombre: 'Capacitación Técnica', descripcion: 'Sesión sobre nuevas tecnologías', fecha: fH, horaInicio: `${p(Math.max(0,h-4))}:00`, horaFin: `${p(Math.max(0,h-2))}:00`, status: 'unorganized', notificado15min: true, notificado1h: true, notificadoInicio: true, createdAt: new Date() },
    ];
  }

  iniciarMonitoreo(): void {
    this.verificarEstados();
    this.timer = setInterval(() => { this.verificarEstados(); this.cdr.markForCheck(); }, 30_000);
  }

  verificarEstados(): void {
    const now = new Date();
    this.eventos.forEach(ev => {
      const inicio = this.dt(ev.fecha, ev.horaInicio);
      const fin    = this.dt(ev.fecha, ev.horaFin);
      const diffM  = (inicio.getTime() - now.getTime()) / 60_000;

      if (now >= inicio && now < fin) ev.status = 'in-progress';
      else if (now >= fin && ev.status === 'in-progress') ev.status = 'unorganized';

      if (!this.notifCtrl[ev.id+'_1h'] && diffM > 0 && diffM <= 60) { this.notifCtrl[ev.id+'_1h'] = true; ev.notificado1h = true; this.pushNotif(`⏰ En 1 hora: ${ev.nombre}`, 'warning'); }
      if (!this.notifCtrl[ev.id+'_15m'] && diffM > 0 && diffM <= 15) { this.notifCtrl[ev.id+'_15m'] = true; ev.notificado15min = true; this.pushNotif(`🔔 En 15 min: ${ev.nombre}`, 'warning'); }
      if (!this.notifCtrl[ev.id+'_st'] && now >= inicio && now < new Date(inicio.getTime()+5*60_000)) { this.notifCtrl[ev.id+'_st'] = true; ev.notificadoInicio = true; this.pushNotif(`🚀 Comenzó: ${ev.nombre}`, 'info'); }
    });
  }

  pushNotif(mensaje: string, tipo: 'warning' | 'info' | 'success'): void {
    this.notificaciones.unshift({ id: this.uid(), mensaje, tipo, timestamp: new Date(), leida: false });
    if ('Notification' in window && Notification.permission === 'granted')
      new Notification('📅 Eventos', { body: mensaje });
  }

  solicitarPermiso(): void {
    if ('Notification' in window)
      Notification.requestPermission().then(p => {
        if (p === 'granted') { this.pushNotif('✅ Notificaciones activadas', 'success'); this.cdr.markForCheck(); }
      });
  }

  abrirFormulario(ev?: Evento): void {
    this.eventoEditando = ev ?? null;
    this.mostrarFormulario = true;
    this.form.reset();
    if (ev) this.form.patchValue({ nombre: ev.nombre, descripcion: ev.descripcion, fecha: ev.fecha, horaInicio: ev.horaInicio, horaFin: ev.horaFin });
  }

  cerrarFormulario(): void { this.mostrarFormulario = false; this.eventoEditando = null; this.form.reset(); }

  guardar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.value;
    if (this.eventoEditando) {
      const i = this.eventos.findIndex(e => e.id === this.eventoEditando!.id);
      if (i !== -1) this.eventos[i] = { ...this.eventos[i], ...v };
    } else {
      this.eventos.unshift({ id: this.uid(), ...v, status: 'pending', notificado15min: false, notificado1h: false, notificadoInicio: false, createdAt: new Date() });
      this.pushNotif(`✅ Evento creado: ${v.nombre}`, 'success');
    }
    this.verificarEstados();
    this.cerrarFormulario();
  }

  eliminar(id: string): void { this.eventos = this.eventos.filter(e => e.id !== id); this.menuAbierto = null; }
  cambiarStatus(id: string, s: EventStatus): void { const e = this.eventos.find(x => x.id === id); if (e) e.status = s; this.menuAbierto = null; }
  toggleMenu(id: string): void { this.menuAbierto = this.menuAbierto === id ? null : id; }

  get filtrados(): Evento[] {
    return (this.filtroActual === 'all' ? [...this.eventos] : this.eventos.filter(e => e.status === this.filtroActual))
      .sort((a,b) => this.dt(a.fecha,a.horaInicio).getTime() - this.dt(b.fecha,b.horaInicio).getTime());
  }
  get noLeidas(): number { return this.notificaciones.filter(n => !n.leida).length; }
  contar(s: EventStatus): number { return this.eventos.filter(e => e.status === s).length; }
  marcarLeidas(): void { this.notificaciones.forEach(n => n.leida = true); }

  dt(fecha: string, hora: string): Date { return new Date(`${fecha}T${hora}:00`); }
  formatFecha(f: string): string { return new Date(f+'T00:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'}); }
  formatHora(h: string): string { const [hh,mm] = h.split(':').map(Number); return `${hh%12||12}:${String(mm).padStart(2,'0')} ${hh>=12?'PM':'AM'}`; }
  uid(): string { return Math.random().toString(36).slice(2,10); }
  trackId(_: number, e: Evento): string { return e.id; }
}
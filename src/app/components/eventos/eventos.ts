import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule, ReactiveFormsModule,
  FormBuilder, FormGroup, Validators
} from '@angular/forms';
import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, push, onValue,
  update, remove, Database
} from 'firebase/database';

// ── Firebase config ────────────────────────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyB1OYIgIw5aO7RBC12h-QHKi3fiF_bm9yk',
  authDomain: 'evaluacion1-7dce4.firebaseapp.com',
  databaseURL: 'https://evaluacion1-7dce4-default-rtdb.firebaseio.com',
  projectId: 'evaluacion1-7dce4',
  storageBucket: 'evaluacion1-7dce4.firebasestorage.app',
  messagingSenderId: '51092318160',
  appId: '1:51092318160:web:8b19e526d6d2997bc67bd5'
};

const firebaseApp = initializeApp(firebaseConfig);
const db: Database = getDatabase(firebaseApp);

// ── Types ──────────────────────────────────────────────────
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
  createdAt: number;
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
  cargando = true;
  errorMsg = '';

  form!: FormGroup;
  private timer: any;
  private notifCtrl: Record<string, boolean> = {};
  private dbUnsubscribe: (() => void) | null = null;

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
    this.escucharEventos();
    this.iniciarMonitoreo();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.dbUnsubscribe) this.dbUnsubscribe();
  }

  // ── Firebase: escuchar cambios en tiempo real ─────────────
  escucharEventos(): void {
    const eventosRef = ref(db, 'eventos');
    const unsubscribe = onValue(
      eventosRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          this.eventos = Object.entries(data).map(([id, val]: [string, any]) => ({
            id,
            ...val,
          })) as Evento[];
        } else {
          this.eventos = [];
        }
        this.cargando = false;
        this.verificarEstados();
        this.cdr.markForCheck();
      },
      (error) => {
        this.errorMsg = 'Error al conectar con Firebase: ' + error.message;
        this.cargando = false;
        this.cdr.markForCheck();
      }
    );
    this.dbUnsubscribe = unsubscribe;
  }

  // ── Firebase: crear evento ─────────────────────────────────
  async crearEvento(datos: Omit<Evento, 'id'>): Promise<void> {
    try {
      const eventosRef = ref(db, 'eventos');
      await push(eventosRef, datos);
      this.pushNotif(`✅ Evento creado: ${datos.nombre}`, 'success');
    } catch (e: any) {
      this.errorMsg = 'Error al crear evento: ' + e.message;
    }
  }

  // ── Firebase: actualizar evento ────────────────────────────
  async actualizarEvento(id: string, datos: Partial<Evento>): Promise<void> {
    try {
      const eventoRef = ref(db, `eventos/${id}`);
      await update(eventoRef, datos);
    } catch (e: any) {
      this.errorMsg = 'Error al actualizar: ' + e.message;
    }
  }

  // ── Firebase: eliminar evento ──────────────────────────────
  async eliminarEvento(id: string): Promise<void> {
    try {
      const eventoRef = ref(db, `eventos/${id}`);
      await remove(eventoRef);
      this.menuAbierto = null;
    } catch (e: any) {
      this.errorMsg = 'Error al eliminar: ' + e.message;
    }
  }

  // ── Monitoreo automático de estados ───────────────────────
  iniciarMonitoreo(): void {
    this.timer = setInterval(() => {
      this.verificarEstados();
      this.cdr.markForCheck();
    }, 30_000);
  }

  verificarEstados(): void {
    const now = new Date();
    this.eventos.forEach(ev => {
      const inicio = this.dt(ev.fecha, ev.horaInicio);
      const fin    = this.dt(ev.fecha, ev.horaFin);
      const diffM  = (inicio.getTime() - now.getTime()) / 60_000;
      let nuevoStatus: EventStatus = ev.status;

      if (now >= inicio && now < fin) nuevoStatus = 'in-progress';
      else if (now >= fin && ev.status === 'in-progress') nuevoStatus = 'unorganized';

      // Actualizar en Firebase si el status cambió automáticamente
      if (nuevoStatus !== ev.status) {
        this.actualizarEvento(ev.id, { status: nuevoStatus });
      }

      // Notificación 1 hora antes
      if (!this.notifCtrl[ev.id + '_1h'] && diffM > 0 && diffM <= 60) {
        this.notifCtrl[ev.id + '_1h'] = true;
        this.actualizarEvento(ev.id, { notificado1h: true });
        this.pushNotif(`⏰ En 1 hora: ${ev.nombre}`, 'warning');
      }
      // Notificación 15 minutos antes
      if (!this.notifCtrl[ev.id + '_15m'] && diffM > 0 && diffM <= 15) {
        this.notifCtrl[ev.id + '_15m'] = true;
        this.actualizarEvento(ev.id, { notificado15min: true });
        this.pushNotif(`🔔 En 15 min: ${ev.nombre}`, 'warning');
      }
      // Notificación al inicio
      const cincoMin = new Date(inicio.getTime() + 5 * 60_000);
      if (!this.notifCtrl[ev.id + '_st'] && now >= inicio && now < cincoMin) {
        this.notifCtrl[ev.id + '_st'] = true;
        this.actualizarEvento(ev.id, { notificadoInicio: true });
        this.pushNotif(`🚀 Comenzó: ${ev.nombre}`, 'info');
      }
    });
  }

  // ── Notificaciones locales + sistema ──────────────────────
  pushNotif(mensaje: string, tipo: 'warning' | 'info' | 'success'): void {
    this.notificaciones.unshift({
      id: this.uid(), mensaje, tipo,
      timestamp: new Date(), leida: false
    });
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('📅 Eventos', { body: mensaje });
    }
    this.cdr.markForCheck();
  }

  solicitarPermiso(): void {
    if ('Notification' in window) {
      Notification.requestPermission().then(p => {
        if (p === 'granted') {
          this.pushNotif('✅ Notificaciones del sistema activadas', 'success');
        }
      });
    }
  }

  // ── Formulario ────────────────────────────────────────────
  abrirFormulario(ev?: Evento): void {
    this.eventoEditando = ev ?? null;
    this.mostrarFormulario = true;
    this.form.reset();
    if (ev) {
      this.form.patchValue({
        nombre: ev.nombre, descripcion: ev.descripcion,
        fecha: ev.fecha, horaInicio: ev.horaInicio, horaFin: ev.horaFin,
      });
    }
  }

  cerrarFormulario(): void {
    this.mostrarFormulario = false;
    this.eventoEditando = null;
    this.form.reset();
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.value;

    if (this.eventoEditando) {
      await this.actualizarEvento(this.eventoEditando.id, {
        nombre: v.nombre, descripcion: v.descripcion,
        fecha: v.fecha, horaInicio: v.horaInicio, horaFin: v.horaFin,
      });
    } else {
      const nuevo: Omit<Evento, 'id'> = {
        nombre: v.nombre, descripcion: v.descripcion || '',
        fecha: v.fecha, horaInicio: v.horaInicio, horaFin: v.horaFin,
        status: 'pending',
        notificado15min: false, notificado1h: false, notificadoInicio: false,
        createdAt: Date.now(),
      };
      await this.crearEvento(nuevo);
    }
    this.cerrarFormulario();
  }

  async cambiarStatus(id: string, status: EventStatus): Promise<void> {
    await this.actualizarEvento(id, { status });
    this.menuAbierto = null;
  }

  toggleMenu(id: string): void {
    this.menuAbierto = this.menuAbierto === id ? null : id;
  }

  // ── Getters ───────────────────────────────────────────────
  get filtrados(): Evento[] {
    return (this.filtroActual === 'all'
      ? [...this.eventos]
      : this.eventos.filter(e => e.status === this.filtroActual)
    ).sort((a, b) => this.dt(a.fecha, a.horaInicio).getTime() - this.dt(b.fecha, b.horaInicio).getTime());
  }

  get noLeidas(): number { return this.notificaciones.filter(n => !n.leida).length; }
  contar(s: EventStatus): number { return this.eventos.filter(e => e.status === s).length; }
  marcarLeidas(): void { this.notificaciones.forEach(n => n.leida = true); }
  cerrarError(): void { this.errorMsg = ''; }

  // ── Utils ─────────────────────────────────────────────────
  dt(fecha: string, hora: string): Date { return new Date(`${fecha}T${hora}:00`); }
  formatFecha(f: string): string {
    return new Date(f + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  formatHora(h: string): string {
    const [hh, mm] = h.split(':').map(Number);
    return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
  }
  uid(): string { return Math.random().toString(36).slice(2, 10); }
  trackId(_: number, e: Evento): string { return e.id; }
}
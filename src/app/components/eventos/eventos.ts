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

export type EventStatus = 'pending' | 'finishing' | 'completed' | 'uncompleted';

export interface Evento {
  id: string;
  nombre: string;
  descripcion: string;
  fechaInicio: string;   // NUEVO: fecha de inicio
  fechaFin: string;      // NUEVO: fecha de fin
  horaInicio: string;
  horaFin: string;
  status: EventStatus;
  completadoEn: number | null;
  notificadoProximo: boolean;
  notificadoPorFinalizar: boolean;
  notificadoSinCompletar: boolean;
  createdAt: number;
}

export interface Notificacion {
  id: string;
  mensaje: string;
  tipo: 'warning' | 'info' | 'success' | 'danger';
  timestamp: Date;
  leida: boolean;
}

export interface HistorialItem {
  id: string;
  nombre: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  completadoEn: number;
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
  mostrarHistorial = false;
  filtroActual: EventStatus | 'all' = 'all';
  eventoEditando: Evento | null = null;
  menuAbierto: string | null = null;
  cargando = true;
  errorMsg = '';

  // Buscador
  textoBusqueda = '';

  // Historial
  historialEditando: HistorialItem | null = null;
  mostrarConfirmEliminarHistorial = false;
  formHistorial!: FormGroup;

  form!: FormGroup;
  private timer: any;
  private notifCtrl: Record<string, boolean> = {};
  private dbUnsubscribe: (() => void) | null = null;

  readonly statusCfg: Record<EventStatus, { label: string; icon: string }> = {
    pending:     { label: 'Pendiente',    icon: '⏳' },
    finishing:   { label: 'Por Finalizar', icon: '🔥' },
    completed:   { label: 'Completada',   icon: '✅' },
    uncompleted: { label: 'Sin Completar', icon: '❌' },
  };

  readonly statusKeys: EventStatus[] = ['pending', 'finishing', 'uncompleted'];

  constructor(private fb: FormBuilder, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nombre:      ['', [Validators.required, Validators.minLength(3)]],
      descripcion: [''],
      fechaInicio: ['', Validators.required],
      fechaFin:    ['', Validators.required],
      horaInicio:  ['', Validators.required],
      horaFin:     ['', Validators.required],
    });
    this.formHistorial = this.fb.group({
      nombre:      ['', [Validators.required, Validators.minLength(3)]],
      descripcion: [''],
      fechaInicio: ['', Validators.required],
      fechaFin:    ['', Validators.required],
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

  escucharEventos(): void {
    const eventosRef = ref(db, 'eventos');
    const unsubscribe = onValue(
      eventosRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          this.eventos = Object.entries(data).map(([id, val]: [string, any]) => ({
            id,
            completadoEn: null,
            notificadoProximo: false,
            notificadoPorFinalizar: false,
            notificadoSinCompletar: false,
            // retrocompatibilidad: si solo tiene 'fecha', úsala para ambas
            fechaInicio: val.fechaInicio ?? val.fecha ?? '',
            fechaFin:    val.fechaFin    ?? val.fecha ?? '',
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

  async crearEvento(datos: Omit<Evento, 'id'>): Promise<void> {
    try {
      await push(ref(db, 'eventos'), datos);
      this.pushNotif(`✅ Evento creado: ${datos.nombre}`, 'success');
    } catch (e: any) {
      this.errorMsg = 'Error al crear evento: ' + e.message;
    }
  }

  async actualizarEvento(id: string, datos: Partial<Evento>): Promise<void> {
    try {
      await update(ref(db, `eventos/${id}`), datos);
    } catch (e: any) {
      this.errorMsg = 'Error al actualizar: ' + e.message;
    }
  }

  async eliminarEvento(id: string): Promise<void> {
    try {
      await remove(ref(db, `eventos/${id}`));
      this.menuAbierto = null;
    } catch (e: any) {
      this.errorMsg = 'Error al eliminar: ' + e.message;
    }
  }

  // ── Historial ───────────────────────────────────────────
  abrirEdicionHistorial(h: HistorialItem): void {
    this.historialEditando = h;
    this.formHistorial.patchValue({
      nombre:      h.nombre,
      descripcion: h.descripcion,
      fechaInicio: h.fechaInicio,
      fechaFin:    h.fechaFin,
      horaInicio:  h.horaInicio,
      horaFin:     h.horaFin,
    });
    this.cdr.markForCheck();
  }

  cerrarEdicionHistorial(): void {
    this.historialEditando = null;
    this.formHistorial.reset();
    this.cdr.markForCheck();
  }

  async guardarEdicionHistorial(): Promise<void> {
    if (this.formHistorial.invalid || !this.historialEditando) {
      this.formHistorial.markAllAsTouched();
      return;
    }
    const v = this.formHistorial.value;
    await this.actualizarEvento(this.historialEditando.id, {
      nombre: v.nombre, descripcion: v.descripcion || '',
      fechaInicio: v.fechaInicio, fechaFin: v.fechaFin,
      horaInicio: v.horaInicio, horaFin: v.horaFin,
    });
    this.pushNotif(`✏️ Historial actualizado: ${v.nombre}`, 'info');
    this.cerrarEdicionHistorial();
  }

  async eliminarTodoHistorial(): Promise<void> {
    try {
      await Promise.all(this.historial.map(h => remove(ref(db, `eventos/${h.id}`))));
      this.mostrarConfirmEliminarHistorial = false;
      this.pushNotif('🗑 Historial eliminado completamente', 'danger');
      this.cdr.markForCheck();
    } catch (e: any) {
      this.errorMsg = 'Error al eliminar historial: ' + e.message;
    }
  }

  iniciarMonitoreo(): void {
    this.timer = setInterval(() => {
      this.verificarEstados();
      this.cdr.markForCheck();
    }, 30_000);
  }

  verificarEstados(): void {
    const now = new Date();
    this.eventos.forEach(ev => {
      if (ev.status === 'completed') return;

      // Usamos fechaFin + horaFin y fechaInicio + horaInicio
      const inicio = this.dt(ev.fechaInicio, ev.horaInicio);
      const fin    = this.dt(ev.fechaFin,    ev.horaFin);
      const minParaInicio = (inicio.getTime() - now.getTime()) / 60_000;
      const minParaFin    = (fin.getTime()    - now.getTime()) / 60_000;

      if (now > fin && ev.status !== 'uncompleted') {
        this.actualizarEvento(ev.id, { status: 'uncompleted' });
      } else if (now >= inicio && minParaFin > 0 && minParaFin <= 60 && ev.status === 'pending') {
        this.actualizarEvento(ev.id, { status: 'finishing' });
      }

      const key15 = ev.id + '_proximo';
      if (!this.notifCtrl[key15] && !ev.notificadoProximo && minParaInicio > 0 && minParaInicio <= 30) {
        this.notifCtrl[key15] = true;
        this.actualizarEvento(ev.id, { notificadoProximo: true });
        this.pushNotif(`⏰ Próximo a comenzar en ${Math.round(minParaInicio)} min: ${ev.nombre}`, 'warning');
        this.notifSistema(`⏰ Próximo a comenzar en ${Math.round(minParaInicio)} min: ${ev.nombre}`);
      }

      const keyFin = ev.id + '_porFinalizar';
      if (!this.notifCtrl[keyFin] && !ev.notificadoPorFinalizar && now >= inicio && minParaFin > 0 && minParaFin <= 60) {
        this.notifCtrl[keyFin] = true;
        this.actualizarEvento(ev.id, { notificadoPorFinalizar: true });
        this.pushNotif(`🔥 Por Finalizar en ${Math.round(minParaFin)} min: ${ev.nombre}`, 'warning');
        this.notifSistema(`🔥 ${ev.nombre} está por finalizar`);
      }

      const keySC = ev.id + '_sinCompletar';
      if (!this.notifCtrl[keySC] && !ev.notificadoSinCompletar && now > fin) {
        this.notifCtrl[keySC] = true;
        this.actualizarEvento(ev.id, { notificadoSinCompletar: true });
        this.pushNotif(`❌ El evento "${ev.nombre}" finalizó sin ser completado`, 'danger');
        this.notifSistema(`❌ Evento sin completar: ${ev.nombre}`);
      }
    });
  }

  async marcarCompletado(ev: Evento): Promise<void> {
    await this.actualizarEvento(ev.id, { status: 'completed', completadoEn: Date.now() });
    this.menuAbierto = null;
    this.pushNotif(`✅ Completado: ${ev.nombre}`, 'success');
  }

  pushNotif(mensaje: string, tipo: 'warning' | 'info' | 'success' | 'danger'): void {
    this.notificaciones.unshift({ id: this.uid(), mensaje, tipo, timestamp: new Date(), leida: false });
    this.cdr.markForCheck();
  }

  notifSistema(mensaje: string): void {
    if ('Notification' in window && Notification.permission === 'granted')
      new Notification('📅 Eventos', { body: mensaje });
  }

  solicitarPermiso(): void {
    if ('Notification' in window)
      Notification.requestPermission().then(p => {
        if (p === 'granted') this.pushNotif('✅ Notificaciones del sistema activadas', 'success');
      });
  }

  abrirFormulario(ev?: Evento): void {
    this.eventoEditando = ev ?? null;
    this.mostrarFormulario = true;
    this.form.reset();
    if (ev) {
      this.form.patchValue({
        nombre: ev.nombre, descripcion: ev.descripcion,
        fechaInicio: ev.fechaInicio, fechaFin: ev.fechaFin,
        horaInicio: ev.horaInicio, horaFin: ev.horaFin,
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
        fechaInicio: v.fechaInicio, fechaFin: v.fechaFin,
        horaInicio: v.horaInicio, horaFin: v.horaFin,
      });
    } else {
      const nuevo: Omit<Evento, 'id'> = {
        nombre: v.nombre, descripcion: v.descripcion || '',
        fechaInicio: v.fechaInicio, fechaFin: v.fechaFin,
        horaInicio: v.horaInicio, horaFin: v.horaFin,
        status: 'pending', completadoEn: null,
        notificadoProximo: false, notificadoPorFinalizar: false,
        notificadoSinCompletar: false, createdAt: Date.now(),
      };
      await this.crearEvento(nuevo);
    }
    this.cerrarFormulario();
  }

  async cambiarStatus(id: string, status: EventStatus): Promise<void> {
    const ev = this.eventos.find(e => e.id === id);
    if (status === 'completed' && ev) {
      await this.marcarCompletado(ev);
    } else {
      await this.actualizarEvento(id, { status });
      this.menuAbierto = null;
    }
  }

  toggleMenu(id: string): void {
    this.menuAbierto = this.menuAbierto === id ? null : id;
  }

  limpiarBusqueda(): void {
    this.textoBusqueda = '';
    this.cdr.markForCheck();
  }

  get filtrados(): Evento[] {
    let base = this.eventos.filter(e => e.status !== 'completed');
    if (this.filtroActual !== 'all') base = base.filter(e => e.status === this.filtroActual);
    if (this.textoBusqueda.trim()) {
      const q = this.textoBusqueda.toLowerCase();
      base = base.filter(e =>
        e.nombre.toLowerCase().includes(q) ||
        (e.descripcion ?? '').toLowerCase().includes(q)
      );
    }
    return base.sort((a, b) =>
      this.dt(a.fechaInicio, a.horaInicio).getTime() - this.dt(b.fechaInicio, b.horaInicio).getTime()
    );
  }

  get historial(): HistorialItem[] {
    return this.eventos
      .filter(e => e.status === 'completed' && e.completadoEn)
      .sort((a, b) => (b.completadoEn ?? 0) - (a.completadoEn ?? 0))
      .map(e => ({
        id: e.id, nombre: e.nombre, descripcion: e.descripcion,
        fechaInicio: e.fechaInicio, fechaFin: e.fechaFin,
        horaInicio: e.horaInicio, horaFin: e.horaFin,
        completadoEn: e.completadoEn!,
      }));
  }

  get noLeidas(): number { return this.notificaciones.filter(n => !n.leida).length; }

  contar(s: EventStatus | 'active'): number {
    if (s === 'active') return this.eventos.filter(e => e.status !== 'completed').length;
    return this.eventos.filter(e => e.status === s).length;
  }

  marcarLeidas(): void { this.notificaciones.forEach(n => n.leida = true); }
  cerrarError(): void { this.errorMsg = ''; }

  esMultiDia(ev: Evento): boolean { return ev.fechaInicio !== ev.fechaFin; }

  dt(fecha: string, hora: string): Date { return new Date(`${fecha}T${hora}:00`); }

  formatFecha(f: string): string {
    return new Date(f + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  formatFechaCorta(f: string): string {
    return new Date(f + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  formatHora(h: string): string {
    const [hh, mm] = h.split(':').map(Number);
    return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
  }

  formatDateTime(ts: number): string {
    return new Date(ts).toLocaleString('es-ES', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit'
    });
  }

  uid(): string { return Math.random().toString(36).slice(2, 10); }
  trackId(_: number, e: Evento): string { return e.id; }
}
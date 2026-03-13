import {Component, OnInit, OnDestroy, ChangeDetectionStrategy,ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import {FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators} from '@angular/forms';
import { initializeApp } from 'firebase/app';
import {getDatabase, ref, push, onValue, update, remove, Database, set} from 'firebase/database';
import { EventoGeneral } from '../../Interface/events/EventoGeneral';
import { CargaInvalidosPipe, CargaValidosPipe } from '../../pipes/carga-masiva-pipe';

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

export interface Familia {
  id: string;
  nombre: string;
  descripcion: string;
  color: string;
  icono: string;
  createdAt: number;
}

export interface PendienteFamilia {
  id: string;
  familiaId: string;
  nombre: string;
  descripcion: string;
  completado: boolean;
  completadoEn: number | null;
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
  tipo: 'general' | 'familia';
  nombre: string;
  descripcion: string;
  fechaInicio?: string;
  fechaFin?: string;
  horaInicio?: string;
  horaFin?: string;
  completadoEn: number;
  familiaId: string | null;
}

export interface CargaMasivaItem {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  valido: boolean;
  error?: string;
}

export interface CargaMasivaResultado {
  exitosos: number;
  fallidos: number;
  errores: string[];
}

export const FAMILIA_COLORES = [
  { valor: '#6366f1', nombre: 'Índigo' },
  { valor: '#ec4899', nombre: 'Rosa' },
  { valor: '#14b8a6', nombre: 'Teal' },
  { valor: '#f59e0b', nombre: 'Ámbar' },
  { valor: '#8b5cf6', nombre: 'Violeta' },
  { valor: '#10b981', nombre: 'Esmeralda' },
  { valor: '#f97316', nombre: 'Naranja' },
  { valor: '#3b82f6', nombre: 'Azul' }
];

export const FAMILIA_ICONOS = ['🏠', '👨‍👩‍👧', '🏢', '🎓', '🎨', '🚀', '⚽', '🎵', '💼', '🌿', '🔬', '🍕'];

@Component({
  selector: 'app-eventos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CargaValidosPipe, CargaInvalidosPipe],
  templateUrl: './eventos.html',
  styleUrls: ['./eventos.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventosComponent implements OnInit, OnDestroy {

  eventosGenerales: EventoGeneral[] = [];
  familias: Familia[] = [];
  pendientesFamilia: PendienteFamilia[] = [];
  notificaciones: Notificacion[] = [];

  conteosPorFamilia: Record<string, { total: number; activos: number; completados: number }> = {};

  mostrarFormularioGeneral = false;
  mostrarFormFamilia = false;
  mostrarModalFamilia = false;
  mostrarNotificaciones = false;
  mostrarHistorial = false;
  mostrarConfirmEliminarHistorial = false;
  mostrarCargaMasiva = false;

  cargando = true;
  errorMsg = '';

  textoBusquedaGeneral = '';
  textoBusquedaPendientes = '';

  familiaSeleccionada: Familia | null = null;
  familiaEditando: Familia | null = null;
  eventoGeneralEditando: EventoGeneral | null = null;
  pendienteEditando: PendienteFamilia | null = null;
  historialEditando: HistorialItem | null = null;

  filtroGeneralActual: EventStatus | 'all' = 'all';
  ordenGeneralAsc = true;
  ordenPendientesAsc = true;
  menuGeneralAbierto: string | null = null;
  menuFamiliaAbierto: string | null = null;
  menuPendienteAbierto: string | null = null;

  familiaColorSeleccionado = FAMILIA_COLORES[0].valor;
  familiaIconoSeleccionado = FAMILIA_ICONOS[0];
  readonly familiaColores = FAMILIA_COLORES;
  readonly familiaIconos = FAMILIA_ICONOS;

  formGeneral!: FormGroup;
  formFamilia!: FormGroup;
  formPendiente!: FormGroup;
  formHistorial!: FormGroup;

  cargaMasivaTexto = '';
  cargaMasivaPreview: CargaMasivaItem[] = [];
  cargaMasivaModo: 'general' | 'familia' = 'general';
  cargaMasivaFamiliaId = '';
  cargaMasivaFamiliaNuevaNombre = '';
  cargaMasivaFamiliaNuevaColor = FAMILIA_COLORES[0].valor;
  cargaMasivaFamiliaNuevaIcono = FAMILIA_ICONOS[0];
  cargaMasivaCrearFamiliaNueva = false;
  cargaMasivaProcesando = false;
  cargaMasivaResultado: CargaMasivaResultado | null = null;
  cargaMasivaError = '';
  cargaMasivaPaso: 1 | 2 | 3 = 1;

  private timer: any;
  private notifCtrl: Record<string, boolean> = {};

  private unsubGeneral: (() => void) | null = null;
  private unsubFamilias: (() => void) | null = null;
  private unsubPendientes: (() => void) | null = null;
  private unsubConteos: (() => void)[] = [];

  readonly statusCfg: Record<EventStatus, { label: string; icon: string }> = {
    pending:     { label: 'Pendiente',    icon: '⏳' },
    finishing:   { label: 'Por Finalizar',icon: '🔥' },
    completed:   { label: 'Completado',   icon: '✅' },
    uncompleted: { label: 'Sin Completar',icon: '❌' }
  };

  readonly statusKeys: EventStatus[] = ['pending', 'finishing', 'uncompleted'];

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.formGeneral = this.fb.group({
      nombre:      ['', [Validators.required, Validators.minLength(3)]],
      descripcion: [''],
      fechaInicio: ['', Validators.required],
      fechaFin:    ['', Validators.required],
      horaInicio:  ['', Validators.required],
      horaFin:     ['', Validators.required]
    });

    this.formFamilia = this.fb.group({
      nombre:      ['', [Validators.required, Validators.minLength(2)]],
      descripcion: ['']
    });

    this.formPendiente = this.fb.group({
      nombre:      ['', [Validators.required, Validators.minLength(2)]],
      descripcion: ['']
    });

    this.formHistorial = this.fb.group({
      nombre:      ['', [Validators.required, Validators.minLength(2)]],
      descripcion: [''],
      fechaInicio: [''],
      fechaFin:    [''],
      horaInicio:  [''],
      horaFin:     ['']
    });

    this.escucharFamilias();
    this.escucharEventosGenerales();
    this.iniciarMonitoreo();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.unsubGeneral)   this.unsubGeneral();
    if (this.unsubFamilias)  this.unsubFamilias();
    if (this.unsubPendientes) this.unsubPendientes();
    this.unsubConteos.forEach(u => u());
  }

  escucharFamilias(): void {
    this.unsubFamilias = onValue(
      ref(db, 'familias'),
      snapshot => {
        const data = snapshot.val();
        this.familias = data
          ? Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }))
          : [];
        this.familias.sort((a, b) => b.createdAt - a.createdAt);
        this.escucharConteosFamilias();
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error => {
        this.errorMsg = 'Error al cargar grupos: ' + error.message;
        this.cargando = false;
        this.cdr.markForCheck();
      }
    );
  }

  escucharConteosFamilias(): void {
    this.unsubConteos.forEach(u => u());
    this.unsubConteos = [];

    this.familias.forEach(f => {
      const unsub = onValue(
        ref(db, `familiaPendientes/${f.id}`),
        snapshot => {
          const data = snapshot.val();
          const pendientes: PendienteFamilia[] = data
            ? Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }))
            : [];

          this.conteosPorFamilia[f.id] = {
            total:       pendientes.length,
            activos:     pendientes.filter(p => !p.completado).length,
            completados: pendientes.filter(p =>  p.completado).length
          };

          this.cdr.markForCheck();
        }
      );
      this.unsubConteos.push(unsub);
    });
  }

  escucharEventosGenerales(): void {
    this.unsubGeneral = onValue(
      ref(db, 'general'),
      snapshot => {
        const data = snapshot.val();
        this.eventosGenerales = data
          ? Object.entries(data).map(([id, val]: [string, any]) => ({
              id,
              completadoEn: null,
              notificadoProximo: false,
              notificadoPorFinalizar: false,
              notificadoSinCompletar: false,
              ...val
            }))
          : [];
        this.eventosGenerales.sort((a, b) => b.createdAt - a.createdAt);
        this.verificarEstadosGenerales();
        this.cdr.markForCheck();
      },
      error => {
        this.errorMsg = 'Error al cargar eventos generales: ' + error.message;
        this.cdr.markForCheck();
      }
    );
  }

  escucharPendientesFamilia(familiaId: string): void {
    if (this.unsubPendientes) {
      this.unsubPendientes();
      this.unsubPendientes = null;
    }

    this.unsubPendientes = onValue(
      ref(db, `familiaPendientes/${familiaId}`),
      snapshot => {
        const data = snapshot.val();
        this.pendientesFamilia = data
          ? Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }))
          : [];
        this.pendientesFamilia.sort((a, b) => {
          if (a.completado !== b.completado) return Number(a.completado) - Number(b.completado);
          return b.createdAt - a.createdAt;
        });
        this.cdr.markForCheck();
      },
      error => {
        this.errorMsg = 'Error al cargar pendientes del grupo: ' + error.message;
        this.cdr.markForCheck();
      }
    );
  }

  async crearFamilia(datos: Omit<Familia, 'id'>): Promise<void> {
    try {
      await push(ref(db, 'familias'), datos);
      this.pushNotif(`👨‍👩‍👧 Grupo creado: ${datos.nombre}`, 'success');
    } catch (e: any) {
      this.errorMsg = 'Error al crear grupo: ' + e.message;
    }
  }

  async actualizarFamilia(id: string, datos: Partial<Familia>): Promise<void> {
    try {
      await update(ref(db, `familias/${id}`), datos);
    } catch (e: any) {
      this.errorMsg = 'Error al actualizar grupo: ' + e.message;
    }
  }

  async eliminarFamilia(id: string): Promise<void> {
    try {
      await remove(ref(db, `familias/${id}`));
      await remove(ref(db, `familiaPendientes/${id}`));
      if (this.familiaSeleccionada?.id === id) this.cerrarModalFamilia();
      this.menuFamiliaAbierto = null;
      this.pushNotif('🗑 Grupo eliminado', 'danger');
    } catch (e: any) {
      this.errorMsg = 'Error al eliminar grupo: ' + e.message;
    }
  }

  abrirFormFamilia(f?: Familia): void {
    this.familiaEditando = f ?? null;
    this.mostrarFormFamilia = true;
    this.formFamilia.reset();

    if (f) {
      this.formFamilia.patchValue({ nombre: f.nombre, descripcion: f.descripcion });
      this.familiaColorSeleccionado = f.color;
      this.familiaIconoSeleccionado = f.icono;
    } else {
      this.familiaColorSeleccionado = FAMILIA_COLORES[0].valor;
      this.familiaIconoSeleccionado = FAMILIA_ICONOS[0];
    }
  }

  cerrarFormFamilia(): void {
    this.mostrarFormFamilia = false;
    this.familiaEditando = null;
    this.formFamilia.reset();
  }

  async guardarFamilia(): Promise<void> {
    if (this.formFamilia.invalid) { this.formFamilia.markAllAsTouched(); return; }

    const v = this.formFamilia.value;
    const datos = {
      nombre:      v.nombre,
      descripcion: v.descripcion || '',
      color:       this.familiaColorSeleccionado,
      icono:       this.familiaIconoSeleccionado
    };

    if (this.familiaEditando) {
      await this.actualizarFamilia(this.familiaEditando.id, datos);
      this.pushNotif(`✏️ Grupo actualizado: ${v.nombre}`, 'info');
    } else {
      await this.crearFamilia({ ...datos, createdAt: Date.now() });
    }

    this.cerrarFormFamilia();
  }

  abrirModalFamilia(familia: Familia): void {
    this.familiaSeleccionada = familia;
    this.mostrarModalFamilia = true;
    this.pendienteEditando = null;
    this.formPendiente.reset({ nombre: '', descripcion: '' });
    this.escucharPendientesFamilia(familia.id);
  }

  cerrarModalFamilia(): void {
    this.mostrarModalFamilia = false;
    this.familiaSeleccionada = null;
    this.pendientesFamilia = [];
    this.pendienteEditando = null;
    this.formPendiente.reset();
    this.menuPendienteAbierto = null;
    if (this.unsubPendientes) { this.unsubPendientes(); this.unsubPendientes = null; }
  }

  async crearEventoGeneral(datos: Omit<EventoGeneral, 'id'>): Promise<void> {
    try {
      await push(ref(db, 'general'), datos);
      this.pushNotif(`✅ Evento general creado: ${datos.nombre}`, 'success');
    } catch (e: any) {
      this.errorMsg = 'Error al crear evento general: ' + e.message;
    }
  }

  async actualizarEventoGeneral(id: string, datos: Partial<EventoGeneral>): Promise<void> {
    try {
      await update(ref(db, `general/${id}`), datos);
    } catch (e: any) {
      this.errorMsg = 'Error al actualizar evento general: ' + e.message;
    }
  }

  async eliminarEventoGeneral(id: string): Promise<void> {
    try {
      await remove(ref(db, `general/${id}`));
      this.menuGeneralAbierto = null;
    } catch (e: any) {
      this.errorMsg = 'Error al eliminar evento general: ' + e.message;
    }
  }

  abrirFormularioGeneral(ev?: EventoGeneral): void {
    this.eventoGeneralEditando = ev ?? null;
    this.mostrarFormularioGeneral = true;
    this.formGeneral.reset();

    if (ev) {
      this.formGeneral.patchValue({
        nombre:      ev.nombre,
        descripcion: ev.descripcion,
        fechaInicio: ev.fechaInicio,
        fechaFin:    ev.fechaFin,
        horaInicio:  ev.horaInicio,
        horaFin:     ev.horaFin
      });
    }
  }

  cerrarFormularioGeneral(): void {
    this.mostrarFormularioGeneral = false;
    this.eventoGeneralEditando = null;
    this.formGeneral.reset();
  }

  async guardarEventoGeneral(): Promise<void> {
    if (this.formGeneral.invalid) { this.formGeneral.markAllAsTouched(); return; }

    const v = this.formGeneral.value;

    if (this.eventoGeneralEditando) {
      await this.actualizarEventoGeneral(this.eventoGeneralEditando.id, {
        nombre:      v.nombre,
        descripcion: v.descripcion || '',
        fechaInicio: v.fechaInicio,
        fechaFin:    v.fechaFin,
        horaInicio:  v.horaInicio,
        horaFin:     v.horaFin
      });
      this.pushNotif(`✏️ Evento general actualizado: ${v.nombre}`, 'info');
    } else {
      const nuevo: Omit<EventoGeneral, 'id'> = {
        nombre:                v.nombre,
        descripcion:           v.descripcion || '',
        fechaInicio:           v.fechaInicio,
        fechaFin:              v.fechaFin,
        horaInicio:            v.horaInicio,
        horaFin:               v.horaFin,
        status:                'pending',
        completadoEn:          null,
        notificadoProximo:     false,
        notificadoPorFinalizar:false,
        notificadoSinCompletar:false,
        createdAt:             Date.now()
      };
      await this.crearEventoGeneral(nuevo);
    }

    this.cerrarFormularioGeneral();
  }

  async cambiarStatusGeneral(id: string, status: EventStatus): Promise<void> {
    const ev = this.eventosGenerales.find(e => e.id === id);
    if (!ev) return;
    if (status === 'completed') { await this.marcarGeneralCompletado(ev); return; }
    await this.actualizarEventoGeneral(id, { status });
    this.menuGeneralAbierto = null;
  }

  async marcarGeneralCompletado(ev: EventoGeneral): Promise<void> {
    await this.actualizarEventoGeneral(ev.id, { status: 'completed', completadoEn: Date.now() });
    this.menuGeneralAbierto = null;
    this.pushNotif(`✅ Completado: ${ev.nombre}`, 'success');
  }

  async guardarPendienteFamilia(): Promise<void> {
    if (!this.familiaSeleccionada) return;
    if (this.formPendiente.invalid) { this.formPendiente.markAllAsTouched(); return; }

    const v = this.formPendiente.value;

    if (this.pendienteEditando) {
      await this.actualizarPendienteFamilia(this.familiaSeleccionada.id, this.pendienteEditando.id, {
        nombre:      v.nombre,
        descripcion: v.descripcion || ''
      });
      this.pushNotif(`✏️ Pendiente actualizado: ${v.nombre}`, 'info');
    } else {
      const nuevoRef = push(ref(db, `familiaPendientes/${this.familiaSeleccionada.id}`));
      const nuevo: Omit<PendienteFamilia, 'id'> = {
        familiaId:   this.familiaSeleccionada.id,
        nombre:      v.nombre,
        descripcion: v.descripcion || '',
        completado:  false,
        completadoEn:null,
        createdAt:   Date.now()
      };
      try {
        await set(nuevoRef, nuevo);
        this.pushNotif(`📝 Pendiente creado en ${this.familiaSeleccionada.nombre}`, 'success');
      } catch (e: any) {
        this.errorMsg = 'Error al crear pendiente: ' + e.message;
      }
    }

    this.cancelarEdicionPendiente();
  }

  async actualizarPendienteFamilia(
    familiaId: string,
    pendienteId: string,
    datos: Partial<PendienteFamilia>
  ): Promise<void> {
    try {
      await update(ref(db, `familiaPendientes/${familiaId}/${pendienteId}`), datos);
    } catch (e: any) {
      this.errorMsg = 'Error al actualizar pendiente: ' + e.message;
    }
  }

  async eliminarPendienteFamilia(pendienteId: string): Promise<void> {
    if (!this.familiaSeleccionada) return;
    try {
      await remove(ref(db, `familiaPendientes/${this.familiaSeleccionada.id}/${pendienteId}`));
      this.menuPendienteAbierto = null;
    } catch (e: any) {
      this.errorMsg = 'Error al eliminar pendiente: ' + e.message;
    }
  }

  editarPendiente(p: PendienteFamilia): void {
    this.pendienteEditando = p;
    this.formPendiente.patchValue({ nombre: p.nombre, descripcion: p.descripcion });
    this.menuPendienteAbierto = null;
    this.cdr.markForCheck();
  }

  cancelarEdicionPendiente(): void {
    this.pendienteEditando = null;
    this.formPendiente.reset({ nombre: '', descripcion: '' });
    this.cdr.markForCheck();
  }

  async toggleCompletarPendiente(p: PendienteFamilia): Promise<void> {
    if (!this.familiaSeleccionada) return;
    const nuevoEstado = !p.completado;
    await this.actualizarPendienteFamilia(this.familiaSeleccionada.id, p.id, {
      completado:   nuevoEstado,
      completadoEn: nuevoEstado ? Date.now() : null
    });
    this.pushNotif(
      nuevoEstado ? `✅ Pendiente completado: ${p.nombre}` : `↩️ Pendiente reactivado: ${p.nombre}`,
      nuevoEstado ? 'success' : 'info'
    );
  }

  abrirEdicionHistorial(h: HistorialItem): void {
    this.historialEditando = h;
    this.formHistorial.patchValue({
      nombre:      h.nombre,
      descripcion: h.descripcion,
      fechaInicio: h.fechaInicio || '',
      fechaFin:    h.fechaFin    || '',
      horaInicio:  h.horaInicio  || '',
      horaFin:     h.horaFin     || ''
    });
    this.cdr.markForCheck();
  }

  cerrarEdicionHistorial(): void {
    this.historialEditando = null;
    this.formHistorial.reset();
    this.cdr.markForCheck();
  }

  async guardarEdicionHistorial(): Promise<void> {
    if (!this.historialEditando || this.formHistorial.invalid) {
      this.formHistorial.markAllAsTouched();
      return;
    }

    const v = this.formHistorial.value;

    if (this.historialEditando.tipo === 'general') {
      await this.actualizarEventoGeneral(this.historialEditando.id, {
        nombre:      v.nombre,
        descripcion: v.descripcion || '',
        fechaInicio: v.fechaInicio || '',
        fechaFin:    v.fechaFin    || '',
        horaInicio:  v.horaInicio  || '',
        horaFin:     v.horaFin     || ''
      });
    } else if (this.historialEditando.familiaId) {
      await this.actualizarPendienteFamilia(this.historialEditando.familiaId, this.historialEditando.id, {
        nombre:      v.nombre,
        descripcion: v.descripcion || ''
      });
    }

    this.pushNotif(`✏️ Historial actualizado: ${v.nombre}`, 'info');
    this.cerrarEdicionHistorial();
  }

  async eliminarTodoHistorial(): Promise<void> {
    try {
      const tareas: Promise<void>[] = [];
      for (const item of this.historial) {
        if (item.tipo === 'general') {
          tareas.push(remove(ref(db, `general/${item.id}`)));
        } else if (item.familiaId) {
          tareas.push(remove(ref(db, `familiaPendientes/${item.familiaId}/${item.id}`)));
        }
      }
      await Promise.all(tareas);
      this.mostrarConfirmEliminarHistorial = false;
      this.pushNotif('🗑 Historial eliminado completamente', 'danger');
      this.cdr.markForCheck();
    } catch (e: any) {
      this.errorMsg = 'Error al eliminar historial: ' + e.message;
    }
  }

  abrirCargaMasiva(modo: 'general' | 'familia' = 'general'): void {
    this.mostrarCargaMasiva = true;
    this.cargaMasivaModo = modo;
    this.cargaMasivaTexto = '';
    this.cargaMasivaPreview = [];
    this.cargaMasivaFamiliaId = this.familias.length > 0 ? this.familias[0].id : '';
    this.cargaMasivaFamiliaNuevaNombre = '';
    this.cargaMasivaFamiliaNuevaColor = FAMILIA_COLORES[0].valor;
    this.cargaMasivaFamiliaNuevaIcono = FAMILIA_ICONOS[0];
    this.cargaMasivaCrearFamiliaNueva = false;
    this.cargaMasivaProcesando = false;
    this.cargaMasivaResultado = null;
    this.cargaMasivaError = '';
    this.cargaMasivaPaso = 1;
  }

  cerrarCargaMasiva(): void {
    this.mostrarCargaMasiva = false;
    this.cargaMasivaTexto = '';
    this.cargaMasivaPreview = [];
    this.cargaMasivaResultado = null;
    this.cargaMasivaError = '';
    this.cargaMasivaPaso = 1;
  }

  parsearFecha(raw: string): string {
    if (!raw) return '';
    const limpio = raw.trim();

    const ddmmyyyy = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/;
    const m1 = limpio.match(ddmmyyyy);
    if (m1) {
      const d = m1[1].padStart(2, '0');
      const mo = m1[2].padStart(2, '0');
      const y = m1[3];
      return `${y}-${mo}-${d}`;
    }

    const yyyymmdd = /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/;
    const m2 = limpio.match(yyyymmdd);
    if (m2) {
      const y = m2[1];
      const mo = m2[2].padStart(2, '0');
      const d = m2[3].padStart(2, '0');
      return `${y}-${mo}-${d}`;
    }

    return '';
  }

  parsearLineaCargaMasiva(linea: string): CargaMasivaItem | null {
    const partes = linea.split(/\t/);

    if (partes.length >= 3) {
      const nombre = partes[0].trim();
      const fi = this.parsearFecha(partes[1].trim());
      const ff = this.parsearFecha(partes[2].trim());

      if (!nombre) return null;

      const item: CargaMasivaItem = {
        nombre,
        fechaInicio: fi,
        fechaFin: ff,
        valido: true
      };

      if (!fi || !ff) {
        item.valido = false;
        item.error = 'Fechas no reconocidas';
      }

      return item;
    }

    if (partes.length === 1) {
      const cols = linea.split(/\s{2,}/);
      if (cols.length >= 3) {
        const nombre = cols[0].trim();
        const fi = this.parsearFecha(cols[cols.length - 2].trim());
        const ff = this.parsearFecha(cols[cols.length - 1].trim());

        if (!nombre) return null;

        return {
          nombre,
          fechaInicio: fi,
          fechaFin: ff,
          valido: !!(fi && ff),
          error: (!fi || !ff) ? 'Fechas no reconocidas' : undefined
        };
      }
    }

    return null;
  }

  procesarTextoCargaMasiva(): void {
    this.cargaMasivaError = '';
    this.cargaMasivaPreview = [];

    if (!this.cargaMasivaTexto.trim()) {
      this.cargaMasivaError = 'El texto está vacío. Pega el contenido de tu tabla.';
      return;
    }

    const lineas = this.cargaMasivaTexto
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const items: CargaMasivaItem[] = [];

    for (const linea of lineas) {
      const esEncabezado = /^(actividad|nombre|evento|tarea|descripcion|fecha|inicio|fin)/i.test(linea);
      if (esEncabezado) continue;

      const esTituloSeccion = !/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/.test(linea) && linea.split('\t').length < 2;
      if (esTituloSeccion) continue;

      const item = this.parsearLineaCargaMasiva(linea);
      if (item) items.push(item);
    }

    if (items.length === 0) {
      this.cargaMasivaError = 'No se encontraron filas válidas. Asegúrate de copiar directamente desde una tabla (Excel, Google Sheets, Word) con columnas: Actividad | Fecha Inicio | Fecha Fin.';
      return;
    }

    this.cargaMasivaPreview = items;
    this.cargaMasivaPaso = 2;
    this.cdr.markForCheck();
  }

  async ejecutarCargaMasiva(): Promise<void> {
    if (this.cargaMasivaPreview.length === 0) return;

    const itemsValidos = this.cargaMasivaPreview.filter(i => i.valido);
    if (itemsValidos.length === 0) {
      this.cargaMasivaError = 'No hay ítems válidos para cargar.';
      return;
    }

    this.cargaMasivaProcesando = true;
    this.cargaMasivaError = '';
    this.cdr.markForCheck();

    const resultado: CargaMasivaResultado = { exitosos: 0, fallidos: 0, errores: [] };

    try {
      if (this.cargaMasivaModo === 'general') {
        for (const item of itemsValidos) {
          try {
            const nuevo: Omit<EventoGeneral, 'id'> = {
              nombre:                item.nombre,
              descripcion:           '',
              fechaInicio:           item.fechaInicio,
              fechaFin:              item.fechaFin,
              horaInicio:            '08:00',
              horaFin:               '17:00',
              status:                'pending',
              completadoEn:          null,
              notificadoProximo:     false,
              notificadoPorFinalizar:false,
              notificadoSinCompletar:false,
              createdAt:             Date.now()
            };
            await push(ref(db, 'general'), nuevo);
            resultado.exitosos++;
          } catch (e: any) {
            resultado.fallidos++;
            resultado.errores.push(`"${item.nombre}": ${e.message}`);
          }
        }
      } else {
        let familiaId = this.cargaMasivaFamiliaId;

        if (this.cargaMasivaCrearFamiliaNueva) {
          if (!this.cargaMasivaFamiliaNuevaNombre.trim()) {
            this.cargaMasivaError = 'Ingresa un nombre para el nuevo grupo.';
            this.cargaMasivaProcesando = false;
            this.cdr.markForCheck();
            return;
          }

          const nuevaFamilia: Omit<Familia, 'id'> = {
            nombre:      this.cargaMasivaFamiliaNuevaNombre.trim(),
            descripcion: '',
            color:       this.cargaMasivaFamiliaNuevaColor,
            icono:       this.cargaMasivaFamiliaNuevaIcono,
            createdAt:   Date.now()
          };

          const famRef = await push(ref(db, 'familias'), nuevaFamilia);
          familiaId = famRef.key!;
          this.pushNotif(`👨‍👩‍👧 Grupo creado: ${nuevaFamilia.nombre}`, 'success');
        }

        if (!familiaId) {
          this.cargaMasivaError = 'Selecciona o crea un grupo.';
          this.cargaMasivaProcesando = false;
          this.cdr.markForCheck();
          return;
        }

        for (const item of itemsValidos) {
          try {
            const nuevoRef = push(ref(db, `familiaPendientes/${familiaId}`));
            const nuevo: Omit<PendienteFamilia, 'id'> = {
              familiaId,
              nombre:      item.nombre,
              descripcion: item.fechaInicio && item.fechaFin
                ? `${this.formatFechaCorta(item.fechaInicio)} → ${this.formatFechaCorta(item.fechaFin)}`
                : '',
              completado:  false,
              completadoEn:null,
              createdAt:   Date.now()
            };
            await set(nuevoRef, nuevo);
            resultado.exitosos++;
          } catch (e: any) {
            resultado.fallidos++;
            resultado.errores.push(`"${item.nombre}": ${e.message}`);
          }
        }
      }

      this.cargaMasivaResultado = resultado;
      this.cargaMasivaPaso = 3;
      this.pushNotif(
        `📥 Carga masiva completada: ${resultado.exitosos} creados${resultado.fallidos > 0 ? `, ${resultado.fallidos} con error` : ''}`,
        resultado.fallidos === 0 ? 'success' : 'warning'
      );
    } catch (e: any) {
      this.cargaMasivaError = 'Error inesperado: ' + e.message;
    }

    this.cargaMasivaProcesando = false;
    this.cdr.markForCheck();
  }

  iniciarMonitoreo(): void {
    this.timer = setInterval(() => {
      this.verificarEstadosGenerales();
      this.cdr.markForCheck();
    }, 30000);
  }

  verificarEstadosGenerales(): void {
    const now = new Date();

    this.eventosGenerales.forEach(ev => {
      if (ev.status === 'completed') return;
      if (!ev.fechaInicio || !ev.fechaFin) return;

      const inicio = this.dt(ev.fechaInicio, ev.horaInicio || '00:00');
      const fin    = this.dt(ev.fechaFin,    ev.horaFin    || '23:59');

      const minParaInicio = (inicio.getTime() - now.getTime()) / 60000;
      const minParaFin    = (fin.getTime()    - now.getTime()) / 60000;

      if (now > fin && ev.status !== 'uncompleted') {
        this.actualizarEventoGeneral(ev.id, { status: 'uncompleted' });
      } else if (now >= inicio && minParaFin > 0 && minParaFin <= 60 && ev.status === 'pending') {
        this.actualizarEventoGeneral(ev.id, { status: 'finishing' });
      }

      const keyInicio = ev.id + '_proximo';
      if (!this.notifCtrl[keyInicio] && !ev.notificadoProximo && minParaInicio > 0 && minParaInicio <= 30) {
        this.notifCtrl[keyInicio] = true;
        this.actualizarEventoGeneral(ev.id, { notificadoProximo: true });
        this.pushNotif(`⏰ Próximo a comenzar en ${Math.round(minParaInicio)} min: ${ev.nombre}`, 'warning');
        this.notifSistema(`⏰ Próximo a comenzar en ${Math.round(minParaInicio)} min: ${ev.nombre}`);
      }

      const keyFin = ev.id + '_porFinalizar';
      if (!this.notifCtrl[keyFin] && !ev.notificadoPorFinalizar && now >= inicio && minParaFin > 0 && minParaFin <= 60) {
        this.notifCtrl[keyFin] = true;
        this.actualizarEventoGeneral(ev.id, { notificadoPorFinalizar: true });
        this.pushNotif(`🔥 Por finalizar en ${Math.round(minParaFin)} min: ${ev.nombre}`, 'warning');
        this.notifSistema(`🔥 ${ev.nombre} está por finalizar`);
      }

      const keySinCompletar = ev.id + '_sinCompletar';
      if (!this.notifCtrl[keySinCompletar] && !ev.notificadoSinCompletar && now > fin) {
        this.notifCtrl[keySinCompletar] = true;
        this.actualizarEventoGeneral(ev.id, { notificadoSinCompletar: true });
        this.pushNotif(`❌ El evento "${ev.nombre}" finalizó sin ser completado`, 'danger');
        this.notifSistema(`❌ Evento sin completar: ${ev.nombre}`);
      }
    });
  }

  pushNotif(mensaje: string, tipo: 'warning' | 'info' | 'success' | 'danger'): void {
    this.notificaciones.unshift({
      id: this.uid(), mensaje, tipo, timestamp: new Date(), leida: false
    });
    this.cdr.markForCheck();
  }

  notifSistema(mensaje: string): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('📅 Eventos', { body: mensaje });
    }
  }

  solicitarPermiso(): void {
    if ('Notification' in window) {
      Notification.requestPermission().then(p => {
        if (p === 'granted') this.pushNotif('✅ Notificaciones del sistema activadas', 'success');
      });
    }
  }

  marcarLeidas(): void {
    this.notificaciones.forEach(n => (n.leida = true));
  }

  getPendientesActivos(familiaId: string): number {
    return this.conteosPorFamilia[familiaId]?.activos ?? 0;
  }

  getTotalPendientes(familiaId: string): number {
    return this.conteosPorFamilia[familiaId]?.total ?? 0;
  }

  getCompletadosPendientes(familiaId: string): number {
    return this.conteosPorFamilia[familiaId]?.completados ?? 0;
  }

  getProgresoPendientes(familiaId: string): number {
    const total = this.getTotalPendientes(familiaId);
    if (total === 0) return 0;
    return Math.round((this.getCompletadosPendientes(familiaId) / total) * 100);
  }

  get totalPendientesActivos(): number {
    return Object.values(this.conteosPorFamilia).reduce((sum, c) => sum + c.activos, 0);
  }

  get totalPendientesCompletados(): number {
    return Object.values(this.conteosPorFamilia).reduce((sum, c) => sum + c.completados, 0);
  }

  get eventosGeneralesActivos(): EventoGeneral[] {
    const now = new Date();
    return this.eventosGenerales.filter(ev => {
      if (ev.status === 'completed') return false;
      if (!ev.fechaInicio || !ev.fechaFin) return false;
      const inicio = this.dt(ev.fechaInicio, ev.horaInicio || '00:00');
      const fin    = this.dt(ev.fechaFin,    ev.horaFin    || '23:59');
      return now >= inicio && now <= fin;
    });
  }

  get eventosGeneralesFiltrados(): EventoGeneral[] {
    let base = this.eventosGenerales.filter(e => e.status !== 'completed');

    if (this.filtroGeneralActual !== 'all') {
      base = base.filter(e => e.status === this.filtroGeneralActual);
    }

    if (this.textoBusquedaGeneral.trim()) {
      const q = this.textoBusquedaGeneral.toLowerCase();
      base = base.filter(e =>
        e.nombre.toLowerCase().includes(q) ||
        (e.descripcion ?? '').toLowerCase().includes(q)
      );
    }

    const mult = this.ordenGeneralAsc ? 1 : -1;
    return [...base].sort((a, b) => mult * (
      this.dt(a.fechaInicio, a.horaInicio || '00:00').getTime() -
      this.dt(b.fechaInicio, b.horaInicio || '00:00').getTime()
    ));
  }

  toggleOrdenGeneral(): void {
    this.ordenGeneralAsc = !this.ordenGeneralAsc;
    this.cdr.markForCheck();
  }

  toggleOrdenPendientes(): void {
    this.ordenPendientesAsc = !this.ordenPendientesAsc;
    this.cdr.markForCheck();
  }

  get pendientesFamiliaFiltrados(): PendienteFamilia[] {
    let base = [...this.pendientesFamilia];
    if (this.textoBusquedaPendientes.trim()) {
      const q = this.textoBusquedaPendientes.toLowerCase();
      base = base.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.descripcion ?? '').toLowerCase().includes(q)
      );
    }
    const mult = this.ordenPendientesAsc ? 1 : -1;
    return base.sort((a, b) => {
      if (a.completado !== b.completado) return Number(a.completado) - Number(b.completado);
      return mult * (a.createdAt - b.createdAt);
    });
  }

  get pendientesActivosGrupo(): number {
    return this.pendientesFamiliaFiltrados.filter(p => !p.completado).length;
  }

  get historial(): HistorialItem[] {
    const historialGenerales: HistorialItem[] = this.eventosGenerales
      .filter(e => e.status === 'completed' && e.completadoEn)
      .map(e => ({
        id:          e.id,
        tipo:        'general' as const,
        nombre:      e.nombre,
        descripcion: e.descripcion,
        fechaInicio: e.fechaInicio,
        fechaFin:    e.fechaFin,
        horaInicio:  e.horaInicio,
        horaFin:     e.horaFin,
        completadoEn:e.completadoEn!,
        familiaId:   null
      }));

    const historialPendientes: HistorialItem[] = this.pendientesFamilia
      .filter(p => p.completado && p.completadoEn)
      .map(p => ({
        id:          p.id,
        tipo:        'familia' as const,
        nombre:      p.nombre,
        descripcion: p.descripcion,
        completadoEn:p.completadoEn!,
        familiaId:   p.familiaId
      }));

    return [...historialGenerales, ...historialPendientes]
      .sort((a, b) => b.completadoEn - a.completadoEn);
  }

  get noLeidas(): number {
    return this.notificaciones.filter(n => !n.leida).length;
  }

  contarGenerales(s: EventStatus | 'active'): number {
    if (s === 'active') return this.eventosGenerales.filter(e => e.status !== 'completed').length;
    return this.eventosGenerales.filter(e => e.status === s).length;
  }

  contarPendientesGrupo(familiaId: string): number {
    if (this.familiaSeleccionada?.id === familiaId) {
      return this.pendientesFamilia.filter(p => !p.completado).length;
    }
    return 0;
  }

  contarCompletadosGrupo(): number {
    return this.pendientesFamilia.filter(p => p.completado).length;
  }

  getFamilia(id: string | null): Familia | undefined {
    if (!id) return undefined;
    return this.familias.find(f => f.id === id);
  }

  cerrarError(): void { this.errorMsg = ''; }

  toggleMenuGeneral(id: string): void {
    this.menuGeneralAbierto = this.menuGeneralAbierto === id ? null : id;
  }
  toggleMenuFamilia(id: string): void {
    this.menuFamiliaAbierto = this.menuFamiliaAbierto === id ? null : id;
  }
  toggleMenuPendiente(id: string): void {
    this.menuPendienteAbierto = this.menuPendienteAbierto === id ? null : id;
  }

  limpiarBusquedaGeneral(): void   { this.textoBusquedaGeneral   = ''; this.cdr.markForCheck(); }
  limpiarBusquedaPendientes(): void { this.textoBusquedaPendientes = ''; this.cdr.markForCheck(); }

  dt(fecha: string, hora: string): Date {
    return new Date(`${fecha}T${hora}:00`);
  }

  formatFecha(f: string): string {
    if (!f) return '—';
    return new Date(f + 'T00:00:00').toLocaleDateString('es-ES', {
      weekday: 'short', day: 'numeric', month: 'short'
    });
  }

  formatFechaCorta(f: string): string {
    if (!f) return '—';
    return new Date(f + 'T00:00:00').toLocaleDateString('es-ES', {
      day: 'numeric', month: 'short'
    });
  }

  formatHora(h: string): string {
    if (!h) return '—';
    const [hh, mm] = h.split(':').map(Number);
    return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
  }

  formatDateTime(ts: number): string {
    return new Date(ts).toLocaleString('es-ES', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit'
    });
  }

  uid(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  trackGeneralId(_: number, e: EventoGeneral): string { return e.id; }
  trackFamiliaId(_: number, f: Familia): string       { return f.id; }
  trackPendienteId(_: number, p: PendienteFamilia): string { return p.id; }
  trackPreviewId(_: number, i: CargaMasivaItem): string { return i.nombre + i.fechaInicio; }
}
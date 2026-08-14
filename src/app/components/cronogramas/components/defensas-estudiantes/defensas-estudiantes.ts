import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ── AJUSTA ESTE IMPORT según la ruta real de tu servicio de cronogramas ──
import { CronogramaService, Cronograma } from '../../firebase/cronogramas';
import { ProgramarDefensa } from './components/programar-defensa/programar-defensa';

// ── AJUSTA ESTE IMPORT según la ruta real del componente ──

// ── Requisito individual consultado en Firestore (proyecto utet) ──
export interface RequisitoTitulacion {
  clave: string;     // clave normalizada (sin tildes/espacios/mayúsculas)
  etiqueta: string;  // nombre legible para mostrar en la UI
  estado: 'CUMPLE' | 'NO CUMPLE' | 'NO ENCONTRADO';
}

export type EstadoNotif = 'activa' | 'pendiente' | 'sin-telegram';

// ── Estudiante ya combinado: datos de RTDB + requisitos de Firestore ──
export interface EstudianteDefensa {
  cedula: string;
  nombres: string;
  carrera: string;
  telegramUser: string;
  estadoNotif: EstadoNotif;

  requisitos: RequisitoTitulacion[];
  totalCumple: number;
  totalRequisitos: number;
  habilitado: boolean; // true si cumple los 8 requisitos (solo informativo)

  cargandoRequisitos: boolean;
  errorRequisitos: string;

  seleccionado?: boolean;
}

@Component({
  selector: 'app-defensas-estudiantes',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgramarDefensa],
  templateUrl: './defensas-estudiantes.html',
  styleUrl: './defensas-estudiantes.css'
})
export class DefensasEstudiantes implements OnInit {

  // ── Selección de periodo (antes "cronograma") ──────
  cronogramas: Cronograma[] = [];
  cronogramaSeleccionado: Cronograma | null = null;
  filtroPeriodo = '';
  cargandoCronogramas = false;

  // ── Estudiantes vinculados al cronograma seleccionado ─────────────────
  estudiantes: EstudianteDefensa[] = [];
  estudiantesFiltrados: EstudianteDefensa[] = [];
  cargandoEstudiantes = false;

  // ── Filtros de la tabla ────────────────────────────────────────────────
  filtroTexto          = '';
  filtroCarrera        = '';
  filtroNotificaciones = '';
  paginaActual         = 1;

  // ── Modal de programar defensa ─────────────────────────────
  mostrarProgramarDefensa = false;
  estudianteParaDefensa: EstudianteDefensa | null = null;

  /**
   * Valores del campo `periodo` que nunca deben aparecer en el selector
   * (comparación sin distinguir mayúsculas/minúsculas).
   */
  private readonly CRONOGRAMAS_EXCLUIDOS = ['ugpa', 'utet'];

  /**
   * Los 8 requisitos de titulación que se consultan en Firestore (utet),
   * con su clave normalizada (sin tildes, espacios ni mayúsculas) para
   * poder comparar contra las keys reales del documento sin importar
   * cómo estén escritas allí (Academico, ActualizaciónDatos, etc.).
   *
   * Nota: el requisito "Prácticas" corresponde al campo real
   * "PrácticasVinculacion" en Firestore (combinado), por eso su clave
   * normalizada es 'practicasvinculacion'.
   */
  private readonly REQUISITOS_REQUERIDOS: { clave: string; etiqueta: string }[] = [
    { clave: 'academico',            etiqueta: 'Académico' },
    { clave: 'actualizaciondatos',   etiqueta: 'Actualización de Datos' },
    { clave: 'documentacion',        etiqueta: 'Documentación' },
    { clave: 'financiero',           etiqueta: 'Financiero' },
    { clave: 'ingles',               etiqueta: 'Inglés' },
    { clave: 'practicasvinculacion', etiqueta: 'Prácticas' },
    { clave: 'vinculacion',          etiqueta: 'Vinculación' },
    { clave: 'seguimientograduados', etiqueta: 'Seguimiento a Graduados' }
  ];

  constructor(
    private cronogramaService: CronogramaService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarCronogramas();
  }

  // ══════════════════════════════════════════════════════════════════════
  // PASO 1: Cargar cronogramas (RTDB) — equivalente al selector de periodo
  // ══════════════════════════════════════════════════════════════════════
  private async cargarCronogramas(): Promise<void> {
    this.cargandoCronogramas = true;
    this.cdr.detectChanges();
    try {
      this.cronogramas = await this.cronogramaService.obtenerCronogramas();
    } catch (e) {
      console.error('Error cargando cronogramas:', e);
      this.cronogramas = [];
    } finally {
      this.cargandoCronogramas = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Lista de periodos que se muestran en el selector:
   * - Se ocultan los que ya finalizaron (estado === 'FINALIZADO')
   * - Se ocultan los cronogramas cuyo campo `periodo` sea UGPA o UTET
   * - Se aplica el texto de búsqueda del input
   */
  get periodosFiltrados(): Cronograma[] {
    const q = this.filtroPeriodo.toLowerCase().trim();

    return this.cronogramas
      .filter((c: any) => c.estado !== 'FINALIZADO')
      .filter((c: any) => {
        const periodo = (c.periodo ?? '').toLowerCase();
        return !this.CRONOGRAMAS_EXCLUIDOS.some(ex => periodo.includes(ex));
      })
      .filter((c: any) =>
        !q ||
        (c.nombre ?? '').toLowerCase().includes(q) ||
        (c.periodo ?? '').toLowerCase().includes(q)
      );
  }

  async seleccionarPeriodo(cronograma: Cronograma): Promise<void> {
    this.cronogramaSeleccionado = cronograma;
    this.filtroTexto = '';
    this.filtroCarrera = '';
    this.filtroNotificaciones = '';
    this.paginaActual = 1;
    this.cargandoEstudiantes = true;
    this.cdr.detectChanges();

    // Los estudiantes vienen embebidos dentro del cronograma (RTDB)
    const mapa = (cronograma as any).estudiantesVinculados ?? {};
    this.estudiantes = Object.values(mapa).map((e: any) => this.mapearEstudiante(e));
    this.aplicarFiltros();

    this.cargandoEstudiantes = false;
    this.cdr.detectChanges();

    // Lanzar en paralelo la consulta de requisitos (Firestore utet) para cada estudiante
    this.cargarRequisitosDeTodos();
  }

  volverPeriodos(): void {
    this.cronogramaSeleccionado = null;
    this.filtroPeriodo = '';
    this.estudiantes = [];
    this.estudiantesFiltrados = [];
  }

  private mapearEstudiante(e: any): EstudianteDefensa {
    return {
      cedula: e.cedula ?? '',
      nombres: e.nombres ?? '',
      carrera: e.carrera ?? '',
      telegramUser: e.telegramUser ?? '',
      estadoNotif: this.calcularEstadoNotif(e),
      requisitos: [],
      totalCumple: 0,
      totalRequisitos: this.REQUISITOS_REQUERIDOS.length,
      habilitado: false,
      cargandoRequisitos: true,
      errorRequisitos: ''
    };
  }

  private calcularEstadoNotif(e: any): EstadoNotif {
    if (e.telegramChatId && e.notificacionesActivas) return 'activa';
    if (e.telegramUser || e.telegramChatId) return 'pendiente';
    return 'sin-telegram';
  }

  // ══════════════════════════════════════════════════════════════════════
  // PASO 2: Carreras disponibles (derivadas de los estudiantes cargados)
  // ══════════════════════════════════════════════════════════════════════
  get carrerasDisponibles(): string[] {
    const valores = this.estudiantes.map(e => e.carrera).filter(c => c.trim() !== '');
    return [...new Set(valores)].sort((a, b) => a.localeCompare(b, 'es'));
  }

  // ══════════════════════════════════════════════════════════════════════
  // PASO 3: Requisitos de titulación (Firestore, proyecto utet)
  // ══════════════════════════════════════════════════════════════════════
  private async cargarRequisitosDeTodos(): Promise<void> {
    await Promise.all(this.estudiantes.map(est => this.consultarRequisitos(est)));
    this.aplicarFiltros();
    this.cdr.detectChanges();
  }

  /**
   * Normaliza un texto para comparar sin importar tildes, mayúsculas/minúsculas
   * ni espacios. Ej: "Prácticas Vinculación" -> "practicasvinculacion"
   */
  private normalizar(texto: any): string {
    return (texto ?? '')
      .toString()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private async consultarRequisitos(est: EstudianteDefensa): Promise<void> {
    est.cargandoRequisitos = true;
    est.errorRequisitos = '';

    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { getUtetFirestore } = await import('../../firebase/utet-firestore');
      const db = getUtetFirestore();

      if (!est.cedula) {
        est.errorRequisitos = 'Estudiante sin cédula registrada.';
        est.requisitos = this.REQUISITOS_REQUERIDOS.map(r => ({ ...r, estado: 'NO ENCONTRADO' as const }));
        return;
      }

      // Intento 1: cédula tal como viene
      let snap = await getDoc(doc(db, 'Estudiantes', est.cedula));

      // Intento 2: si empieza con '0', probar sin el cero inicial
      if (!snap.exists() && est.cedula.startsWith('0')) {
        snap = await getDoc(doc(db, 'Estudiantes', est.cedula.slice(1)));
      }

      if (!snap.exists()) {
        est.errorRequisitos = 'No se encontró el registro de este estudiante en UTET.';
        est.requisitos = this.REQUISITOS_REQUERIDOS.map(r => ({ ...r, estado: 'NO ENCONTRADO' as const }));
        est.totalCumple = 0;
        est.habilitado = false;
        return;
      }

      const data = snap.data() as Record<string, any>;

      // Mapa: clave normalizada del campo -> valor original (string)
      const camposNormalizados = new Map<string, string>();
      for (const [key, value] of Object.entries(data)) {
        camposNormalizados.set(this.normalizar(key), typeof value === 'string' ? value : '');
      }

      est.requisitos = this.REQUISITOS_REQUERIDOS.map(r => {
        const valorBruto = camposNormalizados.get(r.clave);
        const valorNorm = this.normalizar(valorBruto);

        let estado: RequisitoTitulacion['estado'];
        if (valorNorm === 'cumple') estado = 'CUMPLE';
        else if (valorNorm === 'nocumple') estado = 'NO CUMPLE';
        else estado = 'NO ENCONTRADO';

        return { clave: r.clave, etiqueta: r.etiqueta, estado };
      });

      est.totalCumple = est.requisitos.filter(r => r.estado === 'CUMPLE').length;
      est.habilitado = est.totalCumple === this.REQUISITOS_REQUERIDOS.length;

    } catch (err) {
      console.error('Error al consultar requisitos de', est.cedula, err);
      est.errorRequisitos = 'Error al consultar la base de datos. Intenta de nuevo.';
    } finally {
      est.cargandoRequisitos = false;
    }
  }

  /** Permite reintentar la consulta de requisitos de un solo estudiante */
  async reintentarRequisitos(est: EstudianteDefensa): Promise<void> {
    await this.consultarRequisitos(est);
    this.cdr.detectChanges();
  }

  // ── Filtros de tabla ─────────────────────────────────────────────────
  aplicarFiltros(): void {
    const texto = this.filtroTexto.toLowerCase();

    this.estudiantesFiltrados = this.estudiantes.filter(est => {

      const coincideTexto =
        !texto ||
        est.nombres.toLowerCase().includes(texto) ||
        est.cedula.includes(texto);

      const coincideCarrera =
        !this.filtroCarrera || est.carrera === this.filtroCarrera;

      const coincideNotif =
        !this.filtroNotificaciones ||
        (this.filtroNotificaciones === 'si' && est.estadoNotif === 'activa') ||
        (this.filtroNotificaciones === 'no' && est.estadoNotif !== 'activa');

      return coincideTexto && coincideCarrera && coincideNotif;
    });
  }

  // ── Selección masiva ──────────────────────────────────────────────────
  toggleTodos(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.estudiantesFiltrados.forEach(e => e.seleccionado = checked);
  }

  // ── Agregar defensa: abre el modal ProgramarDefensa ───────────────────
agregarDefensa(est: EstudianteDefensa): void {
  alert('CLICK DETECTADO'); // 👈 temporal
  this.estudianteParaDefensa = est;
  this.mostrarProgramarDefensa = true;
}

  cerrarProgramarDefensa(): void {
    this.mostrarProgramarDefensa = false;
    this.estudianteParaDefensa = null;
  }
}

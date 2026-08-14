import {
    Component, Input, Output, EventEmitter,
    OnChanges, SimpleChanges, ChangeDetectorRef,
    OnDestroy, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';

import { EstudiantesService, Estudiante, GrupoInduccion } from '../../firebase/estudiante';
import { CronogramaService, Cronograma } from '../../firebase/cronogramas';
import { Docente, DocentesService } from '../../firebase/Docentes.service';

Chart.register(...registerables);

type Vista = 'grupos' | 'estudiantes' | 'manual' | 'vinculados' | 'estadisticas';
type TipoPersona = 'estudiante' | 'docente';
type VistaDocente = 'lista' | 'nuevo';
type EstadoNotif = 'activa' | 'pendiente' | 'sin-telegram';

interface ManualDatos {
    cedula: string;
    nombres: string;
    carrera: string;
    sede: string;
    telegramUser: string;
    grupo: string;
    asistencia: boolean;
}

interface DocenteForm {
    cedula: string;
    nombres: string;
    cargo: string;
    departamento: string;
}

// ── NUEVA INTERFAZ: estado del mini-modal de requisitos ──────────────────────
interface RequisitosModal {
    visible: boolean;
    cargando: boolean;
    error: string;
    cedula: string;
    nombres: string;
    items: { nombre: string; estado: string }[];
    totalCumple: number;
    totalNoCumple: number;
}

interface TransferirModal {
    visible: boolean;
    cargando: boolean;
    guardando: boolean;
    error: string;
    persona: any | null;
    cronogramas: Cronograma[];
    cronogramaDestinoId: string;
    eliminarDeOrigen: boolean;
}

@Component({
    selector: 'app-modal-vincular',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './modal-vincular.html',
    styleUrl: './modal-vincular.css'
})
export class ModalVincular implements OnChanges, OnDestroy {

    @Input() visible: boolean = false;
    @Input() cronograma: Cronograma | null = null;
    @Output() cerrarEvento = new EventEmitter<void>();
    @Output() vinculadoEvento = new EventEmitter<number>();

    @ViewChild('canvasNotifDonut') canvasNotifDonutRef?: ElementRef<HTMLCanvasElement>;
    @ViewChild('canvasSedeStack') canvasSedeStackRef?: ElementRef<HTMLCanvasElement>;
    @ViewChild('canvasSedeSinActivar') canvasSedeSinActivarRef?: ElementRef<HTMLCanvasElement>;
    @ViewChild('canvasCarreraStack') canvasCarreraStackRef?: ElementRef<HTMLCanvasElement>;
    @ViewChild('canvasCarreraSinActivar') canvasCarreraSinActivarRef?: ElementRef<HTMLCanvasElement>;

    private chartNotifDonut?: Chart;
    private chartSedeStack?: Chart;
    private chartSedeSinActivar?: Chart;
    private chartCarreraStack?: Chart;
    private chartCarreraSinActivar?: Chart;

    // ── Paso 1: grupos ──────────────────────────────────────────────────────
    vista: Vista = 'grupos';
    grupos: GrupoInduccion[] = [];
    grupoSeleccionado: GrupoInduccion | null = null;

    // ── Paso 2: estudiantes ─────────────────────────────────────────────────
    estudiantes: Estudiante[] = [];
    estudiantesFiltrados: Estudiante[] = [];
    seleccionados = new Set<string>();
    busqueda = '';
    filtroAsistencia: 'TODOS' | 'PRESENTE' | 'AUSENTE' = 'TODOS';
    filtroNotif: 'TODOS' | 'ACTIVAS' | 'PENDIENTES' = 'TODOS';

    // ── Paso 3: tipo de persona ─────────────────────────────────────────────
    tipoPersona: TipoPersona = 'estudiante';
    origenManual: 'grupos' | 'estudiantes' = 'grupos';

    // ── Sub-vista docente ───────────────────────────────────────────────────
    vistaDocente: VistaDocente = 'lista';
    docentes: Docente[] = [];
    docentesFiltrados: Docente[] = [];
    busquedaDocentes = '';
    cargandoDocentes = false;
    docenteSeleccionado: Docente | null = null;

    // ── Paso vinculados ─────────────────────────────────────────────────────
    origenVinculados: 'grupos' | 'estudiantes' = 'grupos';
    busquedaVinculados = '';
    filtroTipoVinculado: 'TODOS' | 'ESTUDIANTES' | 'DOCENTES' = 'TODOS';
    filtroNotifVinculados: 'TODOS' | 'ACTIVAS' | 'PENDIENTES' | 'SIN_TELEGRAM' | 'DUPLICADOS'= 'TODOS';
    filtroCarreraVinculadosSeleccionada = '';
    exportando = false;

    // ── Paso estadísticas ───────────────────────────────────────────────────
    origenEstadisticas: 'grupos' | 'estudiantes' | 'vinculados' = 'grupos';

    // ── Formularios ─────────────────────────────────────────────────────────
    manualDatos: ManualDatos = this.manualVacio();
    docenteForm: DocenteForm = this.docenteFormVacio();
    manualError = '';

    // ── Estado de carga ─────────────────────────────────────────────────────
    cargando = false;
    guardando = false;
    migrandoTelegram = false;
    actualizandoSede = false;

    // ── Filtros carrera / orden ─────────────────────────────────────────────
    carrerasDisponibles: string[] = [];
    filtroCarreras = new Set<string>();
    ordenarPorCarrera = false;

    // ── NUEVO: Mini-modal de requisitos ─────────────────────────────────────
    requisitosModal: RequisitosModal = this.requisitosModalVacio();
    transferirModal: TransferirModal = this.transferirModalVacio();

    /**
     * Campos del documento de Firestore que NO son requisitos de titulación.
     * Ajusta esta lista si tu colección tiene más campos informativos.
     */
    private readonly CAMPOS_NO_REQUISITO = new Set([
        'Celular', 'CodigoCarrera', 'CorreoInstitucional', 'CorreoPersonal',
        'HorarioComplexivo', 'Nombres', 'Apellidos', 'NombreCompleto',
        'Carrera', 'Semestre', 'FechaIngreso', 'FechaNacimiento',
        'Direccion', 'Telefono', 'Email', 'Grupo', 'telegramUser',
        'telegramChatId', 'notificacionesActivas', 'asistencia',
        'fechaVinculacion', 'ingresadoManual', 'cedula', 'id'
    ]);

    // ── Computed: personas vinculadas ───────────────────────────────────────
    get personasVinculadas(): any[] {
        const estudiantes = Object.values((this.cronograma as any)?.estudiantesVinculados ?? {})
            .map((e: any) => ({ ...e, tipo: 'estudiante' }));
        const docentes = Object.values((this.cronograma as any)?.docentesVinculados ?? {})
            .map((d: any) => ({ ...d, tipo: 'docente' }));
        return [...docentes, ...estudiantes];
    }

    get carrerasVinculadosDisponibles(): string[] {
        const valores = this.personasVinculadas
            .map(p => (p.tipo === 'docente' ? p.cargo : p.carrera) ?? '')
            .filter((c: string) => c.trim() !== '');
        return [...new Set(valores)].sort((a, b) => a.localeCompare(b, 'es'));
    }

    estadoNotifVinculado(p: any): EstadoNotif {
        if (p.notificacionesActivas && p.telegramChatId) return 'activa';
        if (p.telegramUser || p.telegramChatId) return 'pendiente';
        return 'sin-telegram';
    }

get vinculadosFiltrados(): any[] {
    const q = this.busquedaVinculados.toLowerCase().trim();
    const duplicados = this.chatIdsDuplicados;
    return this.personasVinculadas.filter(p => {
        const coincideTipo =
            this.filtroTipoVinculado === 'TODOS' ||
            (this.filtroTipoVinculado === 'ESTUDIANTES' && p.tipo === 'estudiante') ||
            (this.filtroTipoVinculado === 'DOCENTES' && p.tipo === 'docente');
        const coincideTexto = !q ||
            p.cedula?.toLowerCase().includes(q) ||
            p.nombres?.toLowerCase().includes(q);
        const estadoNotif = this.estadoNotifVinculado(p);
        const coincideNotif =
            this.filtroNotifVinculados === 'TODOS' ||
            (this.filtroNotifVinculados === 'ACTIVAS' && estadoNotif === 'activa') ||
            (this.filtroNotifVinculados === 'PENDIENTES' && estadoNotif === 'pendiente') ||
            (this.filtroNotifVinculados === 'SIN_TELEGRAM' && estadoNotif === 'sin-telegram') ||
            (this.filtroNotifVinculados === 'DUPLICADOS' && !!p.telegramChatId && duplicados.has(String(p.telegramChatId)));
        const carreraOcargo = (p.tipo === 'docente' ? p.cargo : p.carrera) ?? '';
        const coincideCarrera =
            !this.filtroCarreraVinculadosSeleccionada ||
            carreraOcargo === this.filtroCarreraVinculadosSeleccionada;
        return coincideTipo && coincideTexto && coincideNotif && coincideCarrera;
    });
}

    contarVinculados(tipo: 'estudiante' | 'docente'): number {
        return this.personasVinculadas.filter(p => p.tipo === tipo).length;
    }

    // ── NUEVO: contador de Chat ID (Telegram) ───────────────────────────────
    /**
     * Cuenta cuántas personas vinculadas (estudiantes + docentes) ya tienen
     * telegramChatId guardado. Si prefieres contar solo estudiantes, cambia
     * el filtro a: p.tipo === 'estudiante' && !!p.telegramChatId
     */
    get totalConChatId(): number {
        return this.personasVinculadas.filter((p: any) => !!p.telegramChatId).length;
    }

    /** Cuenta cuántas personas vinculadas todavía NO tienen telegramChatId */
    get totalSinChatId(): number {
        return this.personasVinculadas.length - this.totalConChatId;
    }

    /** Chat IDs que aparecen en más de una persona vinculada */
get chatIdsDuplicados(): Set<string> {
    const conteo = new Map<string, number>();
    this.personasVinculadas.forEach((p: any) => {
        if (p.telegramChatId) {
            const id = String(p.telegramChatId);
            conteo.set(id, (conteo.get(id) ?? 0) + 1);
        }
    });
    const duplicados = new Set<string>();
    conteo.forEach((cant, id) => { if (cant > 1) duplicados.add(id); });
    return duplicados;
}

/** Cuántas personas vinculadas tienen un Chat ID que está duplicado */
get totalConChatIdDuplicado(): number {
    const duplicados = this.chatIdsDuplicados;
    return this.personasVinculadas.filter(
        (p: any) => p.telegramChatId && duplicados.has(String(p.telegramChatId))
    ).length;
}

    // ── NUEVO: contador de Sede ──────────────────────────────────────────────
    /** Cuenta cuántos estudiantes vinculados YA tienen sede guardada */
    get totalConSede(): number {
        return this.personasVinculadas.filter(
            (p: any) => p.tipo === 'estudiante' && !!(p.sede && p.sede.trim())
        ).length;
    }

    /** Cuenta cuántos estudiantes vinculados NO tienen sede todavía */
    get totalSinSede(): number {
        return this.personasVinculadas.filter(
            (p: any) => p.tipo === 'estudiante' && !(p.sede && p.sede.trim())
        ).length;
    }

    // ══════════════════════════════════════════════════════════════════════
    // NUEVO: Estadísticas para la pestaña "Estadísticas"
    // ══════════════════════════════════════════════════════════════════════

    /** Solo los estudiantes vinculados (los docentes no aplican para estas métricas) */
    get estudiantesVinculadosLista(): any[] {
        return this.personasVinculadas.filter(p => p.tipo === 'estudiante');
    }

    /** KPIs generales del cronograma actual */
    get statsGenerales() {
        const lista = this.estudiantesVinculadosLista;
        const total = lista.length;
        const activas = lista.filter(p => this.estadoNotifVinculado(p) === 'activa').length;
        const pendientes = lista.filter(p => this.estadoNotifVinculado(p) === 'pendiente').length;
        const sinTelegram = lista.filter(p => this.estadoNotifVinculado(p) === 'sin-telegram').length;
        const sinActivar = pendientes + sinTelegram;
        const presentes = lista.filter(p => p.asistencia).length;

        return {
            total,
            activas,
            pendientes,
            sinTelegram,
            sinActivar,
            presentes,
            ausentes: total - presentes,
            pctActivas: total ? Math.round((activas / total) * 100) : 0,
            pctSinActivar: total ? Math.round((sinActivar / total) * 100) : 0,
            pctAsistencia: total ? Math.round((presentes / total) * 100) : 0
        };
    }

    /**
     * Agrupa a los estudiantes vinculados por un campo dado ("sede" o "carrera")
     * y cuenta, dentro de cada grupo: notificaciones activas, pendientes, sin
     * Telegram, y asistencia (presentes/ausentes). Los que no tienen ese dato
     * registrado se agrupan bajo "Sin sede" / "Sin carrera".
     * Ordenado de mayor a menor cantidad de estudiantes.
     */
    private agruparEstudiantesPor(campo: 'sede' | 'carrera'): {
        etiqueta: string; total: number;
        activas: number; pendientes: number; sinTelegram: number; sinActivar: number;
        presentes: number; ausentes: number;
    }[] {
        const lista = this.estudiantesVinculadosLista;
        const etiquetaVacia = campo === 'sede' ? 'Sin sede' : 'Sin carrera';

        const mapa = new Map<string, {
            activas: number; pendientes: number; sinTelegram: number; presentes: number; total: number;
        }>();

        for (const p of lista) {
            const valorCrudo = (p as any)[campo];
            const clave = (valorCrudo && String(valorCrudo).trim()) ? String(valorCrudo).trim() : etiquetaVacia;

            if (!mapa.has(clave)) {
                mapa.set(clave, { activas: 0, pendientes: 0, sinTelegram: 0, presentes: 0, total: 0 });
            }

            const entry = mapa.get(clave)!;
            const estado = this.estadoNotifVinculado(p);
            if (estado === 'activa') entry.activas++;
            else if (estado === 'pendiente') entry.pendientes++;
            else entry.sinTelegram++;

            if (p.asistencia) entry.presentes++;
            entry.total++;
        }

        return [...mapa.entries()]
            .map(([etiqueta, v]) => ({
                etiqueta,
                activas: v.activas,
                pendientes: v.pendientes,
                sinTelegram: v.sinTelegram,
                sinActivar: v.pendientes + v.sinTelegram,
                presentes: v.presentes,
                ausentes: v.total - v.presentes,
                total: v.total
            }))
            .sort((a, b) => b.total - a.total);
    }

    /** Desglose por sede (notificaciones + asistencia) */
    get statsPorSede() {
        return this.agruparEstudiantesPor('sede').map(s => ({ sede: s.etiqueta, ...s }));
    }

    /** Desglose por carrera (notificaciones + asistencia) */
    get statsPorCarrera() {
        return this.agruparEstudiantesPor('carrera').map(s => ({ carrera: s.etiqueta, ...s }));
    }

    constructor(
        private estudiantesService: EstudiantesService,
        private cronogramaService: CronogramaService,
        private docentesService: DocentesService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['visible']?.currentValue === true) {
            this.resetear();
            this.cargarGrupos();
        }
        if (changes['visible']?.currentValue === false) {
            this.destruirGraficas();
        }
    }

    ngOnDestroy(): void {
        this.destruirGraficas();
    }

    // ── Vaciadores ──────────────────────────────────────────────────────────
    private manualVacio(): ManualDatos {
        return { cedula: '', nombres: '', carrera: '', sede: '', telegramUser: '', grupo: '', asistencia: false };
    }

    private docenteFormVacio(): DocenteForm {
        return { cedula: '', nombres: '', cargo: '', departamento: '' };
    }

    private requisitosModalVacio(): RequisitosModal {
        return {
            visible: false, cargando: false, error: '',
            cedula: '', nombres: '', items: [],
            totalCumple: 0, totalNoCumple: 0
        };
    }
    private transferirModalVacio(): TransferirModal {
    return {
        visible: false, cargando: false, guardando: false, error: '',
        persona: null, cronogramas: [], cronogramaDestinoId: '',
        eliminarDeOrigen: true
    };
}

    private resetear(): void {
        this.destruirGraficas();
        this.vista = 'grupos';
        this.grupos = [];
        this.grupoSeleccionado = null;
        this.estudiantes = [];
        this.estudiantesFiltrados = [];
        this.seleccionados.clear();
        this.busqueda = '';
        this.filtroAsistencia = 'TODOS';
        this.filtroNotif = 'TODOS';
        this.tipoPersona = 'estudiante';
        this.manualDatos = this.manualVacio();
        this.docenteForm = this.docenteFormVacio();
        this.manualError = '';
        this.cargando = false;
        this.guardando = false;
        this.busquedaVinculados = '';
        this.filtroTipoVinculado = 'TODOS';
        this.filtroNotifVinculados = 'TODOS';
        this.filtroCarreraVinculadosSeleccionada = '';
        this.exportando = false;
        this.migrandoTelegram = false;
        this.actualizandoSede = false;
        this.origenVinculados = 'grupos';
        this.origenEstadisticas = 'grupos';
        this.vistaDocente = 'lista';
        this.docentes = [];
        this.docentesFiltrados = [];
        this.busquedaDocentes = '';
        this.docenteSeleccionado = null;
        this.carrerasDisponibles = [];
        this.filtroCarreras = new Set<string>();
        this.ordenarPorCarrera = false;
        this.requisitosModal = this.requisitosModalVacio();
        this.transferirModal = this.transferirModalVacio();
    }

    // ── Notificaciones ──────────────────────────────────────────────────────
    estadoNotif(e: Estudiante): EstadoNotif {
        const vinculados = (this.cronograma as any)?.estudiantesVinculados ?? {};
        const vinc = e.cedula ? vinculados[e.cedula] : null;

        const chatId = vinc?.telegramChatId ?? (e as any).telegramChatId;
        const notifActiva = vinc?.notificacionesActivas ?? (e as any).notificacionesActivas;
        const tgUser = vinc?.telegramUser ?? e.telegramUser;

        if (chatId && notifActiva) return 'activa';
        if (tgUser) return 'pendiente';
        return 'sin-telegram';
    }

    setFiltroNotif(f: 'TODOS' | 'ACTIVAS' | 'PENDIENTES'): void {
        this.filtroNotif = f;
        this.filtrar();
    }

    // ══════════════════════════════════════════════════════════════════════
    // NUEVO: Lógica del mini-modal de requisitos
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Abre el mini-modal y consulta Firestore (proyecto utet-4387a) por la
     * cédula del estudiante. Lee todos los campos del documento y filtra
     * solo los que tienen valor "CUMPLE" o "NO CUMPLE", ignorando campos
     * informativos. Sirve tanto para Estudiante (paso 2) como para una
     * persona ya vinculada (vista Vinculados).
     */
async abrirRequisitos(e: { cedula?: string; nombres?: string }): Promise<void> {
    this.requisitosModal = {
        ...this.requisitosModalVacio(),
        visible: true,
        cargando: true,
        cedula: e.cedula ?? '',
        nombres: e.nombres ?? ''
    };
    this.cdr.detectChanges();

    try {
        const { collection, query, where, getDocs, orderBy, limit } = await import('firebase/firestore');
        const { getUtetFirestore } = await import('../../firebase/utet-firestore');
        const db = getUtetFirestore();

        // Busca por el campo "cedula" (ya no es el ID del documento).
        // Ignora el prefijo de período: toma el registro más reciente
        // (por updatedAt) que no esté marcado como eliminado.
        const buscarPorCedula = async (cedula: string) => {
            const q = query(
                collection(db, 'requisitos'),
                where('cedula', '==', cedula),
                where('eliminado', '==', false),
                orderBy('updatedAt', 'desc'),
                limit(1)
            );
            const res = await getDocs(q);
            return res.empty ? null : res.docs[0];
        };

        // Intento 1: cédula tal como viene
        let docSnap = await buscarPorCedula(e.cedula!);

        // Intento 2: si empieza con '0', probar sin el cero inicial
        if (!docSnap && e.cedula!.startsWith('0')) {
            const cedulaSin0 = e.cedula!.slice(1);
            docSnap = await buscarPorCedula(cedulaSin0);
        }

        if (!docSnap) {
            this.requisitosModal = {
                ...this.requisitosModal,
                cargando: false,
                error: 'No se encontró el registro de este estudiante en la base de datos.'
            };
            this.cdr.detectChanges();
            return;
        }

        const data = docSnap.data() as Record<string, any>;
        const valores = (data['valores'] ?? {}) as Record<string, any>;

        // Deduplicar claves que difieren solo por tildes
        // (ej. "ActualizacionDatos" vs "ActualizaciónDatos"),
        // prefiriendo la variante con tilde.
        const sinTildes = (s: string) =>
            s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        const porClaveNormalizada = new Map<string, { nombre: string; estado: string }>();
        for (const [key, value] of Object.entries(valores)) {
            if (value !== 'CUMPLE' && value !== 'NO CUMPLE') continue;
            const clave = sinTildes(key).toLowerCase();
            const existente = porClaveNormalizada.get(clave);
            const tieneTilde = sinTildes(key) !== key;
            if (!existente || tieneTilde) {
                porClaveNormalizada.set(clave, { nombre: key, estado: value as string });
            }
        }
        const items = [...porClaveNormalizada.values()];

        // Ordenar: primero NO CUMPLE (pendientes), luego CUMPLE, alfabético dentro de cada grupo
        items.sort((a, b) => {
            if (a.estado !== b.estado) return a.estado === 'NO CUMPLE' ? -1 : 1;
            return a.nombre.localeCompare(b.nombre, 'es');
        });

        this.requisitosModal = {
            ...this.requisitosModal,
            cargando: false,
            items,
            totalCumple: items.filter(i => i.estado === 'CUMPLE').length,
            totalNoCumple: items.filter(i => i.estado === 'NO CUMPLE').length
        };

    } catch (err) {
        console.error('Error al cargar requisitos:', err);
        this.requisitosModal = {
            ...this.requisitosModal,
            cargando: false,
            error: 'Error al consultar la base de datos. Intenta de nuevo.'
        };
    }

    this.cdr.detectChanges();
}

    /** Cierra el mini-modal de requisitos */
    cerrarRequisitos(): void {
        this.requisitosModal = this.requisitosModalVacio();
        this.cdr.detectChanges();
    }

    // ══════════════════════════════════════════════════════════════════════
// NUEVO: Transferir estudiante a otro cronograma
// ══════════════════════════════════════════════════════════════════════

/** Abre el mini-modal y carga la lista de cronogramas disponibles como destino */
async abrirTransferir(persona: any): Promise<void> {
    if (persona.tipo !== 'estudiante') return;

    this.transferirModal = {
        ...this.transferirModalVacio(),
        visible: true,
        cargando: true,
        persona
    };
    this.cdr.detectChanges();

    try {
        // ⚠️ Ajusta este método si tu CronogramaService usa otro nombre
        const todos = await this.cronogramaService.obtenerCronogramas();
        this.transferirModal.cronogramas = todos.filter(c => c.id !== this.cronograma?.id);
    } catch (error) {
        console.error('Error al cargar cronogramas:', error);
        this.transferirModal.error = 'No se pudieron cargar los cronogramas disponibles.';
    } finally {
        this.transferirModal.cargando = false;
        this.cdr.detectChanges();
    }
}

/** Cierra el mini-modal de transferencia */
cerrarTransferir(): void {
    this.transferirModal = this.transferirModalVacio();
    this.cdr.detectChanges();
}

/** Copia (y opcionalmente mueve) al estudiante hacia el cronograma destino */
async confirmarTransferir(): Promise<void> {
    const { persona, cronogramaDestinoId, cronogramas, eliminarDeOrigen } = this.transferirModal;
    if (!persona || !cronogramaDestinoId || !this.cronograma?.id) return;

    const destino = cronogramas.find(c => c.id === cronogramaDestinoId);
    if (!destino?.id) {
        this.transferirModal.error = 'Cronograma destino no válido.';
        return;
    }

    this.transferirModal.guardando = true;
    this.cdr.detectChanges();

    try {
        const cedula = persona.cedula;
        // Quitamos el campo "tipo" que agrega el getter personasVinculadas,
        // no debe guardarse como parte del registro del estudiante.
        const { tipo, ...datosEstudiante } = persona;

        // 1) Escribir en el cronograma destino
        const mapaDestino = { ...((destino as any).estudiantesVinculados ?? {}) };
        mapaDestino[cedula] = {
            ...datosEstudiante,
            fechaVinculacion: new Date().toISOString()
        };
        await this.cronogramaService.actualizarCronograma(
            destino.id!,
            { estudiantesVinculados: mapaDestino } as any
        );

        // 2) Si corresponde, eliminar del cronograma actual (mover en vez de copiar)
        if (eliminarDeOrigen) {
            const mapaOrigen = { ...((this.cronograma as any).estudiantesVinculados ?? {}) };
            delete mapaOrigen[cedula];
            await this.cronogramaService.actualizarCronograma(
                this.cronograma.id!,
                { estudiantesVinculados: mapaOrigen } as any
            );
            (this.cronograma as any).estudiantesVinculados = mapaOrigen;
        }

        this.cerrarTransferir();
        alert(
            eliminarDeOrigen
                ? `Estudiante movido a "${destino.nombre}" correctamente.`
                : `Estudiante copiado a "${destino.nombre}" correctamente.`
        );
    } catch (error) {
        console.error('Error al transferir estudiante:', error);
        this.transferirModal.error = 'Ocurrió un error al transferir. Intenta de nuevo.';
    } finally {
        this.transferirModal.guardando = false;
        this.cdr.detectChanges();
    }
}

    // ── Vinculados ──────────────────────────────────────────────────────────
    irAVinculados(): void {
        this.origenVinculados = this.vista === 'estudiantes' ? 'estudiantes' : 'grupos';
        this.busquedaVinculados = '';
        this.filtroTipoVinculado = 'TODOS';
        this.filtroNotifVinculados = 'TODOS';
        this.filtroCarreraVinculadosSeleccionada = '';
        this.vista = 'vinculados';
        this.cdr.detectChanges();
    }

    volverDesdeVinculados(): void {
        this.vista = this.origenVinculados;
        this.cdr.detectChanges();
    }

    setFiltroTipoVinculado(f: 'TODOS' | 'ESTUDIANTES' | 'DOCENTES'): void {
        this.filtroTipoVinculado = f;
        this.cdr.detectChanges();
    }

setFiltroNotifVinculados(f: 'TODOS' | 'ACTIVAS' | 'PENDIENTES' | 'SIN_TELEGRAM' | 'DUPLICADOS'): void {
    this.filtroNotifVinculados = f;
    this.cdr.detectChanges();
}

    setFiltroCarreraVinculados(valor: string): void {
        this.filtroCarreraVinculadosSeleccionada = valor;
        this.cdr.detectChanges();
    }

    limpiarFiltrosVinculados(): void {
        this.busquedaVinculados = '';
        this.filtroTipoVinculado = 'TODOS';
        this.filtroNotifVinculados = 'TODOS';
        this.filtroCarreraVinculadosSeleccionada = '';
        this.cdr.detectChanges();
    }

    get hayFiltrosVinculadosActivos(): boolean {
        return this.filtroTipoVinculado !== 'TODOS' ||
            this.filtroNotifVinculados !== 'TODOS' ||
            this.filtroCarreraVinculadosSeleccionada !== '' ||
            this.busquedaVinculados.trim() !== '';
    }

    // ══════════════════════════════════════════════════════════════════════
    // NUEVO: Pestaña de estadísticas (gráficas con Chart.js)
    // ══════════════════════════════════════════════════════════════════════

    irAEstadisticas(): void {
        this.origenEstadisticas =
            this.vista === 'estudiantes' ? 'estudiantes' :
            this.vista === 'vinculados'  ? 'vinculados'  : 'grupos';

        this.vista = 'estadisticas';
        this.cdr.detectChanges();

        // Esperamos DOS frames de pintado (no solo un setTimeout(0)) para
        // asegurar que Angular ya insertó los <canvas> en el DOM con su
        // tamaño final antes de que Chart.js los mida. Esto es lo que
        // causaba el bug de la dona mostrando solo un color: Chart.js
        // media un canvas de 0px o aún no visible en el primer intento.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => this.renderizarGraficas());
        });
    }

    volverDesdeEstadisticas(): void {
        this.destruirGraficas();
        this.vista = this.origenEstadisticas;
        this.cdr.detectChanges();
    }

    /**
     * Además de destruir nuestras propias instancias, le preguntamos a
     * Chart.js directamente si ese <canvas> ya tiene un chart "huérfano"
     * registrado (por ejemplo si Angular reutilizó el nodo del DOM antes
     * de que nuestra referencia se actualizara) y lo destruimos también.
     * Esto evita el bug donde una serie queda "pegada" con datos viejos.
     */
    private limpiarChartDeCanvas(ref?: ElementRef<HTMLCanvasElement>): void {
        if (!ref) return;
        Chart.getChart(ref.nativeElement)?.destroy();
    }

    private renderizarGraficas(): void {
        this.destruirGraficas();
        [
            this.canvasNotifDonutRef, this.canvasSedeStackRef, this.canvasSedeSinActivarRef,
            this.canvasCarreraStackRef, this.canvasCarreraSinActivarRef
        ].forEach(ref => this.limpiarChartDeCanvas(ref));

        const stats = this.statsGenerales;
        if (stats.total === 0) return;

        const porSede = this.statsPorSede;
        const porCarrera = this.statsPorCarrera;

        const colorActiva      = '#22c55e';
        const colorPendiente   = '#f59e0b';
        const colorSinTelegram = '#6b7280';
        const colorSinActivar  = '#ef4444';
        const colorTexto       = '#cbd5e1';
        const colorGrilla      = 'rgba(255,255,255,0.06)';

        if (this.canvasNotifDonutRef) {
            this.chartNotifDonut = new Chart(this.canvasNotifDonutRef.nativeElement, {
                type: 'doughnut',
                data: {
                    labels: ['Activas', 'Pendientes', 'Sin Telegram'],
                    datasets: [{
                        data: [stats.activas, stats.pendientes, stats.sinTelegram],
                        backgroundColor: [colorActiva, colorPendiente, colorSinTelegram],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: colorTexto } }
                    }
                }
            });
        }

        if (this.canvasSedeStackRef) {
            this.chartSedeStack = this.crearBarraApilada(
                this.canvasSedeStackRef.nativeElement,
                porSede.map(s => s.sede),
                porSede.map(s => s.activas), porSede.map(s => s.pendientes), porSede.map(s => s.sinTelegram),
                colorActiva, colorPendiente, colorSinTelegram, colorTexto, colorGrilla
            );
        }

        if (this.canvasSedeSinActivarRef) {
            const ordenado = [...porSede].sort((a, b) => b.sinActivar - a.sinActivar);
            this.chartSedeSinActivar = this.crearBarraRanking(
                this.canvasSedeSinActivarRef.nativeElement,
                ordenado.map(s => s.sede), ordenado.map(s => s.sinActivar),
                colorSinActivar, colorTexto, colorGrilla
            );
        }

        if (this.canvasCarreraStackRef) {
            this.chartCarreraStack = this.crearBarraApilada(
                this.canvasCarreraStackRef.nativeElement,
                porCarrera.map(c => c.carrera),
                porCarrera.map(c => c.activas), porCarrera.map(c => c.pendientes), porCarrera.map(c => c.sinTelegram),
                colorActiva, colorPendiente, colorSinTelegram, colorTexto, colorGrilla
            );
        }

        if (this.canvasCarreraSinActivarRef) {
            const ordenado = [...porCarrera].sort((a, b) => b.sinActivar - a.sinActivar);
            this.chartCarreraSinActivar = this.crearBarraRanking(
                this.canvasCarreraSinActivarRef.nativeElement,
                ordenado.map(c => c.carrera), ordenado.map(c => c.sinActivar),
                colorSinActivar, colorTexto, colorGrilla
            );
        }
    }

    /** Barra apilada reutilizable (Activas / Pendientes / Sin Telegram) por categoría */
    private crearBarraApilada(
        canvasEl: HTMLCanvasElement,
        etiquetas: string[],
        activas: number[], pendientes: number[], sinTelegram: number[],
        colorActiva: string, colorPendiente: string, colorSinTelegram: string,
        colorTexto: string, colorGrilla: string
    ): Chart {
        return new Chart(canvasEl, {
            type: 'bar',
            data: {
                labels: etiquetas,
                datasets: [
                    { label: 'Activas',      data: activas,     backgroundColor: colorActiva },
                    { label: 'Pendientes',   data: pendientes,  backgroundColor: colorPendiente },
                    { label: 'Sin Telegram', data: sinTelegram, backgroundColor: colorSinTelegram }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, ticks: { color: colorTexto }, grid: { color: colorGrilla } },
                    y: { stacked: true, beginAtZero: true, ticks: { color: colorTexto, precision: 0 }, grid: { color: colorGrilla } }
                },
                plugins: {
                    legend: { position: 'bottom', labels: { color: colorTexto } }
                }
            }
        });
    }

    /** Barra horizontal de ranking reutilizable (ej. "sin activar" de mayor a menor) */
    private crearBarraRanking(
        canvasEl: HTMLCanvasElement,
        etiquetas: string[], valores: number[],
        color: string, colorTexto: string, colorGrilla: string
    ): Chart {
        return new Chart(canvasEl, {
            type: 'bar',
            data: {
                labels: etiquetas,
                datasets: [{
                    label: 'Sin activar notificaciones',
                    data: valores,
                    backgroundColor: color
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { beginAtZero: true, ticks: { color: colorTexto, precision: 0 }, grid: { color: colorGrilla } },
                    y: { ticks: { color: colorTexto }, grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    private destruirGraficas(): void {
        this.chartNotifDonut?.destroy();
        this.chartSedeStack?.destroy();
        this.chartSedeSinActivar?.destroy();
        this.chartCarreraStack?.destroy();
        this.chartCarreraSinActivar?.destroy();
        this.chartNotifDonut = undefined;
        this.chartSedeStack = undefined;
        this.chartSedeSinActivar = undefined;
        this.chartCarreraStack = undefined;
        this.chartCarreraSinActivar = undefined;
    }

    async desvincular(persona: any): Promise<void> {
        if (!this.cronograma?.id) return;
        const tipoTexto = persona.tipo === 'docente' ? 'docente' : 'estudiante';
        if (!confirm(`¿Desvincular a ${persona.nombres} (${tipoTexto})?`)) return;

        try {
            if (persona.tipo === 'docente') {
                await this.docentesService.desvincularDeCronograma(
                    persona.cedula,
                    this.cronograma.id!,
                    (id, datos) => this.cronogramaService.actualizarCronograma(id, datos)
                );
                const actuales = { ...((this.cronograma as any)?.docentesVinculados ?? {}) };
                delete actuales[persona.cedula];
                (this.cronograma as any).docentesVinculados = actuales;
            } else {
                const actuales = { ...((this.cronograma as any)?.estudiantesVinculados ?? {}) };
                delete actuales[persona.cedula];
                await this.cronogramaService.actualizarCronograma(
                    this.cronograma.id!,
                    { estudiantesVinculados: actuales } as any
                );
                (this.cronograma as any).estudiantesVinculados = actuales;
            }
            this.cdr.detectChanges();
        } catch (error) {
            console.error('Error al desvincular:', error);
            alert('Error al desvincular');
        }
    }

    // ── Exportar a Excel ────────────────────────────────────────────────────
    async exportarExcel(): Promise<void> {
        const datos = this.personasVinculadas.filter(p => p.tipo === 'estudiante');

        if (datos.length === 0) {
            alert('No hay estudiantes vinculados para exportar.');
            return;
        }

        this.exportando = true;
        this.cdr.detectChanges();

        try {
            const XLSX = await this.cargarSheetJS();

            const filas = datos.map(p => ({
                'Cédula': p.cedula ?? '',
                'Nombre': p.nombres ?? '',
                'Carrera': p.carrera ?? '',
                'Sede': p.sede ?? '',
                'Telegram': p.telegramUser ? '@' + p.telegramUser : '',
                'Notificaciones': this.etiquetaNotif(this.estadoNotifVinculado(p)),
                'Asistencia': p.asistencia ? 'Presente' : 'Ausente',
                'Fecha de vinculación': this.formatearFecha(p.fechaVinculacion)
            }));

            const hoja = XLSX.utils.json_to_sheet(filas);

            hoja['!cols'] = [
                { wch: 14 }, { wch: 28 }, { wch: 26 }, { wch: 20 },
                { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 18 }
            ];

            const libro = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(libro, hoja, 'Estudiantes');

            const nombreCrono = (this.cronograma as any)?.nombre ?? 'cronograma';
            const fecha = new Date().toISOString().slice(0, 10);
            const nombreArchivo = `estudiantes_${this.slug(nombreCrono)}_${fecha}.xlsx`;

            XLSX.writeFile(libro, nombreArchivo);
        } catch (error) {
            console.error('Error al exportar Excel:', error);
            alert('Ocurrió un error al generar el Excel. Intenta de nuevo.');
        } finally {
            this.exportando = false;
            this.cdr.detectChanges();
        }
    }

    private etiquetaNotif(estado: EstadoNotif): string {
        if (estado === 'activa') return 'Activa';
        if (estado === 'pendiente') return 'Pendiente';
        return 'Sin Telegram';
    }

    private formatearFecha(iso: string | undefined): string {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }

    private slug(texto: string): string {
        return texto
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }

    private cargarSheetJS(): Promise<any> {
        if ((window as any).XLSX) return Promise.resolve((window as any).XLSX);
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = () => resolve((window as any).XLSX);
            script.onerror = () => reject(new Error('No se pudo cargar la librería de exportación.'));
            document.head.appendChild(script);
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // NUEVO: Migrar telegramChatId desde Realtime Database hacia Firestore
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Recorre los estudiantes vinculados a este cronograma (RTDB) y, para
     * cada uno que tenga telegramChatId, lo copia hacia el documento
     * correspondiente en Firestore (proyecto utet-4387a, colección
     * "Estudiantes"), usando merge para no pisar los demás campos.
     * Si el documento no existe en Firestore para esa cédula, no lo crea
     * (se cuenta como "sin documento") para evitar registros huérfanos.
     */
    async migrarTelegramChatIds(): Promise<void> {
        const estudiantesConTelegram = this.personasVinculadas.filter(
            (p: any) => p.tipo === 'estudiante' && p.telegramChatId && p.cedula
        );

        console.log('[Migración] Estudiantes con telegramChatId encontrados:', estudiantesConTelegram.length);
        console.table(estudiantesConTelegram.map((p: any) => ({ cedula: p.cedula, nombres: p.nombres, telegramChatId: p.telegramChatId, telegramUser: p.telegramUser })));

        if (estudiantesConTelegram.length === 0) {
            alert('No hay estudiantes vinculados con telegramChatId para migrar.');
            return;
        }

        const confirmado = confirm(
            `Se copiará el campo telegramChatId de ${estudiantesConTelegram.length} ` +
            `estudiante(s) desde Realtime Database hacia Firestore (colección Estudiantes). ` +
            `¿Continuar?`
        );
        if (!confirmado) {
            console.warn('[Migración] Cancelada por el usuario en el confirm().');
            return;
        }

        this.migrandoTelegram = true;
        this.cdr.detectChanges();

        let exito = 0;
        let fallidos = 0;
        let sinDocFirestore = 0;

        try {
            const { doc, getDoc, setDoc } = await import('firebase/firestore');
            const { getUtetFirestore } = await import('../../firebase/utet-firestore');
            const db = getUtetFirestore();

            for (const p of estudiantesConTelegram) {
                console.group(`[Migración] Cédula ${p.cedula} (${p.nombres})`);
                try {
                    // Intento 1: cédula tal como viene
                    let ref = doc(db, 'Estudiantes', p.cedula);
                    let snap = await getDoc(ref);

                    console.log('¿Existe documento en Firestore?', snap.exists());

                    // Intento 2: si empieza con '0', probar sin el cero inicial
                    if (!snap.exists() && p.cedula.startsWith('0')) {
                        const cedulaSin0 = p.cedula.slice(1);
                        ref = doc(db, 'Estudiantes', cedulaSin0);
                        snap = await getDoc(ref);
                        console.log('Reintentando sin cero inicial, cédula:', cedulaSin0, '¿Existe?', snap.exists());
                    }

                    if (!snap.exists()) {
                        console.warn('No se encontró el documento con ese ID exacto. Revisa el formato de la cédula.');
                        sinDocFirestore++;
                        console.groupEnd();
                        continue;
                    }

                    console.log('telegramChatId a escribir:', p.telegramChatId);
                    console.log('telegramUser a escribir:', p.telegramUser);
                    await setDoc(ref,
                        { telegramChatId: p.telegramChatId, telegramUser: p.telegramUser },
                        { merge: true });

                    console.log('✔ Escritura exitosa.');
                    exito++;

                } catch (err) {
                    console.error('✘ Error al migrar esta cédula:', err);
                    fallidos++;
                }
                console.groupEnd();
            }

            console.log(`[Migración] Resumen final → Éxito: ${exito} | Sin documento: ${sinDocFirestore} | Errores: ${fallidos}`);

            alert(
                `Migración completada.\n` +
                `✔ Actualizados en Firestore: ${exito}\n` +
                `– Sin documento en Firestore: ${sinDocFirestore}\n` +
                `✘ Errores: ${fallidos}`
            );
        } catch (error) {
            console.error('Error general en migración de telegramChatId:', error);
            alert('Ocurrió un error al migrar. Revisa la consola.');
        } finally {
            this.migrandoTelegram = false;
            this.cdr.detectChanges();
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // NUEVO: Actualizar sede de los estudiantes vinculados
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Recorre los estudiantes ya vinculados a este cronograma que NO tienen
     * "sede" guardada (o la tienen vacía), busca su cédula entre TODOS los
     * grupos de inducción (misma base de datos que usa "grupos") y, si la
     * encuentra, actualiza únicamente el campo "sede" en Firebase.
     *
     * No sobrescribe ningún otro campo del estudiante ya vinculado, y no
     * toca a los que ya tienen sede o no aparecen en ningún grupo.
     */
    async actualizarSedeVinculados(): Promise<void> {
        if (!this.cronograma?.id) return;

        const estudiantesSinSede = this.personasVinculadas.filter(
            (p: any) => p.tipo === 'estudiante' && p.cedula && !(p.sede && String(p.sede).trim())
        );

        if (estudiantesSinSede.length === 0) {
            alert('Todos los estudiantes vinculados ya tienen sede registrada.');
            return;
        }

        const confirmado = confirm(
            `Se buscará la sede de ${estudiantesSinSede.length} estudiante(s) sin sede ` +
            `en los grupos de inducción y se actualizará solo ese campo. ¿Continuar?`
        );
        if (!confirmado) return;

        this.actualizandoSede = true;
        this.cdr.detectChanges();

        let actualizados = 0;
        let sinCoincidencia = 0;

        try {
            const mapaEstudiantes = await this.estudiantesService.obtenerTodosLosEstudiantes();

            const vinculadosActuales = { ...((this.cronograma as any).estudiantesVinculados ?? {}) };

            for (const p of estudiantesSinSede) {
                const encontrado = mapaEstudiantes.get(p.cedula);
                const sedeEncontrada = encontrado?.sede?.trim();

                if (!sedeEncontrada) {
                    sinCoincidencia++;
                    continue;
                }

                vinculadosActuales[p.cedula] = {
                    ...vinculadosActuales[p.cedula],
                    sede: sedeEncontrada
                };
                actualizados++;
            }

            if (actualizados > 0) {
                await this.cronogramaService.actualizarCronograma(
                    this.cronograma.id!,
                    { estudiantesVinculados: vinculadosActuales } as any
                );
                (this.cronograma as any).estudiantesVinculados = vinculadosActuales;
            }

            alert(
                `Actualización de sede completada.\n` +
                `✔ Actualizados: ${actualizados}\n` +
                `– Sin coincidencia en ningún grupo: ${sinCoincidencia}`
            );
        } catch (error) {
            console.error('Error al actualizar sede:', error);
            alert('Ocurrió un error al actualizar la sede. Revisa la consola.');
        } finally {
            this.actualizandoSede = false;
            this.cdr.detectChanges();
        }
    }

    // ── Manual: navegación ──────────────────────────────────────────────────
    irAManual(): void {
        this.origenManual = this.vista === 'estudiantes' ? 'estudiantes' : 'grupos';
        this.manualDatos = this.manualVacio();
        this.docenteForm = this.docenteFormVacio();
        this.manualError = '';
        this.tipoPersona = 'estudiante';
        this.vistaDocente = 'lista';
        this.docenteSeleccionado = null;
        if (this.grupoSeleccionado) {
            this.manualDatos.grupo = this.grupoSeleccionado.nombres;
        }
        this.vista = 'manual';
        this.cdr.detectChanges();
    }

    volverDesdeManual(): void {
        this.manualError = '';
        this.manualDatos = this.manualVacio();
        this.docenteForm = this.docenteFormVacio();
        this.docenteSeleccionado = null;
        this.vista = this.origenManual;
        this.cdr.detectChanges();
    }

    // ── Toggle tipo persona ─────────────────────────────────────────────────
    setTipo(tipo: TipoPersona): void {
        this.tipoPersona = tipo;
        this.manualError = '';
        this.docenteSeleccionado = null;
        this.vistaDocente = 'lista';
        if (tipo === 'docente' && this.docentes.length === 0) {
            this.cargarDocentes();
        }
        this.cdr.detectChanges();
    }

    // ── Docentes ────────────────────────────────────────────────────────────
    private async cargarDocentes(): Promise<void> {
        this.cargandoDocentes = true;
        this.cdr.detectChanges();
        try {
            this.docentes = await this.docentesService.obtenerDocentes();
            this.filtrarDocentes();
        } catch (e) {
            console.error('Error cargando docentes:', e);
            this.docentes = [];
            this.docentesFiltrados = [];
        } finally {
            this.cargandoDocentes = false;
            this.cdr.detectChanges();
        }
    }

    filtrarDocentes(): void {
        const q = this.busquedaDocentes.toLowerCase().trim();
        this.docentesFiltrados = !q
            ? [...this.docentes]
            : this.docentes.filter(d =>
                d.cedula.toLowerCase().includes(q) ||
                d.nombres.toLowerCase().includes(q) ||
                d.cargo.toLowerCase().includes(q)
            );
    }

    seleccionarDocente(d: Docente): void {
        this.docenteSeleccionado = d;
        this.cdr.detectChanges();
    }

    estaDocenteVinculado(d: Docente): boolean {
        const mapa = (this.cronograma as any)?.docentesVinculados ?? {};
        return !!mapa[d.cedula];
    }

    irANuevoDocente(): void {
        this.vistaDocente = 'nuevo';
        this.docenteForm = this.docenteFormVacio();
        this.manualError = '';
        this.cdr.detectChanges();
    }

    volverAListaDocentes(): void {
        this.vistaDocente = 'lista';
        this.manualError = '';
        this.cdr.detectChanges();
    }

    // ── Vincular docente existente ──────────────────────────────────────────
    async vincularDocenteExistente(): Promise<void> {
        if (!this.docenteSeleccionado || !this.cronograma?.id) return;
        this.guardando = true;
        this.cdr.detectChanges();
        try {
            await this.docentesService.vincularAcronograma(
                this.docenteSeleccionado,
                this.cronograma.id!,
                (id, datos) => this.cronogramaService.actualizarCronograma(id, datos)
            );

            const docentesActuales = (this.cronograma as any).docentesVinculados ?? {};
            (this.cronograma as any).docentesVinculados = {
                ...docentesActuales,
                [this.docenteSeleccionado.cedula]: {
                    cedula: this.docenteSeleccionado.cedula,
                    nombres: this.docenteSeleccionado.nombres,
                    cargo: this.docenteSeleccionado.cargo,
                    fechaVinculacion: new Date().toISOString()
                }
            };

            this.vinculadoEvento.emit(1);
            this.cerrar();
        } catch (error) {
            console.error('Error al vincular docente:', error);
            alert('Error al vincular docente');
        } finally {
            this.guardando = false;
            this.cdr.detectChanges();
        }
    }

    // ── Crear y vincular nuevo docente ──────────────────────────────────────
    async guardarNuevoDocente(): Promise<void> {
        this.manualError = '';
        const cedula = this.docenteForm.cedula.trim();
        const nombres = this.docenteForm.nombres.trim();
        const cargo = this.docenteForm.cargo.trim();

        if (!cedula || !nombres || !cargo) {
            this.manualError = 'Cédula, nombre y cargo son obligatorios.';
            return;
        }
        if (!this.cronograma?.id) return;

        const existente = await this.docentesService.obtenerDocente(cedula);
        if (existente) {
            this.manualError = `Ya existe un docente con cédula ${cedula}. Selecciónalo de la lista.`;
            return;
        }

        this.guardando = true;
        this.cdr.detectChanges();
        try {
            const nuevoDocente: Docente = {
                cedula, nombres, cargo,
                departamento: this.docenteForm.departamento.trim() || '',
                creadoEn: new Date().toISOString(),
                cronogramasAsignados: []
            };

            await this.docentesService.guardarDocente(nuevoDocente);
            await this.docentesService.vincularAcronograma(
                nuevoDocente,
                this.cronograma.id!,
                (id, datos) => this.cronogramaService.actualizarCronograma(id, datos)
            );

            const docentesActuales = (this.cronograma as any).docentesVinculados ?? {};
            (this.cronograma as any).docentesVinculados = {
                ...docentesActuales,
                [cedula]: {
                    cedula, nombres, cargo,
                    fechaVinculacion: new Date().toISOString()
                }
            };

            this.vinculadoEvento.emit(1);
            this.cerrar();
        } catch (error) {
            console.error('Error al guardar docente:', error);
            this.manualError = 'Ocurrió un error al guardar. Intenta de nuevo.';
        } finally {
            this.guardando = false;
            this.cdr.detectChanges();
        }
    }

    // ── Ingreso manual estudiante ───────────────────────────────────────────
    async vincularManual(): Promise<void> {
        this.manualError = '';
        const cedula = this.manualDatos.cedula.trim();
        const nombres = this.manualDatos.nombres.trim();

        if (!cedula || !nombres) {
            this.manualError = 'La cédula y el nombre son obligatorios.';
            return;
        }
        if (!this.cronograma?.id) return;

        const mapa = (this.cronograma as any)?.estudiantesVinculados ?? {};
        if (mapa[cedula]) {
            this.manualError = `El estudiante con cédula ${cedula} ya está vinculado.`;
            return;
        }

        this.guardando = true;
        this.cdr.detectChanges();
        try {
            const nuevoEstudiante = {
                cedula, nombres,
                carrera: this.manualDatos.carrera.trim() || '',
                sede: this.manualDatos.sede.trim() || '',
                telegramUser: this.manualDatos.telegramUser.trim() || '',
                asistencia: this.manualDatos.asistencia,
                grupo: this.manualDatos.grupo.trim() || '',
                fechaVinculacion: new Date().toISOString(),
                ingresadoManual: true
            };

            const vinculadosActuales = { ...mapa };
            vinculadosActuales[cedula] = nuevoEstudiante;

            await this.cronogramaService.actualizarCronograma(
                this.cronograma.id!,
                { estudiantesVinculados: vinculadosActuales } as any
            );

            this.vinculadoEvento.emit(1);
            this.cerrar();
        } catch (error) {
            console.error('Error al guardar manual:', error);
            this.manualError = 'Ocurrió un error al guardar. Intenta de nuevo.';
        } finally {
            this.guardando = false;
            this.cdr.detectChanges();
        }
    }

    // ── Paso 1: cargar grupos ───────────────────────────────────────────────
    private async cargarGrupos(): Promise<void> {
        this.cargando = true;
        this.cdr.detectChanges();
        try {
            this.grupos = await this.estudiantesService.obtenerGrupos();
        } catch (e) {
            console.error('Error cargando grupos:', e);
            this.grupos = [];
        } finally {
            this.cargando = false;
            this.cdr.detectChanges();
        }
    }

    async seleccionarGrupo(grupo: GrupoInduccion): Promise<void> {
        this.grupoSeleccionado = grupo;
        this.cargando = true;
        this.vista = 'estudiantes';
        this.cdr.detectChanges();
        try {
            this.estudiantes = await this.estudiantesService.obtenerEstudiantesDeGrupo(grupo.id);
            this.carrerasDisponibles = [...new Set(
                this.estudiantes
                    .map(e => e.carrera ?? '')
                    .filter(c => c.trim() !== '')
            )].sort((a, b) => a.localeCompare(b, 'es'));
            this.filtroCarreras.clear();
            this.filtrar();
        } catch (e) {
            console.error('Error cargando estudiantes:', e);
            this.estudiantes = [];
            this.estudiantesFiltrados = [];
        } finally {
            this.cargando = false;
            this.cdr.detectChanges();
        }
    }

    volverAGrupos(): void {
        this.vista = 'grupos';
        this.grupoSeleccionado = null;
        this.estudiantes = [];
        this.estudiantesFiltrados = [];
        this.seleccionados.clear();
        this.cdr.detectChanges();
    }

    // ── Filtros y selección ─────────────────────────────────────────────────
    filtrar(): void {
        const q = this.busqueda.toLowerCase().trim();
        let lista = this.estudiantes.filter(e => {
            const texto = !q ||
                e.cedula?.toLowerCase().includes(q) ||
                e.nombres?.toLowerCase().includes(q) ||
                e.carrera?.toLowerCase().includes(q);
            const asist =
                this.filtroAsistencia === 'TODOS' ||
                (this.filtroAsistencia === 'PRESENTE' && e.asistencia) ||
                (this.filtroAsistencia === 'AUSENTE' && !e.asistencia);
            const carrera =
                this.filtroCarreras.size === 0 ||
                this.filtroCarreras.has(e.carrera ?? '');
            const notif =
                this.filtroNotif === 'TODOS' ||
                (this.filtroNotif === 'ACTIVAS'    && this.estadoNotif(e) === 'activa') ||
                (this.filtroNotif === 'PENDIENTES' && this.estadoNotif(e) !== 'activa');
            return texto && asist && carrera && notif;
        });

        if (this.ordenarPorCarrera) {
            lista = [...lista].sort((a, b) =>
                (a.carrera ?? '').localeCompare(b.carrera ?? '', 'es'));
        }
        this.estudiantesFiltrados = lista;
    }

    toggleFiltroCarrera(carrera: string): void {
        this.filtroCarreras.has(carrera)
            ? this.filtroCarreras.delete(carrera)
            : this.filtroCarreras.add(carrera);
        this.filtrar();
    }

    limpiarFiltrosCarrera(): void {
        this.filtroCarreras.clear();
        this.filtrar();
    }

    toggleOrdenCarrera(): void {
        this.ordenarPorCarrera = !this.ordenarPorCarrera;
        this.filtrar();
    }

    setFiltroAsistencia(f: 'TODOS' | 'PRESENTE' | 'AUSENTE'): void {
        this.filtroAsistencia = f;
        this.filtrar();
    }

    toggleSeleccion(e: Estudiante): void {
        if (!e.id || this.estaVinculado(e)) return;
        this.seleccionados.has(e.id)
            ? this.seleccionados.delete(e.id)
            : this.seleccionados.add(e.id);
    }

    toggleTodos(event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        if (checked) {
            this.estudiantesFiltrados
                .filter(e => !this.estaVinculado(e))
                .forEach(e => { if (e.id) this.seleccionados.add(e.id); });
        } else {
            this.seleccionados.clear();
        }
    }

    todosSeleccionados(): boolean {
        const disponibles = this.estudiantesFiltrados.filter(e => !this.estaVinculado(e));
        return disponibles.length > 0 &&
            disponibles.every(e => this.seleccionados.has(e.id!));
    }

    estaVinculado(e: Estudiante): boolean {
        if (!e.cedula) return false;
        const mapa = (this.cronograma as any)?.estudiantesVinculados ?? {};
        return !!mapa[e.cedula];
    }

    // ── Vincular estudiantes desde lista ────────────────────────────────────
    async vincular(): Promise<void> {
        if (!this.cronograma?.id || this.seleccionados.size === 0) return;
        this.guardando = true;
        this.cdr.detectChanges();
        try {
            const aVincular = this.estudiantes
                .filter(e => this.seleccionados.has(e.id!))
                .map(e => ({
                    cedula: e.cedula,
                    nombres: e.nombres,
                    carrera: e.carrera,
                    sede: e.sede ?? '',
                    telegramUser: e.telegramUser ?? '',
                    asistencia: e.asistencia ?? false,
                    grupo: this.grupoSeleccionado?.nombres ?? '',
                    fechaVinculacion: new Date().toISOString()
                }));

            const vinculadosActuales = (this.cronograma as any).estudiantesVinculados ?? {};
            const nuevoVinculados = { ...vinculadosActuales };
            aVincular.forEach(e => { nuevoVinculados[e.cedula] = e; });

            await this.cronogramaService.actualizarCronograma(
                this.cronograma.id!,
                { estudiantesVinculados: nuevoVinculados } as any
            );

            this.vinculadoEvento.emit(aVincular.length);
            this.cerrar();
        } catch (error) {
            console.error('Error al vincular:', error);
            alert('Error al vincular estudiantes');
        } finally {
            this.guardando = false;
            this.cdr.detectChanges();
        }
    }

    // ── Cierre ──────────────────────────────────────────────────────────────
    cerrar(): void { this.cerrarEvento.emit(); }

    cerrarSiFuera(event: MouseEvent): void {
        if ((event.target as HTMLElement).classList.contains('overlay')) {
            this.cerrar();
        }
    }
}
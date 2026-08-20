import {
    Component, Input, Output, EventEmitter,
    OnChanges, SimpleChanges, ChangeDetectorRef,
    OnDestroy, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { EstudiantesService, Estudiante, GrupoInduccion } from '../../firebase/estudiante';
import { CronogramaService, Cronograma } from '../../firebase/cronogramas';
import { Docente, DocentesService } from '../../firebase/Docentes.service';

import {
    RequisitosHelper, RequisitosModal, RequisitosNoEncontradoError, requisitosModalVacio
} from './components/requisitos';
import {
    TransferirHelper, TransferirModal, transferirModalVacio
} from './components/transferir';
import { ExportarExcelHelper } from './components/exportar-excel';
import {
    EstadisticasHelper, calcularStatsGenerales, agruparEstudiantesPor
} from './components/estadisticas';
import { MantenimientoHelper } from './components/mantenimiento';

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

@Component({
    selector: 'app-modal-vincular',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './modal-vincular.html',
    styleUrl: './modal-vincular.css'
})
export class ModalVincular implements OnChanges, OnDestroy {

    @Input() puedeEditar = false;

    @Input() visible: boolean = false;
    @Input() cronograma: Cronograma | null = null;
    @Output() cerrarEvento = new EventEmitter<void>();
    @Output() vinculadoEvento = new EventEmitter<number>();

    @ViewChild('canvasNotifDonut') canvasNotifDonutRef?: ElementRef<HTMLCanvasElement>;
    @ViewChild('canvasSedeStack') canvasSedeStackRef?: ElementRef<HTMLCanvasElement>;
    @ViewChild('canvasSedeSinActivar') canvasSedeSinActivarRef?: ElementRef<HTMLCanvasElement>;
    @ViewChild('canvasCarreraStack') canvasCarreraStackRef?: ElementRef<HTMLCanvasElement>;
    @ViewChild('canvasCarreraSinActivar') canvasCarreraSinActivarRef?: ElementRef<HTMLCanvasElement>;

    // ── Helpers (lógica pesada extraída) ────────────────────────────────────
    private requisitosHelper = new RequisitosHelper();
    private transferirHelper: TransferirHelper;
    private exportarExcelHelper = new ExportarExcelHelper();
    private estadisticasHelper = new EstadisticasHelper();
    private mantenimientoHelper: MantenimientoHelper;

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
    seleccionadosVinculados = new Set<string>(); // cédulas, persiste entre páginas y filtros
    filtroTipoVinculado: 'TODOS' | 'ESTUDIANTES' | 'DOCENTES' = 'TODOS';
    filtroNotifVinculados: 'TODOS' | 'ACTIVAS' | 'PENDIENTES' | 'SIN_TELEGRAM' | 'DUPLICADOS' = 'TODOS';
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

    // ── Mini-modales ─────────────────────────────────────────────────────────
    requisitosModal: RequisitosModal = requisitosModalVacio();
    transferirModal: TransferirModal = transferirModalVacio();

    // ── Computed: personas vinculadas ───────────────────────────────────────
    // Cacheado: con 1000+ estudiantes, reconstruir este arreglo en CADA
    // change detection (getters se re-ejecutan constantemente en Angular)
    // es lo que causaba la demora al abrir "vinculados". Solo se recalcula
    // si estudiantesVinculados/docentesVinculados cambiaron de referencia,
    // cosa que ya ocurre porque el resto del código siempre reasigna un
    // objeto nuevo en vez de mutar in-place.
    private _cachePersonas: any[] = [];
    private _cacheEstRef: any = undefined;
    private _cacheDocRef: any = undefined;

    get personasVinculadas(): any[] {
        const estRef = (this.cronograma as any)?.estudiantesVinculados;
        const docRef = (this.cronograma as any)?.docentesVinculados;

        if (estRef === this._cacheEstRef && docRef === this._cacheDocRef) {
            return this._cachePersonas;
        }

        const estudiantes = Object.values(estRef ?? {})
            .map((e: any) => ({ ...e, tipo: 'estudiante' }));
        const docentes = Object.values(docRef ?? {})
            .map((d: any) => ({ ...d, tipo: 'docente' }));

        this._cachePersonas = [...docentes, ...estudiantes];
        this._cacheEstRef = estRef;
        this._cacheDocRef = docRef;
        return this._cachePersonas;
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

    private _cacheVinculadosFiltrados: any[] = [];
    private _cacheVinculadosFiltradosPersonasRef: any[] | null = null;
    private _cacheVinculadosFiltradosKey = '';

    get vinculadosFiltrados(): any[] {
        const personas = this.personasVinculadas;
        const key = `${this.busquedaVinculados}|${this.filtroTipoVinculado}|${this.filtroNotifVinculados}|${this.filtroCarreraVinculadosSeleccionada}`;

        if (personas === this._cacheVinculadosFiltradosPersonasRef && key === this._cacheVinculadosFiltradosKey) {
            return this._cacheVinculadosFiltrados;
        }

        const q = this.busquedaVinculados.toLowerCase().trim();
        const duplicados = this.chatIdsDuplicados;
        const resultado = personas.filter(p => {
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

        this._cacheVinculadosFiltrados = resultado;
        this._cacheVinculadosFiltradosPersonasRef = personas;
        this._cacheVinculadosFiltradosKey = key;
        return resultado;
    }

    // ── Paginación de vinculados (100 en 100) ───────────────────────────────
    paginaActualVinculados = 1;
    readonly tamanoPaginaVinculados = 100;

    get totalPaginasVinculados(): number {
        return Math.max(1, Math.ceil(this.vinculadosFiltrados.length / this.tamanoPaginaVinculados));
    }

    get vinculadosPaginados(): any[] {
        const total = this.totalPaginasVinculados;
        if (this.paginaActualVinculados > total) {
            this.paginaActualVinculados = total;
        }
        const inicio = (this.paginaActualVinculados - 1) * this.tamanoPaginaVinculados;
        return this.vinculadosFiltrados.slice(inicio, inicio + this.tamanoPaginaVinculados);
    }

    /** Texto tipo "1–100 de 1243" para mostrar junto a los controles de paginación */
    get rangoVinculadosTexto(): string {
        const total = this.vinculadosFiltrados.length;
        if (total === 0) return '0 de 0';
        const inicio = (this.paginaActualVinculados - 1) * this.tamanoPaginaVinculados + 1;
        const fin = Math.min(this.paginaActualVinculados * this.tamanoPaginaVinculados, total);
        return `${inicio}–${fin} de ${total}`;
    }

    irAPaginaVinculados(pagina: number): void {
        const total = this.totalPaginasVinculados;
        this.paginaActualVinculados = Math.min(Math.max(1, pagina), total);
        this.cdr.detectChanges();
    }

    paginaAnteriorVinculados(): void {
        this.irAPaginaVinculados(this.paginaActualVinculados - 1);
    }

    paginaSiguienteVinculados(): void {
        this.irAPaginaVinculados(this.paginaActualVinculados + 1);
    }

    /** Llama esto desde (ngModelChange) del input de búsqueda de vinculados */
    onBusquedaVinculadosChange(): void {
        this.paginaActualVinculados = 1;
        this.cdr.detectChanges();
    }

    /** Úsala en el *ngFor de la lista de vinculados: trackBy: trackByCedula */
    trackByCedula(index: number, p: any): string {
        return p?.cedula ?? String(index);
    }

    contarVinculados(tipo: 'estudiante' | 'docente'): number {
        return this.personasVinculadas.filter(p => p.tipo === tipo).length;
    }

    get totalConChatId(): number {
        return this.personasVinculadas.filter((p: any) => !!p.telegramChatId).length;
    }

    get totalSinChatId(): number {
        return this.personasVinculadas.length - this.totalConChatId;
    }

    private _cacheDuplicados: Set<string> = new Set();
    private _cacheDuplicadosRef: any[] | null = null;

    get chatIdsDuplicados(): Set<string> {
        const personas = this.personasVinculadas;
        if (personas === this._cacheDuplicadosRef) {
            return this._cacheDuplicados;
        }

        const conteo = new Map<string, number>();
        personas.forEach((p: any) => {
            if (p.telegramChatId) {
                const id = String(p.telegramChatId);
                conteo.set(id, (conteo.get(id) ?? 0) + 1);
            }
        });
        const duplicados = new Set<string>();
        conteo.forEach((cant, id) => { if (cant > 1) duplicados.add(id); });

        this._cacheDuplicados = duplicados;
        this._cacheDuplicadosRef = personas;
        return this._cacheDuplicados;
    }

    get totalConChatIdDuplicado(): number {
        const duplicados = this.chatIdsDuplicados;
        return this.personasVinculadas.filter(
            (p: any) => p.telegramChatId && duplicados.has(String(p.telegramChatId))
        ).length;
    }

    get totalConSede(): number {
        return this.personasVinculadas.filter(
            (p: any) => p.tipo === 'estudiante' && !!(p.sede && p.sede.trim())
        ).length;
    }

    get totalSinSede(): number {
        return this.personasVinculadas.filter(
            (p: any) => p.tipo === 'estudiante' && !(p.sede && p.sede.trim())
        ).length;
    }

    // ══════════════════════════════════════════════════════════════════════
    // Estadísticas para la pestaña "Estadísticas" (delegado a estadisticas.ts)
    // ══════════════════════════════════════════════════════════════════════

    get estudiantesVinculadosLista(): any[] {
        return this.personasVinculadas.filter(p => p.tipo === 'estudiante');
    }

    get statsGenerales() {
        return calcularStatsGenerales(this.estudiantesVinculadosLista, e => this.estadoNotifVinculado(e));
    }

    get statsPorSede() {
        return agruparEstudiantesPor(this.estudiantesVinculadosLista, 'sede', e => this.estadoNotifVinculado(e))
            .map(s => ({ sede: s.etiqueta, ...s }));
    }

    get statsPorCarrera() {
        return agruparEstudiantesPor(this.estudiantesVinculadosLista, 'carrera', e => this.estadoNotifVinculado(e))
            .map(c => ({ carrera: c.etiqueta, ...c }));
    }

    constructor(
        private estudiantesService: EstudiantesService,
        private cronogramaService: CronogramaService,
        private docentesService: DocentesService,
        private cdr: ChangeDetectorRef
    ) {
        this.transferirHelper = new TransferirHelper(this.cronogramaService);
        this.mantenimientoHelper = new MantenimientoHelper(this.estudiantesService, this.cronogramaService);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['visible']?.currentValue === true) {
            this.resetear();
            this.cargarGrupos();
        }
        if (changes['visible']?.currentValue === false) {
            this.estadisticasHelper.destruirGraficas();
        }
    }

    ngOnDestroy(): void {
        this.estadisticasHelper.destruirGraficas();
    }

    // ── Vaciadores ──────────────────────────────────────────────────────────
    private manualVacio(): ManualDatos {
        return { cedula: '', nombres: '', carrera: '', sede: '', telegramUser: '', grupo: '', asistencia: false };
    }

    private docenteFormVacio(): DocenteForm {
        return { cedula: '', nombres: '', cargo: '', departamento: '' };
    }

    private resetear(): void {
        this.estadisticasHelper.destruirGraficas();
        this.vista = 'grupos';
        this.modalExpandido = true;
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
        this.requisitosModal = requisitosModalVacio();
        this.transferirModal = transferirModalVacio();
        this.seleccionadosVinculados.clear();

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
    // Mini-modal de requisitos (delegado a requisitos.ts)
    // ══════════════════════════════════════════════════════════════════════

    async abrirRequisitos(e: { cedula?: string; nombres?: string }): Promise<void> {
        this.requisitosModal = {
            ...requisitosModalVacio(),
            visible: true,
            cargando: true,
            cedula: e.cedula ?? '',
            nombres: e.nombres ?? ''
        };
        this.cdr.detectChanges();

        try {
            const resultado = await this.requisitosHelper.buscar(e.cedula ?? '');
            this.requisitosModal = {
                ...this.requisitosModal,
                cargando: false,
                ...resultado
            };
        } catch (err) {
            console.error('Error al cargar requisitos:', err);
            this.requisitosModal = {
                ...this.requisitosModal,
                cargando: false,
                error: err instanceof RequisitosNoEncontradoError
                    ? err.message
                    : 'Error al consultar la base de datos. Intenta de nuevo.'
            };
        }

        this.cdr.detectChanges();
    }

    cerrarRequisitos(): void {
        this.requisitosModal = requisitosModalVacio();
        this.cdr.detectChanges();
    }

    // ══════════════════════════════════════════════════════════════════════
    // Transferir estudiante(s) a otro cronograma (delegado a transferir.ts)
    // ══════════════════════════════════════════════════════════════════════

    /** Abre el mini-modal de transferencia para UN estudiante (botón por fila) */
    async abrirTransferir(persona: any): Promise<void> {
        if (!this.puedeEditar) return;
        if (persona.tipo !== 'estudiante') return;
        await this.abrirTransferirConPersonas([persona]);
    }

    /** Abre el mini-modal de transferencia para TODOS los seleccionados (botón global) */
    async abrirTransferirLote(): Promise<void> {
        if (!this.puedeEditar) return;
        const personas = this.personasSeleccionadasParaTransferir;
        if (personas.length === 0) return;
        await this.abrirTransferirConPersonas(personas);
    }

    /** Estudiantes seleccionados en la vista Vinculados, listos para transferir */
    get personasSeleccionadasParaTransferir(): any[] {
        return this.personasVinculadas.filter(
            p => p.tipo === 'estudiante' && this.seleccionadosVinculados.has(p.cedula)
        );
    }

    private async abrirTransferirConPersonas(personas: any[]): Promise<void> {
        this.transferirModal = {
            ...transferirModalVacio(),
            visible: true,
            cargando: true,
            personas
        };
        this.cdr.detectChanges();

        try {
            this.transferirModal.cronogramas =
                await this.transferirHelper.cargarCronogramasDisponibles(this.cronograma?.id);
        } catch (error) {
            console.error('Error al cargar cronogramas:', error);
            this.transferirModal.error = 'No se pudieron cargar los cronogramas disponibles.';
        } finally {
            this.transferirModal.cargando = false;
            this.cdr.detectChanges();
        }
    }

    cerrarTransferir(): void {
        this.transferirModal = transferirModalVacio();
        this.cdr.detectChanges();
    }

    async confirmarTransferir(): Promise<void> {
        if (!this.puedeEditar) return;
        const { personas, cronogramaDestinoId, cronogramas, eliminarDeOrigen } = this.transferirModal;

        if (!personas?.length || !cronogramaDestinoId || !this.cronograma?.id) return;

        const destino = cronogramas.find(c => c.id === cronogramaDestinoId);
        if (!destino?.id) {
            this.transferirModal.error = 'Cronograma destino no válido.';
            return;
        }

        const accion = eliminarDeOrigen ? 'mover' : 'copiar';
        const confirmado = confirm(
            `¿Seguro que deseas ${accion} ${personas.length} estudiante${personas.length !== 1 ? 's' : ''} ` +
            `hacia "${destino.nombre}"?`
        );
        if (!confirmado) return;

        this.transferirModal.guardando = true;
        this.cdr.detectChanges();

        try {
            const { exito, fallidos } = await this.transferirHelper.transferirLote(
                personas, this.cronograma, destino, eliminarDeOrigen
            );
            this.cerrarTransferir();
            this.seleccionadosVinculados.clear();
            alert(
                fallidos === 0
                    ? `${exito} estudiante${exito !== 1 ? 's' : ''} ${eliminarDeOrigen ? 'movido(s)' : 'copiado(s)'} a "${destino.nombre}" correctamente.`
                    : `Completado con errores.\n✔ Transferidos: ${exito}\n✘ Fallidos: ${fallidos}`
            );
        } catch (error) {
            console.error('Error al transferir estudiantes:', error);
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
        this.paginaActualVinculados = 1;
        this.vista = 'vinculados';
        this.cdr.detectChanges();
    }

    volverDesdeVinculados(): void {
        this.vista = this.origenVinculados;
        this.cdr.detectChanges();
    }

    setFiltroTipoVinculado(f: 'TODOS' | 'ESTUDIANTES' | 'DOCENTES'): void {
        this.filtroTipoVinculado = f;
        this.paginaActualVinculados = 1;
        this.cdr.detectChanges();
    }

    setFiltroNotifVinculados(f: 'TODOS' | 'ACTIVAS' | 'PENDIENTES' | 'SIN_TELEGRAM' | 'DUPLICADOS'): void {
        this.filtroNotifVinculados = f;
        this.paginaActualVinculados = 1;
        this.cdr.detectChanges();
    }

    setFiltroCarreraVinculados(valor: string): void {
        this.filtroCarreraVinculadosSeleccionada = valor;
        this.paginaActualVinculados = 1;
        this.cdr.detectChanges();
    }

    limpiarFiltrosVinculados(): void {
        this.busquedaVinculados = '';
        this.filtroTipoVinculado = 'TODOS';
        this.filtroNotifVinculados = 'TODOS';
        this.filtroCarreraVinculadosSeleccionada = '';
        this.paginaActualVinculados = 1;
        this.cdr.detectChanges();
    }

    get hayFiltrosVinculadosActivos(): boolean {
        return this.filtroTipoVinculado !== 'TODOS' ||
            this.filtroNotifVinculados !== 'TODOS' ||
            this.filtroCarreraVinculadosSeleccionada !== '' ||
            this.busquedaVinculados.trim() !== '';
    }

    // ── Selección de vinculados (para transferencia masiva) ───────────────
    // La selección se guarda por cédula y persiste entre páginas y filtros,
    // así se puede filtrar por carrera, marcar todos, cambiar de filtro/página
    // y seguir acumulando antes de transferir todo junto.

    toggleSeleccionVinculado(p: any): void {
        if (p.tipo !== 'estudiante' || !p.cedula) return;
        this.seleccionadosVinculados.has(p.cedula)
            ? this.seleccionadosVinculados.delete(p.cedula)
            : this.seleccionadosVinculados.add(p.cedula);
    }

    /** Checkbox del header: marca/desmarca todos los estudiantes de la página actual */
    toggleTodosVinculadosPagina(event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        const disponibles = this.vinculadosPaginados.filter(p => p.tipo === 'estudiante' && p.cedula);
        disponibles.forEach(p => {
            checked ? this.seleccionadosVinculados.add(p.cedula) : this.seleccionadosVinculados.delete(p.cedula);
        });
    }

    todosVinculadosPaginaSeleccionados(): boolean {
        const disponibles = this.vinculadosPaginados.filter(p => p.tipo === 'estudiante' && p.cedula);
        return disponibles.length > 0 && disponibles.every(p => this.seleccionadosVinculados.has(p.cedula));
    }

    /** Marca/desmarca TODOS los estudiantes que coinciden con los filtros actuales (todas las páginas) */
    toggleTodosVinculadosFiltrados(event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        const disponibles = this.vinculadosFiltrados.filter(p => p.tipo === 'estudiante' && p.cedula);
        disponibles.forEach(p => {
            checked ? this.seleccionadosVinculados.add(p.cedula) : this.seleccionadosVinculados.delete(p.cedula);
        });
        this.cdr.detectChanges();
    }

    limpiarSeleccionVinculados(): void {
        this.seleccionadosVinculados.clear();
        this.cdr.detectChanges();
    }

    // ══════════════════════════════════════════════════════════════════════
    // Pestaña de estadísticas (cálculos y gráficas delegados a estadisticas.ts)
    // ══════════════════════════════════════════════════════════════════════

    irAEstadisticas(): void {
        this.origenEstadisticas =
            this.vista === 'estudiantes' ? 'estudiantes' :
                this.vista === 'vinculados' ? 'vinculados' : 'grupos';

        this.vista = 'estadisticas';
        this.cdr.detectChanges();

        // Esperamos DOS frames de pintado para asegurar que Angular ya
        // insertó los <canvas> en el DOM con su tamaño final antes de que
        // Chart.js los mida (evita el bug de la dona con un solo color).
        requestAnimationFrame(() => {
            requestAnimationFrame(() => this.renderizarGraficas());
        });
    }

    volverDesdeEstadisticas(): void {
        this.estadisticasHelper.destruirGraficas();
        this.vista = this.origenEstadisticas;
        this.cdr.detectChanges();
    }

    private renderizarGraficas(): void {
        this.estadisticasHelper.renderizarGraficas(
            {
                notifDonut: this.canvasNotifDonutRef,
                sedeStack: this.canvasSedeStackRef,
                sedeSinActivar: this.canvasSedeSinActivarRef,
                carreraStack: this.canvasCarreraStackRef,
                carreraSinActivar: this.canvasCarreraSinActivarRef
            },
            this.statsGenerales,
            this.statsPorSede,
            this.statsPorCarrera
        );
    }

    async desvincular(persona: any): Promise<void> {
        if (!this.puedeEditar) return;
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
            this.seleccionadosVinculados.delete(persona.cedula);
            this.cdr.detectChanges();
        } catch (error) {
            console.error('Error al desvincular:', error);
            alert('Error al desvincular');
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // Exportar a Excel (delegado a exportar-excel.ts)
    // ══════════════════════════════════════════════════════════════════════

    async exportarExcel(): Promise<void> {
        const datos = this.personasVinculadas.filter(p => p.tipo === 'estudiante');

        if (datos.length === 0) {
            alert('No hay estudiantes vinculados para exportar.');
            return;
        }

        this.exportando = true;
        this.cdr.detectChanges();

        try {
            const nombreCrono = (this.cronograma as any)?.nombre ?? 'cronograma';
            await this.exportarExcelHelper.exportar(datos, nombreCrono, p => this.estadoNotifVinculado(p));
        } catch (error) {
            console.error('Error al exportar Excel:', error);
            alert('Ocurrió un error al generar el Excel. Intenta de nuevo.');
        } finally {
            this.exportando = false;
            this.cdr.detectChanges();
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // Migrar telegramChatId / Actualizar sede (delegado a mantenimiento.ts)
    // ══════════════════════════════════════════════════════════════════════

    async migrarTelegramChatIds(): Promise<void> {
        if (!this.puedeEditar) return;
        const estudiantesConTelegram = this.personasVinculadas.filter(
            (p: any) => p.tipo === 'estudiante' && p.telegramChatId && p.cedula
        );

        if (estudiantesConTelegram.length === 0) {
            alert('No hay estudiantes vinculados con telegramChatId para migrar.');
            return;
        }

        const confirmado = confirm(
            `Se copiará el campo telegramChatId de ${estudiantesConTelegram.length} ` +
            `estudiante(s) desde Realtime Database hacia Firestore (colección Estudiantes). ` +
            `¿Continuar?`
        );
        if (!confirmado) return;

        this.migrandoTelegram = true;
        this.cdr.detectChanges();

        try {
            const { exito, fallidos, sinDocFirestore } =
                await this.mantenimientoHelper.migrarTelegramChatIds(this.personasVinculadas);

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

        try {
            const { actualizados, sinCoincidencia } =
                await this.mantenimientoHelper.actualizarSedeVinculados(this.cronograma, this.personasVinculadas);

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
        if (!this.puedeEditar) return;
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
        if (!this.puedeEditar) return;
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
        if (!this.puedeEditar) return;
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
        if (!this.puedeEditar) return;
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
                (this.filtroNotif === 'ACTIVAS' && this.estadoNotif(e) === 'activa') ||
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
        if (!this.puedeEditar) return;
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

    // ── Expandir modal ──────────────────────────────────────────────────────
    modalExpandido = true;

    toggleExpandido(): void {
        this.modalExpandido = !this.modalExpandido;
        this.cdr.detectChanges();
    }
}
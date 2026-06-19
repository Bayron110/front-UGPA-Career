import {
    Component, Input, Output, EventEmitter,
    OnChanges, SimpleChanges, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { EstudiantesService, Estudiante, GrupoInduccion } from '../../firebase/estudiante';
import { CronogramaService, Cronograma } from '../../firebase/cronogramas';
import { Docente, DocentesService } from '../../firebase/Docentes.service';


type Vista = 'grupos' | 'estudiantes' | 'manual' | 'vinculados';
type TipoPersona = 'estudiante' | 'docente';
/** Sub-vista dentro del paso manual para docentes */
type VistaDocente = 'lista' | 'nuevo';
/** Estado de notificaciones de un estudiante */
type EstadoNotif = 'activa' | 'pendiente' | 'sin-telegram';

interface ManualDatos {
    cedula: string;
    nombres: string;
    carrera: string;
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
export class ModalVincular implements OnChanges {

    @Input() visible: boolean = false;
    @Input() cronograma: Cronograma | null = null;
    @Output() cerrarEvento = new EventEmitter<void>();
    @Output() vinculadoEvento = new EventEmitter<number>();

    // ── Paso 1: grupos ─────────────────────────────────────────────────────
    vista: Vista = 'grupos';
    grupos: GrupoInduccion[] = [];
    grupoSeleccionado: GrupoInduccion | null = null;

    // ── Paso 2: estudiantes ─────────────────────────────────────────────────
    estudiantes: Estudiante[] = [];
    estudiantesFiltrados: Estudiante[] = [];
    seleccionados = new Set<string>();
    busqueda = '';
    filtroAsistencia: 'TODOS' | 'PRESENTE' | 'AUSENTE' = 'TODOS';
    /** Filtro por estado de notificaciones */
    filtroNotif: 'TODOS' | 'ACTIVAS' | 'PENDIENTES' = 'TODOS';

    // ── Paso 3: tipo de persona ─────────────────────────────────────────────
    tipoPersona: TipoPersona = 'estudiante';
    origenManual: 'grupos' | 'estudiantes' = 'grupos';

    // ── Sub-vista docente ───────────────────────────────────────────────────
    /** 'lista' = mostrar docentes guardados | 'nuevo' = formulario nuevo docente */
    vistaDocente: VistaDocente = 'lista';
    docentes: Docente[] = [];
    docentesFiltrados: Docente[] = [];
    busquedaDocentes = '';
    cargandoDocentes = false;
    /** Docente seleccionado de la lista para vincular */
    docenteSeleccionado: Docente | null = null;

    // ── Paso vinculados ─────────────────────────────────────────────────────
    origenVinculados: 'grupos' | 'estudiantes' = 'grupos';
    busquedaVinculados = '';
    filtroTipoVinculado: 'TODOS' | 'ESTUDIANTES' | 'DOCENTES' = 'TODOS';
    /** Filtro por estado de notificaciones en la vista de vinculados */
    filtroNotifVinculados: 'TODOS' | 'ACTIVAS' | 'PENDIENTES' | 'SIN_TELEGRAM' = 'TODOS';
    /** Filtro por carrera/cargo en la vista de vinculados (dropdown, valor único) */
    filtroCarreraVinculadosSeleccionada = '';
    /** Indica si se está generando el archivo Excel */
    exportando = false;

    // ── Formularios ─────────────────────────────────────────────────────────
    manualDatos: ManualDatos = this.manualVacio();
    docenteForm: DocenteForm = this.docenteFormVacio();
    manualError = '';

    // ── Estado de carga ─────────────────────────────────────────────────────
    cargando = false;
    guardando = false;

    // ── Filtros carrera / orden ──────────────────────────────────────────────
    carrerasDisponibles: string[] = [];
    filtroCarreras = new Set<string>();
    ordenarPorCarrera = false;

    // ── Computed: personas vinculadas al cronograma actual ──────────────────
    get personasVinculadas(): any[] {
        const estudiantes = Object.values((this.cronograma as any)?.estudiantesVinculados ?? {})
            .map((e: any) => ({ ...e, tipo: 'estudiante' }));
        const docentes = Object.values((this.cronograma as any)?.docentesVinculados ?? {})
            .map((d: any) => ({ ...d, tipo: 'docente' }));
        return [...docentes, ...estudiantes];
    }

    /** Carreras/cargos únicos entre los vinculados, para los chips de filtro */
    get carrerasVinculadosDisponibles(): string[] {
        const valores = this.personasVinculadas
            .map(p => (p.tipo === 'docente' ? p.cargo : p.carrera) ?? '')
            .filter((c: string) => c.trim() !== '');
        return [...new Set(valores)].sort((a, b) => a.localeCompare(b, 'es'));
    }

    /** Estado de notificaciones de una persona ya vinculada (estudiante o docente) */
    estadoNotifVinculado(p: any): EstadoNotif {
        if (p.notificacionesActivas && p.telegramChatId) return 'activa';
        if (p.telegramUser || p.telegramChatId) return 'pendiente';
        return 'sin-telegram';
    }

    get vinculadosFiltrados(): any[] {
        const q = this.busquedaVinculados.toLowerCase().trim();
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
                (this.filtroNotifVinculados === 'SIN_TELEGRAM' && estadoNotif === 'sin-telegram');
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
    }

    // ── Vaciadores ──────────────────────────────────────────────────────────
    private manualVacio(): ManualDatos {
        return { cedula: '', nombres: '', carrera: '', telegramUser: '', grupo: '', asistencia: false };
    }

    private docenteFormVacio(): DocenteForm {
        return { cedula: '', nombres: '', cargo: '', departamento: '' };
    }

    private resetear(): void {
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
        this.origenVinculados = 'grupos';
        this.vistaDocente = 'lista';
        this.docentes = [];
        this.docentesFiltrados = [];
        this.busquedaDocentes = '';
        this.docenteSeleccionado = null;
        this.carrerasDisponibles = [];
        this.filtroCarreras = new Set<string>();
        this.ordenarPorCarrera = false;
    }

    // ── Notificaciones ──────────────────────────────────────────────────────

    /**
     * Devuelve el estado de notificaciones de un estudiante.
     * Lee desde estudiantesVinculados del cronograma si el estudiante ya está
     * vinculado (tiene telegramChatId/notificacionesActivas), o directamente
     * del objeto Estudiante si aún no está vinculado.
     *
     * 'activa'       → tiene telegramChatId y notificacionesActivas: true
     * 'pendiente'    → tiene telegramUser pero no ha iniciado el bot aún
     * 'sin-telegram' → no tiene telegramUser registrado
     */
    estadoNotif(e: Estudiante): EstadoNotif {
        // Intentar leer desde el nodo vinculados del cronograma (tiene los campos frescos)
        const vinculados = (this.cronograma as any)?.estudiantesVinculados ?? {};
        const vinc = e.cedula ? vinculados[e.cedula] : null;

        const chatId = vinc?.telegramChatId ?? (e as any).telegramChatId;
        const notifActiva = vinc?.notificacionesActivas ?? (e as any).notificacionesActivas;
        const tgUser = vinc?.telegramUser ?? e.telegramUser;

        if (chatId && notifActiva) return 'activa';
        if (tgUser) return 'pendiente';
        return 'sin-telegram';
    }

    /** Filtro por estado de notificaciones */
    setFiltroNotif(f: 'TODOS' | 'ACTIVAS' | 'PENDIENTES'): void {
        this.filtroNotif = f;
        this.filtrar();
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

    /** Filtro por estado de notificaciones, en la vista de vinculados */
    setFiltroNotifVinculados(f: 'TODOS' | 'ACTIVAS' | 'PENDIENTES' | 'SIN_TELEGRAM'): void {
        this.filtroNotifVinculados = f;
        this.cdr.detectChanges();
    }

    /** Selecciona una carrera/cargo desde el dropdown de filtro de vinculados */
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
    /**
     * Genera y descarga un archivo .xlsx con TODAS las personas vinculadas al
     * cronograma (estudiantes + docentes), sin importar filtros o búsqueda
     * activos en pantalla. Usa la librería SheetJS (xlsx), cargada
     * dinámicamente desde CDN si aún no está disponible en window, para no
     * añadir una dependencia pesada al bundle cuando la función no se usa.
     */
    async exportarExcel(): Promise<void> {
        const datos = this.personasVinculadas;
        if (datos.length === 0) {
            alert('No hay personas vinculadas para exportar.');
            return;
        }

        this.exportando = true;
        this.cdr.detectChanges();

        try {
            const XLSX = await this.cargarSheetJS();

            const filas = datos.map(p => ({
                'Tipo': p.tipo === 'docente' ? 'Docente' : 'Estudiante',
                'Cédula': p.cedula ?? '',
                'Nombre': p.nombres ?? '',
                'Carrera / Cargo': (p.tipo === 'docente' ? p.cargo : p.carrera) ?? '',
                'Departamento': p.departamento ?? '',
                'Telegram': p.telegramUser ? '@' + p.telegramUser : '',
                'Notificaciones': this.etiquetaNotif(this.estadoNotifVinculado(p)),
                'Asistencia': p.tipo === 'estudiante' ? (p.asistencia ? 'Presente' : 'Ausente') : '',
                'Fecha de vinculación': this.formatearFecha(p.fechaVinculacion)
            }));

            const hoja = XLSX.utils.json_to_sheet(filas);

            // Ancho de columnas aproximado según contenido
            hoja['!cols'] = [
                { wch: 12 }, // Tipo
                { wch: 14 }, // Cédula
                { wch: 28 }, // Nombre
                { wch: 26 }, // Carrera / Cargo
                { wch: 18 }, // Departamento
                { wch: 18 }, // Telegram
                { wch: 14 }, // Notificaciones
                { wch: 12 }, // Asistencia
                { wch: 18 }  // Fecha de vinculación
            ];

            const libro = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(libro, hoja, 'Vinculados');

            const nombreCrono = (this.cronograma as any)?.nombre ?? 'cronograma';
            const fecha = new Date().toISOString().slice(0, 10);
            const nombreArchivo = `vinculados_${this.slug(nombreCrono)}_${fecha}.xlsx`;

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

    /** Carga SheetJS (xlsx) desde CDN una sola vez y la deja cacheada en window */
    private cargarSheetJS(): Promise<any> {
        if ((window as any).XLSX) {
            return Promise.resolve((window as any).XLSX);
        }
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = () => resolve((window as any).XLSX);
            script.onerror = () => reject(new Error('No se pudo cargar la librería de exportación.'));
            document.head.appendChild(script);
        });
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

    // ── Docentes: cargar y filtrar ──────────────────────────────────────────
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
                cedula,
                nombres,
                cargo,
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
                    cedula,
                    nombres,
                    cargo,
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
                cedula,
                nombres,
                carrera: this.manualDatos.carrera.trim() || '',
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

    // ── Paso 2: filtros y selección ─────────────────────────────────────────
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
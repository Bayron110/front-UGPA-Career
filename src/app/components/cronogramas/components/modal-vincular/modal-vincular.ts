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
type VistaDocente = 'lista' | 'nuevo';
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
    filtroNotifVinculados: 'TODOS' | 'ACTIVAS' | 'PENDIENTES' | 'SIN_TELEGRAM' = 'TODOS';
    filtroCarreraVinculadosSeleccionada = '';
    exportando = false;

    // ── Formularios ─────────────────────────────────────────────────────────
    manualDatos: ManualDatos = this.manualVacio();
    docenteForm: DocenteForm = this.docenteFormVacio();
    manualError = '';

    // ── Estado de carga ─────────────────────────────────────────────────────
    cargando = false;
    guardando = false;
    migrandoTelegram = false;

    // ── Filtros carrera / orden ─────────────────────────────────────────────
    carrerasDisponibles: string[] = [];
    filtroCarreras = new Set<string>();
    ordenarPorCarrera = false;

    // ── NUEVO: Mini-modal de requisitos ─────────────────────────────────────
    requisitosModal: RequisitosModal = this.requisitosModalVacio();

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

    private requisitosModalVacio(): RequisitosModal {
        return {
            visible: false, cargando: false, error: '',
            cedula: '', nombres: '', items: [],
            totalCumple: 0, totalNoCumple: 0
        };
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
        this.migrandoTelegram = false;
        this.origenVinculados = 'grupos';
        this.vistaDocente = 'lista';
        this.docentes = [];
        this.docentesFiltrados = [];
        this.busquedaDocentes = '';
        this.docenteSeleccionado = null;
        this.carrerasDisponibles = [];
        this.filtroCarreras = new Set<string>();
        this.ordenarPorCarrera = false;
        this.requisitosModal = this.requisitosModalVacio();
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
            const { doc, getDoc } = await import('firebase/firestore');
            const { getUtetFirestore } = await import('../../firebase/utet-firestore');
            const db = getUtetFirestore();
            const snap = await getDoc(doc(db, 'Estudiantes', e.cedula!));

            if (!snap.exists()) {
                this.requisitosModal = {
                    ...this.requisitosModal,
                    cargando: false,
                    error: 'No se encontró el registro de este estudiante en la base de datos.'
                };
                this.cdr.detectChanges();
                return;
            }

            const data = snap.data() as Record<string, any>;
            const items: { nombre: string; estado: string }[] = [];

            for (const [key, value] of Object.entries(data)) {
                // Solo procesar campos que sean exactamente "CUMPLE" o "NO CUMPLE"
                if (this.CAMPOS_NO_REQUISITO.has(key)) continue;
                if (value !== 'CUMPLE' && value !== 'NO CUMPLE') continue;
                items.push({ nombre: key, estado: value as string });
            }

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

    setFiltroNotifVinculados(f: 'TODOS' | 'ACTIVAS' | 'PENDIENTES' | 'SIN_TELEGRAM'): void {
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

            hoja['!cols'] = [
                { wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 26 },
                { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 18 }
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
    console.table(estudiantesConTelegram.map((p: any) => ({ cedula: p.cedula, nombres: p.nombres, telegramChatId: p.telegramChatId })));

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
                const ref = doc(db, 'Estudiantes', p.cedula);
                const snap = await getDoc(ref);

                console.log('¿Existe documento en Firestore?', snap.exists());

                if (!snap.exists()) {
                    console.warn('No se encontró el documento con ese ID exacto. Revisa el formato de la cédula.');
                    sinDocFirestore++;
                    console.groupEnd();
                    continue;
                }

                console.log('telegramChatId a escribir:', p.telegramChatId);
                await setDoc(ref, { telegramChatId: p.telegramChatId }, { merge: true });
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
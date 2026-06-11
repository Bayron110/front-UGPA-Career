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

    // ── Formularios ─────────────────────────────────────────────────────────
    manualDatos: ManualDatos = this.manualVacio();
    docenteForm: DocenteForm = this.docenteFormVacio();
    manualError = '';

    // ── Estado de carga ─────────────────────────────────────────────────────
    cargando = false;
    guardando = false;

    // ── Computed: personas vinculadas al cronograma actual ──────────────────
    get personasVinculadas(): any[] {
        const estudiantes = Object.values((this.cronograma as any)?.estudiantesVinculados ?? {})
            .map((e: any) => ({ ...e, tipo: 'estudiante' }));
        const docentes = Object.values((this.cronograma as any)?.docentesVinculados ?? {})
            .map((d: any) => ({ ...d, tipo: 'docente' }));
        return [...docentes, ...estudiantes];
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
            return coincideTipo && coincideTexto;
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
        this.tipoPersona = 'estudiante';
        this.manualDatos = this.manualVacio();
        this.docenteForm = this.docenteFormVacio();
        this.manualError = '';
        this.cargando = false;
        this.guardando = false;
        this.busquedaVinculados = '';
        this.filtroTipoVinculado = 'TODOS';
        this.origenVinculados = 'grupos';
        this.vistaDocente = 'lista';
        this.docentes = [];
        this.docentesFiltrados = [];
        this.busquedaDocentes = '';
        this.docenteSeleccionado = null;
    }

    // ── Vinculados ──────────────────────────────────────────────────────────
    irAVinculados(): void {
        this.origenVinculados = this.vista === 'estudiantes' ? 'estudiantes' : 'grupos';
        this.busquedaVinculados = '';
        this.filtroTipoVinculado = 'TODOS';
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

    async desvincular(persona: any): Promise<void> {
        if (!this.cronograma?.id) return;
        const tipoTexto = persona.tipo === 'docente' ? 'docente' : 'estudiante';
        if (!confirm(`¿Desvincular a ${persona.nombres} (${tipoTexto})?`)) return;

        try {
            if (persona.tipo === 'docente') {
                // Usa el service para mantener sincronía con /docentes
                await this.docentesService.desvincularDeCronograma(
                    persona.cedula,
                    this.cronograma.id!,
                    (id, datos) => this.cronogramaService.actualizarCronograma(id, datos)
                );
                // Reflejar en el objeto local
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

            // Reflejar localmente para que la vista "Vinculados" se actualice al instante
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

        // Verificar duplicado en /docentes
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

            // 1. Guardar en /docentes
            await this.docentesService.guardarDocente(nuevoDocente);

            // 2. Vincular al cronograma actual
            await this.docentesService.vincularAcronograma(
                nuevoDocente,
                this.cronograma.id!,
                (id, datos) => this.cronogramaService.actualizarCronograma(id, datos)
            );

            // Reflejar localmente
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
        this.estudiantesFiltrados = this.estudiantes.filter(e => {
            const texto = !q ||
                e.cedula?.toLowerCase().includes(q) ||
                e.nombres?.toLowerCase().includes(q) ||
                e.carrera?.toLowerCase().includes(q);
            const asist =
                this.filtroAsistencia === 'TODOS' ||
                (this.filtroAsistencia === 'PRESENTE' && e.asistencia) ||
                (this.filtroAsistencia === 'AUSENTE' && !e.asistencia);
            return texto && asist;
        });
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
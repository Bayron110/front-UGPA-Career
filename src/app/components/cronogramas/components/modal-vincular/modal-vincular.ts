import {
    Component, Input, Output, EventEmitter,
    OnChanges, SimpleChanges, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { EstudiantesService, Estudiante, GrupoInduccion } from '../../firebase/estudiante';
import { CronogramaService, Cronograma } from '../../firebase/cronogramas';

type Vista = 'grupos' | 'estudiantes' | 'manual' | 'vinculados';
type TipoPersona = 'estudiante' | 'docente';

interface ManualDatos {
    cedula: string;
    nombres: string;
    carrera: string;
    telegramUser: string;
    grupo: string;
    asistencia: boolean;
}

interface DocenteDatos {
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

    // ── Paso 1: grupos ─────────────────────────────────────
    vista: Vista = 'grupos';
    grupos: GrupoInduccion[] = [];
    grupoSeleccionado: GrupoInduccion | null = null;

    // ── Paso 2: estudiantes ────────────────────────────────
    estudiantes: Estudiante[] = [];
    estudiantesFiltrados: Estudiante[] = [];
    seleccionados = new Set<string>();
    busqueda = '';
    filtroAsistencia: 'TODOS' | 'PRESENTE' | 'AUSENTE' = 'TODOS';

    // ── Paso 3: tipo de persona ────────────────────────────
    tipoPersona: TipoPersona = 'estudiante';
    origenManual: 'grupos' | 'estudiantes' = 'grupos';
    // ── Paso: vinculados ───────────────────────────────────
    origenVinculados: 'grupos' | 'estudiantes' = 'grupos';
    busquedaVinculados = '';
    filtroTipoVinculado: 'TODOS' | 'ESTUDIANTES' | 'DOCENTES' = 'TODOS';

    // Datos formulario estudiante
    manualDatos: ManualDatos = this.manualVacio();
    manualError = '';

    // Datos formulario docente
    docenteDatos: DocenteDatos = this.docenteVacio();

    // Cronogramas para el selector del docente
    todosCronogramas: Cronograma[] = [];
    cronogramasSeleccionados = new Set<string>();
    cargandoCronogramas = false;
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
    cargando = false;
    guardando = false;

    constructor(
        private estudiantesService: EstudiantesService,
        private cronogramaService: CronogramaService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['visible']?.currentValue === true) {
            this.resetear();
            this.cargarGrupos();
        }
    }

    // ── Vaciadores ─────────────────────────────────────────
    private manualVacio(): ManualDatos {
        return { cedula: '', nombres: '', carrera: '', telegramUser: '', grupo: '', asistencia: false };
    }

    private docenteVacio(): DocenteDatos {
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
        this.docenteDatos = this.docenteVacio();
        this.manualError = '';
        this.todosCronogramas = [];
        this.cronogramasSeleccionados.clear();
        this.cargando = false;
        this.guardando = false;
        this.busquedaVinculados = '';
        this.filtroTipoVinculado = 'TODOS';
        this.origenVinculados = 'grupos';
    }

    // ── Toggle tipo persona ────────────────────────────────
    setTipo(tipo: TipoPersona): void {
        this.tipoPersona = tipo;
        this.manualError = '';

        // Si cambia a docente, cargar lista de cronogramas
        if (tipo === 'docente' && this.todosCronogramas.length === 0) {
            this.cargarTodosCronogramas();
        }
        this.cdr.detectChanges();
    }

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

    async desvincular(persona: any): Promise<void> {
        if (!this.cronograma?.id) return;

        const tipoTexto = persona.tipo === 'docente' ? 'docente' : 'estudiante';
        if (!confirm(`¿Desvincular a ${persona.nombres} (${tipoTexto})?`)) return;

        try {
            if (persona.tipo === 'docente') {
                const actuales = { ...((this.cronograma as any)?.docentesVinculados ?? {}) };
                delete actuales[persona.cedula];
                await this.cronogramaService.actualizarCronograma(
                    this.cronograma.id!,
                    { docentesVinculados: actuales } as any
                );
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

    setFiltroTipoVinculado(f: 'TODOS' | 'ESTUDIANTES' | 'DOCENTES'): void {
        this.filtroTipoVinculado = f;
        this.cdr.detectChanges();
    }
    // ── Estado visual del cronograma en el selector ────────
    estadoCrono(c: Cronograma): string {
        return this.cronogramaService.calcularEstado(c.fechaInicio, c.fechaFin);
    }

    // ── Toggle cronograma en el selector ──────────────────
    toggleCronograma(id: string): void {
        this.cronogramasSeleccionados.has(id)
            ? this.cronogramasSeleccionados.delete(id)
            : this.cronogramasSeleccionados.add(id);
    }

    // ── Cargar todos los cronogramas para el selector ──────
    private async cargarTodosCronogramas(): Promise<void> {
        this.cargandoCronogramas = true;
        this.cdr.detectChanges();
        try {
            this.todosCronogramas = await this.cronogramaService.obtenerCronogramas();
        } catch (e) {
            console.error('Error cargando cronogramas:', e);
            this.todosCronogramas = [];
        } finally {
            this.cargandoCronogramas = false;
            this.cdr.detectChanges();
        }
    }

    // ── Helpers ya vinculado ───────────────────────────────
    estaVinculado(e: Estudiante): boolean {
        if (!e.cedula) return false;
        const mapa = (this.cronograma as any)?.estudiantesVinculados ?? {};
        return !!mapa[e.cedula];
    }

    // ── Paso 1: cargar grupos ──────────────────────────────
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

    // ── Paso 2: filtros y selección ────────────────────────
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

    // ── Vincular estudiantes desde lista ───────────────────
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

    // ── Ingreso manual estudiante ──────────────────────────
    irAManual(): void {
        this.origenManual = this.vista === 'estudiantes' ? 'estudiantes' : 'grupos';
        this.manualDatos = this.manualVacio();
        this.docenteDatos = this.docenteVacio();
        this.cronogramasSeleccionados.clear();
        if (this.grupoSeleccionado) {
            this.manualDatos.grupo = this.grupoSeleccionado.nombres;
        }
        this.manualError = '';
        this.tipoPersona = 'estudiante';
        this.vista = 'manual';
        this.cdr.detectChanges();
    }

    volverDesdeManual(): void {
        this.manualError = '';
        this.manualDatos = this.manualVacio();
        this.docenteDatos = this.docenteVacio();
        this.cronogramasSeleccionados.clear();
        this.vista = this.origenManual;
        this.cdr.detectChanges();
    }

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

    // ── Guardar docente ────────────────────────────────────
    async vincularDocente(): Promise<void> {
        this.manualError = '';
        const cedula = this.docenteDatos.cedula.trim();
        const nombres = this.docenteDatos.nombres.trim();
        const cargo = this.docenteDatos.cargo.trim();

        if (!cedula || !nombres || !cargo) {
            this.manualError = 'Cédula, nombre y cargo son obligatorios.';
            return;
        }
        if (this.cronogramasSeleccionados.size === 0) {
            this.manualError = 'Selecciona al menos un cronograma para el docente.';
            return;
        }

        this.guardando = true;
        this.cdr.detectChanges();

        try {
            const nuevoDocente = {
                cedula,
                nombres,
                cargo,
                departamento: this.docenteDatos.departamento.trim() || '',
                fechaVinculacion: new Date().toISOString(),
                cronogramasAsignados: Array.from(this.cronogramasSeleccionados),
                esDocente: true
            };

            // Guardar en cada cronograma seleccionado bajo el nodo docentesVinculados
            const updates: Promise<void>[] = Array.from(this.cronogramasSeleccionados).map(cronoId => {
                return this.cronogramaService.obtenerCronograma(cronoId).then(crono => {
                    if (!crono) return;
                    const docentesActuales = (crono as any)?.docentesVinculados ?? {};
                    return this.cronogramaService.actualizarCronograma(cronoId, {
                        docentesVinculados: { ...docentesActuales, [cedula]: nuevoDocente }
                    } as any);
                });
            });

            await Promise.all(updates);

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

    // ── Cierre ─────────────────────────────────────────────
    cerrar(): void { this.cerrarEvento.emit(); }

    cerrarSiFuera(event: MouseEvent): void {
        if ((event.target as HTMLElement).classList.contains('overlay')) {
            this.cerrar();
        }
    }
}
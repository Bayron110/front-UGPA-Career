import {
    Component, Input, Output, EventEmitter,
    OnChanges, SimpleChanges, ChangeDetectorRef,
    ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { EstudiantesService, Estudiante, GrupoInduccion } from '../../firebase/estudiante';
import { CronogramaService, Cronograma } from '../../firebase/cronogramas';

type Vista = 'grupos' | 'estudiantes';

@Component({
    selector: 'app-modal-vincular',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './modal-vincular.html',
    styleUrl: './modal-vincular.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalVincular implements OnChanges {

    @Input()  visible: boolean = false;
    @Input()  cronograma: Cronograma | null = null;
    @Output() cerrarEvento    = new EventEmitter<void>();
    @Output() vinculadoEvento = new EventEmitter<number>();

    // ── Paso 1: grupos ──
    vista: Vista = 'grupos';
    grupos: GrupoInduccion[] = [];
    grupoSeleccionado: GrupoInduccion | null = null;

    // ── Paso 2: estudiantes ──
    estudiantes: Estudiante[] = [];
    estudiantesFiltrados: Estudiante[] = [];
    seleccionados = new Set<string>();
    busqueda = '';
    filtroAsistencia: 'TODOS' | 'PRESENTE' | 'AUSENTE' = 'TODOS';

    cargando = false;
    guardando = false;

    constructor(
        private estudiantesService: EstudiantesService,
        private cronogramaService: CronogramaService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['visible']?.currentValue === true) {
            this.resetear();
            this.cargarGrupos();
        }
    }

    private resetear(): void {
        this.vista               = 'grupos';
        this.grupos              = [];
        this.grupoSeleccionado   = null;
        this.estudiantes         = [];
        this.estudiantesFiltrados = [];
        this.seleccionados.clear();
        this.busqueda            = '';
        this.filtroAsistencia    = 'TODOS';
    }

    // ── Helpers ya vinculado ──────────────────────────────

    /** Devuelve true si la cédula del estudiante ya está en estudiantesVinculados */
    estaVinculado(e: Estudiante): boolean {
        if (!e.cedula) return false;
        const mapa = (this.cronograma as any)?.estudiantesVinculados ?? {};
        return !!mapa[e.cedula];
    }

    // ── Paso 1: cargar grupos ─────────────────────────────

    private async cargarGrupos(): Promise<void> {
        this.cargando = true;
        this.cdr.markForCheck();
        try {
            this.grupos = await this.estudiantesService.obtenerGrupos();
        } catch (e) {
            console.error('Error cargando grupos:', e);
        } finally {
            this.cargando = false;
            this.cdr.markForCheck();
        }
    }

    async seleccionarGrupo(grupo: GrupoInduccion): Promise<void> {
        this.grupoSeleccionado = grupo;
        this.cargando = true;
        this.vista = 'estudiantes';
        this.cdr.markForCheck();
        try {
            this.estudiantes = await this.estudiantesService
                .obtenerEstudiantesDeGrupo(grupo.id);
            this.filtrar();
        } catch (e) {
            console.error('Error cargando estudiantes:', e);
        } finally {
            this.cargando = false;
            this.cdr.markForCheck();
        }
    }

    volverAGrupos(): void {
        this.vista              = 'grupos';
        this.grupoSeleccionado  = null;
        this.estudiantes        = [];
        this.estudiantesFiltrados = [];
        this.seleccionados.clear();
        this.cdr.markForCheck();
    }

    // ── Paso 2: filtros y selección ───────────────────────

    filtrar(): void {
        const q = this.busqueda.toLowerCase().trim();
        this.estudiantesFiltrados = this.estudiantes.filter(e => {
            const texto = !q ||
                e.cedula?.toLowerCase().includes(q) ||
                e.nombres?.toLowerCase().includes(q) ||
                e.carrera?.toLowerCase().includes(q);
            const asist =
                this.filtroAsistencia === 'TODOS' ||
                (this.filtroAsistencia === 'PRESENTE' &&  e.asistencia) ||
                (this.filtroAsistencia === 'AUSENTE'  && !e.asistencia);
            return texto && asist;
        });
        this.cdr.markForCheck();
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
        this.cdr.markForCheck();
    }

    toggleTodos(event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        if (checked) {
            // Solo selecciona los que NO están ya vinculados
            this.estudiantesFiltrados
                .filter(e => !this.estaVinculado(e))
                .forEach(e => { if (e.id) this.seleccionados.add(e.id); });
        } else {
            this.seleccionados.clear();
        }
        this.cdr.markForCheck();
    }

    todosSeleccionados(): boolean {
        const disponibles = this.estudiantesFiltrados.filter(e => !this.estaVinculado(e));
        return disponibles.length > 0 &&
            disponibles.every(e => this.seleccionados.has(e.id!));
    }

    // ── Vincular ──────────────────────────────────────────

    async vincular(): Promise<void> {
        if (!this.cronograma?.id || this.seleccionados.size === 0) return;
        this.guardando = true;
        this.cdr.markForCheck();
        try {
            const aVincular = this.estudiantes
                .filter(e => this.seleccionados.has(e.id!))
                .map(e => ({
                    cedula:           e.cedula,
                    nombres:           e.nombres,
                    carrera:          e.carrera,
                    telegramUser:     e.telegramUser ?? '',
                    asistencia:       e.asistencia   ?? false,
                    grupo:            this.grupoSeleccionado?.nombres ?? '',
                    fechaVinculacion: new Date().toISOString()
                }));

            const vinculadosActuales =
                (this.cronograma as any).estudiantesVinculados ?? {};

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
            this.cdr.markForCheck();
        }
    }

    cerrar(): void { this.cerrarEvento.emit(); }

    cerrarSiFuera(event: MouseEvent): void {
        if ((event.target as HTMLElement).classList.contains('overlay')) {
            this.cerrar();
        }
    }
}
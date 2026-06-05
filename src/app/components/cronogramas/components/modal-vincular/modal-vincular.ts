import {
    Component, Input, Output, EventEmitter,
    OnChanges, SimpleChanges, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { EstudiantesService, Estudiante, GrupoInduccion } from '../../firebase/estudiante';
import { CronogramaService, Cronograma } from '../../firebase/cronogramas';

type Vista = 'grupos' | 'estudiantes' | 'manual';

interface ManualDatos {
    cedula:      string;
    nombres:     string;
    carrera:     string;
    telegramUser: string;
    grupo:       string;
    asistencia:  boolean;
}

@Component({
    selector: 'app-modal-vincular',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './modal-vincular.html',
    styleUrl: './modal-vincular.css'
    // ✅ Sin ChangeDetectionStrategy.OnPush — Default detecta cambios en tiempo real
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

    // ── Paso 3: manual ──
    origenManual: 'grupos' | 'estudiantes' = 'grupos';
    manualDatos: ManualDatos = this.manualVacio();
    manualError = '';

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

    private manualVacio(): ManualDatos {
        return {
            cedula:      '',
            nombres:     '',
            carrera:     '',
            telegramUser: '',
            grupo:       '',
            asistencia:  false
        };
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
        this.manualDatos         = this.manualVacio();
        this.manualError         = '';
        this.cargando            = false;
        this.guardando           = false;
    }

    // ── Helpers ya vinculado ──────────────────────────────

    estaVinculado(e: Estudiante): boolean {
        if (!e.cedula) return false;
        const mapa = (this.cronograma as any)?.estudiantesVinculados ?? {};
        return !!mapa[e.cedula];
    }

    // ── Paso 1: cargar grupos ─────────────────────────────

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
            this.cdr.detectChanges(); // ✅ detectChanges en lugar de markForCheck
        }
    }

    async seleccionarGrupo(grupo: GrupoInduccion): Promise<void> {
        this.grupoSeleccionado = grupo;
        this.cargando = true;
        this.vista = 'estudiantes';
        this.cdr.detectChanges();
        try {
            this.estudiantes = await this.estudiantesService
                .obtenerEstudiantesDeGrupo(grupo.id);
            this.filtrar();
        } catch (e) {
            console.error('Error cargando estudiantes:', e);
            this.estudiantes = [];
            this.estudiantesFiltrados = [];
        } finally {
            this.cargando = false;
            this.cdr.detectChanges(); // ✅ garantiza que el spinner desaparece
        }
    }

    volverAGrupos(): void {
        this.vista              = 'grupos';
        this.grupoSeleccionado  = null;
        this.estudiantes        = [];
        this.estudiantesFiltrados = [];
        this.seleccionados.clear();
        this.cdr.detectChanges();
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

    // ── Vincular desde lista ──────────────────────────────

    async vincular(): Promise<void> {
        if (!this.cronograma?.id || this.seleccionados.size === 0) return;
        this.guardando = true;
        this.cdr.detectChanges();
        try {
            const aVincular = this.estudiantes
                .filter(e => this.seleccionados.has(e.id!))
                .map(e => ({
                    cedula:           e.cedula,
                    nombres:          e.nombres,
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
            this.cdr.detectChanges();
        }
    }

    // ── Paso 3: ingreso manual ────────────────────────────

    irAManual(): void {
        // Guarda desde dónde vino para el botón "volver"
        this.origenManual = this.vista === 'estudiantes' ? 'estudiantes' : 'grupos';
        // Pre-rellena el grupo si hay uno seleccionado
        this.manualDatos = this.manualVacio();
        if (this.grupoSeleccionado) {
            this.manualDatos.grupo = this.grupoSeleccionado.nombres;
        }
        this.manualError = '';
        this.vista = 'manual';
        this.cdr.detectChanges();
    }

    volverDesdeManual(): void {
        this.manualError = '';
        this.manualDatos = this.manualVacio();
        this.vista = this.origenManual;
        this.cdr.detectChanges();
    }

    async vincularManual(): Promise<void> {
        this.manualError = '';

        const cedula   = this.manualDatos.cedula.trim();
        const nombres  = this.manualDatos.nombres.trim();

        if (!cedula || !nombres) {
            this.manualError = 'La cédula y el nombre son obligatorios.';
            return;
        }

        if (!this.cronograma?.id) return;

        // Verificar duplicado
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
                carrera:          this.manualDatos.carrera.trim()      || '',
                telegramUser:     this.manualDatos.telegramUser.trim()  || '',
                asistencia:       this.manualDatos.asistencia,
                grupo:            this.manualDatos.grupo.trim()         || '',
                fechaVinculacion: new Date().toISOString(),
                ingresadoManual:  true
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

    // ── Cierre ────────────────────────────────────────────

    cerrar(): void { this.cerrarEvento.emit(); }

    cerrarSiFuera(event: MouseEvent): void {
        if ((event.target as HTMLElement).classList.contains('overlay')) {
            this.cerrar();
        }
    }
}
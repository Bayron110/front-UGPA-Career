import { getDatabase, ref, push, onValue, update, remove, set, Database } from 'firebase/database';
import { initializeApp } from 'firebase/app';
import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

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
export const db: Database = getDatabase(firebaseApp);


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


export class FamiliasLogic {

    familias: Familia[] = [];
    pendientesFamilia: PendienteFamilia[] = [];
    conteosPorFamilia: Record<string, { total: number; activos: number; completados: number }> = {};

    mostrarFormFamilia = false;
    mostrarModalFamilia = false;

    textoBusquedaPendientes = '';
    ordenPendientesAsc = true;

    familiaSeleccionada: Familia | null = null;
    familiaEditando: Familia | null = null;
    pendienteEditando: PendienteFamilia | null = null;

    menuFamiliaAbierto: string | null = null;
    menuPendienteAbierto: string | null = null;

    familiaColorSeleccionado = FAMILIA_COLORES[0].valor;
    familiaIconoSeleccionado = FAMILIA_ICONOS[0];
    readonly familiaColores = FAMILIA_COLORES;
    readonly familiaIconos = FAMILIA_ICONOS;

    formFamilia!: FormGroup;
    formPendiente!: FormGroup;

    protected unsubFamilias: (() => void) | null = null;
    protected unsubPendientes: (() => void) | null = null;
    protected unsubConteos: (() => void)[] = [];

    protected cdr!: ChangeDetectorRef;
    protected fb!: FormBuilder;
    errorMsg = '';

    pushNotif(_mensaje: string, _tipo: 'warning' | 'info' | 'success' | 'danger'): void { }


    initFamiliasForm(): void {
        this.formFamilia = this.fb.group({
            nombre: ['', [Validators.required, Validators.minLength(2)]],
            descripcion: ['']
        });

        this.formPendiente = this.fb.group({
            nombre: ['', [Validators.required, Validators.minLength(2)]],
            descripcion: ['']
        });
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
                this.cdr.markForCheck();
            },
            error => {
                this.errorMsg = 'Error al cargar grupos: ' + error.message;
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
                        total: pendientes.length,
                        activos: pendientes.filter(p => !p.completado).length,
                        completados: pendientes.filter(p => p.completado).length
                    };

                    this.cdr.markForCheck();
                }
            );
            this.unsubConteos.push(unsub);
        });
    }

    escucharPendientesFamilia(familiaId: string): void {
        this.unsubPendientes?.();
        this.unsubPendientes = null;

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
            nombre: v.nombre,
            descripcion: v.descripcion || '',
            color: this.familiaColorSeleccionado,
            icono: this.familiaIconoSeleccionado
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
        this.menuPendienteAbierto = null;
        this.formPendiente.reset();
        this.unsubPendientes?.();
        this.unsubPendientes = null;
    }


    async guardarPendienteFamilia(): Promise<void> {
        if (!this.familiaSeleccionada) return;
        if (this.formPendiente.invalid) { this.formPendiente.markAllAsTouched(); return; }

        const v = this.formPendiente.value;

        if (this.pendienteEditando) {
            await this.actualizarPendienteFamilia(this.familiaSeleccionada.id, this.pendienteEditando.id, {
                nombre: v.nombre,
                descripcion: v.descripcion || ''
            });
            this.pushNotif(`✏️ Pendiente actualizado: ${v.nombre}`, 'info');
        } else {
            const nuevoRef = push(ref(db, `familiaPendientes/${this.familiaSeleccionada.id}`));
            const nuevo: Omit<PendienteFamilia, 'id'> = {
                familiaId: this.familiaSeleccionada.id,
                nombre: v.nombre,
                descripcion: v.descripcion || '',
                completado: false,
                completadoEn: null,
                createdAt: Date.now()
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
            completado: nuevoEstado,
            completadoEn: nuevoEstado ? Date.now() : null
        });
        this.pushNotif(
            nuevoEstado ? `✅ Pendiente completado: ${p.nombre}` : `↩️ Pendiente reactivado: ${p.nombre}`,
            nuevoEstado ? 'success' : 'info'
        );
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

    getFamilia(id: string | null): Familia | undefined {
        if (!id) return undefined;
        return this.familias.find(f => f.id === id);
    }

    toggleOrdenPendientes(): void {
        this.ordenPendientesAsc = !this.ordenPendientesAsc;
        this.cdr.markForCheck();
    }

    limpiarBusquedaPendientes(): void {
        this.textoBusquedaPendientes = '';
        this.cdr.markForCheck();
    }

    toggleMenuFamilia(id: string): void {
        this.menuFamiliaAbierto = this.menuFamiliaAbierto === id ? null : id;
    }

    toggleMenuPendiente(id: string): void {
        this.menuPendienteAbierto = this.menuPendienteAbierto === id ? null : id;
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

    trackFamiliaId(_: number, f: Familia): string { return f.id; }
    trackPendienteId(_: number, p: PendienteFamilia): string { return p.id; }
}
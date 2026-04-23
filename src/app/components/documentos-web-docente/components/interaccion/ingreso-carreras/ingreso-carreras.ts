import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { onValue, ref, remove, set, update, off } from 'firebase/database';
import { dbDocente } from '../../../../../firebase/firebase-docente';

interface TemaData {
  titulo: string;
}

interface CapacitacionData {
  capacitacion: string;
  tipo: string;
  horas: number;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  teoriaTemas: TemaData[];
  practicaTemas: TemaData[];
}

interface CarreraItem {
  id: string;
  nombre: string;
  capacitaciones: { [key: string]: CapacitacionData };
  editando?: boolean;
  guardando?: boolean;
  eliminando?: boolean;
  agregandoCap?: boolean;
}

function temasVacios(n: number): TemaData[] {
  return Array.from({ length: n }, () => ({ titulo: '' }));
}

@Component({
  selector: 'app-ingreso-carreras',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ingreso-carreras.html',
  styleUrl: './ingreso-carreras.css'
})
export class IngresoCarrerasComponent implements OnInit, OnDestroy {

  // ── Formulario nueva carrera ──────────────────────────────────────
  nuevaCarrera = '';
  nuevaCapacitacion = '';
  nuevasHoras: number | null = null;
  nuevaFechaInicio = '';
  nuevaFechaFin = '';
  nuevoTipo = 'Aprobación';
  nuevaTeoriaTemas: TemaData[] = temasVacios(3);
  nuevaPracticaTemas: TemaData[] = temasVacios(3);

  // ── Formulario agregar capacitación a carrera existente ───────────
  capNuevaNombre = '';
  capNuevaHoras: number | null = null;
  capNuevaFechaInicio = '';
  capNuevaFechaFin = '';
  capNuevaTipo = 'Aprobación';
  capNuevaTeoriaTemas: TemaData[] = temasVacios(3);
  capNuevaPracticaTemas: TemaData[] = temasVacios(3);
  capNuevaCarreraId = '';
  guardandoCapNueva = false;

  // ── Edición inline ────────────────────────────────────────────────
  editNombre = '';
  editCapacitacion = '';
  editHoras: number | null = null;
  editFechaInicio = '';
  editFechaFin = '';
  editTipo = 'Aprobación';
  editCapKey = '';
  editTeoriaTemas: TemaData[] = temasVacios(3);
  editPracticaTemas: TemaData[] = temasVacios(3);

  // ── Estado ────────────────────────────────────────────────────────
  carreras: CarreraItem[] = [];
  filtro = '';
  cargando = true;
  guardando = false;
  mensaje = '';

  private refCarreras = ref(dbDocente, 'carreras');

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.escucharCarreras();
  }

  ngOnDestroy(): void {
    off(this.refCarreras);
  }

  // ── Listener ──────────────────────────────────────────────────────

  escucharCarreras(): void {
    this.cargando = true;

    onValue(this.refCarreras, (snap) => {
      const editandoIds = new Set(this.carreras.filter(c => c.editando).map(c => c.id));
      const guardandoIds = new Set(this.carreras.filter(c => c.guardando).map(c => c.id));
      const eliminandoIds = new Set(this.carreras.filter(c => c.eliminando).map(c => c.id));
      const agregandoIds = new Set(this.carreras.filter(c => c.agregandoCap).map(c => c.id));

      if (!snap.exists()) {
        this.carreras = [];
        this.cargando = false;
        this.cdr.detectChanges();
        return;
      }

      const data = snap.val();

      this.carreras = Object.entries(data)
        .map(([id, value]: any) => {
          const caps: { [key: string]: CapacitacionData } = {};

          if (value.capacitaciones) {
            Object.entries(value.capacitaciones).forEach(([k, v]: any) => {
              caps[k] = {
                capacitacion: v.capacitacion || '',
                tipo: v.tipo || 'Aprobación',
                horas: Number(v.horas || 0),
                fechaInicio: v.fechaInicio || '',
                fechaFin: v.fechaFin || '',
                estado: this.calcularEstado(v.fechaInicio || '', v.fechaFin || ''),
                teoriaTemas: Array.isArray(v.teoriaTemas)
                  ? v.teoriaTemas.map((t: any) => ({ titulo: t?.titulo || '' }))
                  : temasVacios(3),
                practicaTemas: Array.isArray(v.practicaTemas)
                  ? v.practicaTemas.map((t: any) => ({ titulo: t?.titulo || '' }))
                  : temasVacios(3)
              };
            });
          }

          return {
            id,
            nombre: value.nombre || '',
            capacitaciones: caps,
            editando: editandoIds.has(id),
            guardando: guardandoIds.has(id),
            eliminando: eliminandoIds.has(id),
            agregandoCap: agregandoIds.has(id)
          };
        })
        .sort((a, b) => Number(a.id) - Number(b.id));

      this.cargando = false;
      this.cdr.detectChanges();
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────

  get carrerasFiltradas(): CarreraItem[] {
    const t = this.filtro.trim().toLowerCase();
    if (!t) return this.carreras;

    return this.carreras.filter(item =>
      item.nombre.toLowerCase().includes(t) ||
      Object.values(item.capacitaciones).some(c =>
        c.capacitacion.toLowerCase().includes(t) ||
        c.estado.toLowerCase().includes(t)
      )
    );
  }

  formularioValido(): boolean {
    const teoriOk = this.nuevaTeoriaTemas.every(t =>
      t.titulo.trim() && this.contarPalabras(t.titulo) <= 10
    );

    const pracOk = this.nuevaPracticaTemas.every(t =>
      t.titulo.trim() && this.contarPalabras(t.titulo) <= 10
    );

    return !!(
      this.nuevaCarrera.trim() &&
      this.nuevaCapacitacion.trim() &&
      this.nuevasHoras &&
      this.nuevasHoras > 0 &&
      this.nuevaFechaInicio &&
      this.nuevaFechaFin &&
      this.nuevoTipo.trim() &&
      teoriOk &&
      pracOk
    );
  }

  formularioCapNuevaValido(): boolean {
    const teoriOk = this.capNuevaTeoriaTemas.every(t =>
      t.titulo.trim() && this.contarPalabras(t.titulo) <= 10
    );

    const pracOk = this.capNuevaPracticaTemas.every(t =>
      t.titulo.trim() && this.contarPalabras(t.titulo) <= 10
    );

    return !!(
      this.capNuevaNombre.trim() &&
      this.capNuevaHoras &&
      this.capNuevaHoras > 0 &&
      this.capNuevaFechaInicio &&
      this.capNuevaFechaFin &&
      this.capNuevaTipo.trim() &&
      teoriOk &&
      pracOk
    );
  }

  obtenerSiguienteId(): string {
    if (!this.carreras.length) return '1';
    const ids = this.carreras.map(c => Number(c.id)).filter(n => !isNaN(n));
    return ids.length ? String(Math.max(...ids) + 1) : '1';
  }

  siguienteCapKey(caps: { [key: string]: any }): string {
    const keys = Object.keys(caps).map(Number).filter(n => !isNaN(n));
    return keys.length ? String(Math.max(...keys) + 1) : '1';
  }

  capComoArray(caps: { [key: string]: CapacitacionData }): { key: string; data: CapacitacionData }[] {
    return Object.entries(caps)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([key, data]) => ({ key, data }));
  }

  limpiarFormulario(): void {
    this.nuevaCarrera = '';
    this.nuevaCapacitacion = '';
    this.nuevasHoras = null;
    this.nuevaFechaInicio = '';
    this.nuevaFechaFin = '';
    this.nuevoTipo = 'Aprobación';
    this.nuevaTeoriaTemas = temasVacios(3);
    this.nuevaPracticaTemas = temasVacios(3);
  }

  limpiarFormCapNueva(): void {
    this.capNuevaNombre = '';
    this.capNuevaHoras = null;
    this.capNuevaFechaInicio = '';
    this.capNuevaFechaFin = '';
    this.capNuevaTipo = 'Aprobación';
    this.capNuevaTeoriaTemas = temasVacios(3);
    this.capNuevaPracticaTemas = temasVacios(3);
  }

  calcularEstado(fechaInicio: string, fechaFin: string): string {
    if (!fechaInicio || !fechaFin) return 'Pendiente';

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const inicio = new Date(`${fechaInicio}T00:00:00`);
    const fin = new Date(`${fechaFin}T00:00:00`);

    if (hoy < inicio) return 'Pendiente';
    if (hoy <= fin) return 'Iniciada';
    return 'Terminada';
  }

  limitarTituloA10Palabras(texto: string): string {
    if (!texto || !texto.trim()) return '';
    return texto.trim().split(/\s+/).slice(0, 10).join(' ');
  }

  normalizarTemas(temas: TemaData[]): TemaData[] {
    return temas.map(t => ({
      titulo: this.limitarTituloA10Palabras(t.titulo)
    }));
  }

  // ── Agregar capacitación extra ────────────────────────────────────

  mostrarFormCapNueva(item: CarreraItem): void {
    this.carreras.forEach(c => c.agregandoCap = false);
    this.limpiarFormCapNueva();
    this.capNuevaCarreraId = item.id;
    item.agregandoCap = true;
    this.cdr.detectChanges();
  }

  cancelarCapNueva(item: CarreraItem): void {
    item.agregandoCap = false;
    this.limpiarFormCapNueva();
    this.cdr.detectChanges();
  }

  async guardarCapNueva(item: CarreraItem): Promise<void> {
    this.capNuevaTeoriaTemas = this.normalizarTemas(this.capNuevaTeoriaTemas);
    this.capNuevaPracticaTemas = this.normalizarTemas(this.capNuevaPracticaTemas);

    if (!this.formularioCapNuevaValido()) {
      this.mostrarMensaje('❌ Complete todos los campos de la nueva capacitación');
      return;
    }

    if (this.capNuevaFechaFin < this.capNuevaFechaInicio) {
      this.mostrarMensaje('❌ La fecha de fin no puede ser menor a la de inicio');
      return;
    }

    this.guardandoCapNueva = true;
    this.cdr.detectChanges();

    try {
      const nuevaKey = this.siguienteCapKey(item.capacitaciones);

      const nuevaCap: CapacitacionData = {
        capacitacion: this.capNuevaNombre.trim(),
        tipo: this.capNuevaTipo,
        horas: this.capNuevaHoras || 0,
        fechaInicio: this.capNuevaFechaInicio,
        fechaFin: this.capNuevaFechaFin,
        estado: this.calcularEstado(this.capNuevaFechaInicio, this.capNuevaFechaFin),
        teoriaTemas: this.capNuevaTeoriaTemas.map(t => ({
          titulo: this.limitarTituloA10Palabras(t.titulo)
        })),
        practicaTemas: this.capNuevaPracticaTemas.map(t => ({
          titulo: this.limitarTituloA10Palabras(t.titulo)
        }))
      };

      await set(ref(dbDocente, `carreras/${item.id}/capacitaciones/${nuevaKey}`), nuevaCap);

      item.agregandoCap = false;
      this.limpiarFormCapNueva();
      this.mostrarMensaje('✅ Capacitación agregada correctamente');
    } catch (e) {
      console.error(e);
      this.mostrarMensaje('❌ Error al agregar la capacitación');
    } finally {
      this.guardandoCapNueva = false;
      this.cdr.detectChanges();
    }
  }

  // ── Guardar nueva carrera ─────────────────────────────────────────

  async guardarCarrera(): Promise<void> {
    this.nuevaTeoriaTemas = this.normalizarTemas(this.nuevaTeoriaTemas);
    this.nuevaPracticaTemas = this.normalizarTemas(this.nuevaPracticaTemas);

    if (!this.formularioValido()) {
      this.mostrarMensaje('❌ Complete todos los campos requeridos');
      return;
    }

    if (this.nuevaFechaFin < this.nuevaFechaInicio) {
      this.mostrarMensaje('❌ La fecha de fin no puede ser menor a la de inicio');
      return;
    }

    const nombreNorm = this.nuevaCarrera.trim();

    if (this.carreras.some(c => c.nombre.toLowerCase() === nombreNorm.toLowerCase())) {
      this.mostrarMensaje('⚠️ Esa carrera ya existe');
      return;
    }

    this.guardando = true;
    this.cdr.detectChanges();

    try {
      const cap: CapacitacionData = {
        capacitacion: this.nuevaCapacitacion.trim(),
        tipo: this.nuevoTipo,
        horas: this.nuevasHoras || 0,
        fechaInicio: this.nuevaFechaInicio,
        fechaFin: this.nuevaFechaFin,
        estado: this.calcularEstado(this.nuevaFechaInicio, this.nuevaFechaFin),
        teoriaTemas: this.nuevaTeoriaTemas.map(t => ({
          titulo: this.limitarTituloA10Palabras(t.titulo)
        })),
        practicaTemas: this.nuevaPracticaTemas.map(t => ({
          titulo: this.limitarTituloA10Palabras(t.titulo)
        }))
      };

      await set(ref(dbDocente, `carreras/${this.obtenerSiguienteId()}`), {
        nombre: nombreNorm,
        capacitaciones: { '1': cap }
      });

      this.limpiarFormulario();
      this.mostrarMensaje('✅ Carrera registrada correctamente');
    } catch (e) {
      console.error(e);
      this.mostrarMensaje('❌ Error al guardar la carrera');
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  // ── Edición ───────────────────────────────────────────────────────

  editarCarrera(item: CarreraItem): void {
    this.carreras.forEach(c => {
      c.editando = false;
      c.agregandoCap = false;
    });

    const caps = this.capComoArray(item.capacitaciones);
    const primera = caps[0];

    this.editNombre = item.nombre;
    this.editCapKey = primera?.key || '1';
    this.editCapacitacion = primera?.data.capacitacion || '';
    this.editHoras = primera?.data.horas || null;
    this.editFechaInicio = primera?.data.fechaInicio || '';
    this.editFechaFin = primera?.data.fechaFin || '';
    this.editTipo = primera?.data.tipo || 'Aprobación';
    this.editTeoriaTemas = primera?.data.teoriaTemas?.length
      ? primera.data.teoriaTemas.map(t => ({ titulo: t.titulo || '' }))
      : temasVacios(3);
    this.editPracticaTemas = primera?.data.practicaTemas?.length
      ? primera.data.practicaTemas.map(t => ({ titulo: t.titulo || '' }))
      : temasVacios(3);

    item.editando = true;
    this.cdr.detectChanges();
  }

  cancelarEdicion(item: CarreraItem): void {
    item.editando = false;
    this.cdr.detectChanges();
  }

  async actualizarCarrera(item: CarreraItem): Promise<void> {
    this.editTeoriaTemas = this.normalizarTemas(this.editTeoriaTemas);
    this.editPracticaTemas = this.normalizarTemas(this.editPracticaTemas);

    if (
      !this.editNombre.trim() ||
      !this.editCapacitacion.trim() ||
      !this.editHoras ||
      !this.editFechaInicio ||
      !this.editFechaFin ||
      !this.editTipo.trim()
    ) {
      this.mostrarMensaje('❌ Complete todos los campos');
      return;
    }

    const teoriaOk = this.editTeoriaTemas.every(t =>
      t.titulo.trim() && this.contarPalabras(t.titulo) <= 10
    );

    const practicaOk = this.editPracticaTemas.every(t =>
      t.titulo.trim() && this.contarPalabras(t.titulo) <= 10
    );

    if (!teoriaOk || !practicaOk) {
      this.mostrarMensaje('❌ Cada título debe tener máximo 10 palabras');
      return;
    }

    if (this.editFechaFin < this.editFechaInicio) {
      this.mostrarMensaje('❌ La fecha de fin no puede ser menor a la de inicio');
      return;
    }

    item.guardando = true;
    this.cdr.detectChanges();

    try {
      const capActualizada: CapacitacionData = {
        capacitacion: this.editCapacitacion.trim(),
        tipo: this.editTipo,
        horas: this.editHoras || 0,
        fechaInicio: this.editFechaInicio,
        fechaFin: this.editFechaFin,
        estado: this.calcularEstado(this.editFechaInicio, this.editFechaFin),
        teoriaTemas: this.editTeoriaTemas.map(t => ({
          titulo: this.limitarTituloA10Palabras(t.titulo)
        })),
        practicaTemas: this.editPracticaTemas.map(t => ({
          titulo: this.limitarTituloA10Palabras(t.titulo)
        }))
      };

      await update(ref(dbDocente, `carreras/${item.id}`), {
        nombre: this.editNombre.trim(),
        [`capacitaciones/${this.editCapKey}`]: capActualizada
      });

      item.editando = false;
      this.mostrarMensaje('✅ Carrera actualizada correctamente');
    } catch (e) {
      console.error(e);
      this.mostrarMensaje('❌ Error al actualizar');
    } finally {
      item.guardando = false;
      this.cdr.detectChanges();
    }
  }

  async eliminarCarrera(id: string): Promise<void> {
    if (!confirm('¿Está seguro de eliminar esta carrera?')) return;

    const item = this.carreras.find(c => c.id === id);
    if (item) {
      item.eliminando = true;
      this.cdr.detectChanges();
    }

    try {
      await remove(ref(dbDocente, `carreras/${id}`));
      this.mostrarMensaje('✅ Carrera eliminada correctamente');
    } catch (e) {
      console.error(e);
      this.mostrarMensaje('❌ Error al eliminar');
      if (item) {
        item.eliminando = false;
        this.cdr.detectChanges();
      }
    }
  }

  async eliminarCapacitacion(carreraId: string, capKey: string, totalCaps: number): Promise<void> {
    if (totalCaps <= 1) {
      this.mostrarMensaje('⚠️ No se puede eliminar la única capacitación de la carrera');
      return;
    }

    if (!confirm('¿Eliminar esta capacitación?')) return;

    try {
      await remove(ref(dbDocente, `carreras/${carreraId}/capacitaciones/${capKey}`));
      this.mostrarMensaje('✅ Capacitación eliminada');
    } catch (e) {
      console.error(e);
      this.mostrarMensaje('❌ Error al eliminar capacitación');
    }
  }

  contarPalabras(texto: string): number {
    if (!texto || !texto.trim()) return 0;
    return texto.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  private mostrarMensaje(texto: string): void {
    this.mensaje = texto;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.mensaje = '';
      this.cdr.detectChanges();
    }, 3500);
  }
}
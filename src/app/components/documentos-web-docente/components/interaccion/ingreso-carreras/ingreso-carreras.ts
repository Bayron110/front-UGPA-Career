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
  guardando?: boolean;
  eliminando?: boolean;
  limpiando?: boolean;
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

  // ── Formulario nueva carrera (solo nombre) ────────────────────────
  nuevaCarrera = '';

  // ── Modal capacitación ────────────────────────────────────────────
  modalCapVisible = false;
  carreraSeleccionada: CarreraItem | null = null;

  capNuevaNombre = '';
  capNuevaHoras: number | null = null;
  capNuevaFechaInicio = '';
  capNuevaFechaFin = '';
  capNuevaTipo = 'Aprobación';
  capNuevaTeoriaTemas: TemaData[] = temasVacios(3);
  capNuevaPracticaTemas: TemaData[] = temasVacios(3);
  guardandoCapNueva = false;

  // ── Modal editar nombre carrera ───────────────────────────────────
  modalEditarVisible = false;
  editNombre = '';

  // ── Mensajes ──────────────────────────────────────────────────────
  mensajeModal = '';

  // ── Estado general ────────────────────────────────────────────────
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

  // ── Listener Firebase ─────────────────────────────────────────────

  escucharCarreras(): void {
    this.cargando = true;

    onValue(this.refCarreras, (snap) => {
      // Preservar estados UI
      const guardandoIds = new Set(this.carreras.filter(c => c.guardando).map(c => c.id));
      const eliminandoIds = new Set(this.carreras.filter(c => c.eliminando).map(c => c.id));
      const limpiandoIds = new Set(this.carreras.filter(c => c.limpiando).map(c => c.id));

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
            guardando: guardandoIds.has(id),
            eliminando: eliminandoIds.has(id),
            limpiando: limpiandoIds.has(id)
          };
        })
        .sort((a, b) => Number(a.id) - Number(b.id));

      // Actualizar referencia del objeto seleccionado si el modal está abierto
      if (this.carreraSeleccionada) {
        const actualizado = this.carreras.find(c => c.id === this.carreraSeleccionada!.id);
        if (actualizado) this.carreraSeleccionada = actualizado;
      }

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

  formularioCapNuevaValido(): boolean {
    const teoriOk = this.capNuevaTeoriaTemas.every(
      t => t.titulo.trim() && this.contarPalabras(t.titulo) <= 10
    );
    const pracOk = this.capNuevaPracticaTemas.every(
      t => t.titulo.trim() && this.contarPalabras(t.titulo) <= 10
    );

    return !!(
      this.capNuevaNombre.trim() &&
      this.capNuevaHoras && this.capNuevaHoras > 0 &&
      this.capNuevaFechaInicio &&
      this.capNuevaFechaFin &&
      this.capNuevaTipo.trim() &&
      teoriOk && pracOk
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
    return Object.entries(caps || {})
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([key, data]) => ({ key, data }));
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

  contarPalabras(texto: string): number {
    if (!texto || !texto.trim()) return 0;
    return texto.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  limitarTituloA10Palabras(texto: string): string {
    if (!texto || !texto.trim()) return '';
    return texto.trim().split(/\s+/).slice(0, 10).join(' ');
  }

  normalizarTemas(temas: TemaData[]): TemaData[] {
    return temas.map(t => ({ titulo: this.limitarTituloA10Palabras(t.titulo) }));
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

  // ── Guardar nueva carrera (solo nombre) ───────────────────────────

  async guardarCarrera(): Promise<void> {
    const nombreNorm = this.nuevaCarrera.trim();
    if (!nombreNorm) return;

    if (this.carreras.some(c => c.nombre.toLowerCase() === nombreNorm.toLowerCase())) {
      this.mostrarMensaje('⚠️ Esa carrera ya existe');
      return;
    }

    this.guardando = true;
    this.cdr.detectChanges();

    try {
      await set(ref(dbDocente, `carreras/${this.obtenerSiguienteId()}`), {
        nombre: nombreNorm,
        capacitaciones: {}
      });

      this.nuevaCarrera = '';
      this.mostrarMensaje('✅ Carrera registrada correctamente');
    } catch (e) {
      console.error(e);
      this.mostrarMensaje('❌ Error al guardar la carrera');
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  // ── Modal capacitación ────────────────────────────────────────────

  abrirModalCapacitacion(item: CarreraItem): void {
    this.carreraSeleccionada = item;
    this.limpiarFormCapNueva();
    this.mensajeModal = '';
    this.modalCapVisible = true;
    this.cdr.detectChanges();
  }

  cerrarModalCap(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.cerrarModalCapDirecto();
    }
  }

  cerrarModalCapDirecto(): void {
    if (this.guardandoCapNueva) return;
    this.modalCapVisible = false;
    this.carreraSeleccionada = null;
    this.limpiarFormCapNueva();
    this.mensajeModal = '';
    this.cdr.detectChanges();
  }

  async guardarCapNueva(): Promise<void> {
    if (!this.carreraSeleccionada) return;

    this.capNuevaTeoriaTemas = this.normalizarTemas(this.capNuevaTeoriaTemas);
    this.capNuevaPracticaTemas = this.normalizarTemas(this.capNuevaPracticaTemas);

    if (!this.formularioCapNuevaValido()) {
      this.mostrarMensajeModal('❌ Complete todos los campos requeridos');
      return;
    }

    if (this.capNuevaFechaFin < this.capNuevaFechaInicio) {
      this.mostrarMensajeModal('❌ La fecha de fin no puede ser menor a la de inicio');
      return;
    }

    this.guardandoCapNueva = true;
    this.cdr.detectChanges();

    try {
      const nuevaKey = this.siguienteCapKey(this.carreraSeleccionada.capacitaciones);

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

      await set(
        ref(dbDocente, `carreras/${this.carreraSeleccionada.id}/capacitaciones/${nuevaKey}`),
        nuevaCap
      );

      this.modalCapVisible = false;
      this.limpiarFormCapNueva();
      this.mostrarMensaje('✅ Capacitación agregada correctamente');
    } catch (e) {
      console.error(e);
      this.mostrarMensajeModal('❌ Error al guardar la capacitación');
    } finally {
      this.guardandoCapNueva = false;
      this.cdr.detectChanges();
    }
  }

  // ── Limpiar todas las capacitaciones de una carrera ───────────────

  async limpiarCapacitaciones(item: CarreraItem): Promise<void> {
    const total = this.capComoArray(item.capacitaciones).length;
    if (total === 0) return;

    if (!confirm(`¿Está seguro de borrar todas las capacitaciones de "${item.nombre}"? Esta acción no se puede deshacer.`)) return;

    item.limpiando = true;
    this.cdr.detectChanges();

    try {
      await set(ref(dbDocente, `carreras/${item.id}/capacitaciones`), {});
      this.mostrarMensaje('✅ Capacitaciones eliminadas correctamente');
    } catch (e) {
      console.error(e);
      this.mostrarMensaje('❌ Error al limpiar las capacitaciones');
    } finally {
      item.limpiando = false;
      this.cdr.detectChanges();
    }
  }

  // ── Modal editar nombre carrera ───────────────────────────────────

  abrirModalEditarNombre(item: CarreraItem): void {
    this.carreraSeleccionada = item;
    this.editNombre = item.nombre;
    this.mensajeModal = '';
    this.modalEditarVisible = true;
    this.cdr.detectChanges();
  }

  cerrarModalEditar(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.cerrarModalEditarDirecto();
    }
  }

  cerrarModalEditarDirecto(): void {
    if (this.carreraSeleccionada?.guardando) return;
    this.modalEditarVisible = false;
    this.carreraSeleccionada = null;
    this.editNombre = '';
    this.mensajeModal = '';
    this.cdr.detectChanges();
  }

  async guardarNombreCarrera(): Promise<void> {
    if (!this.carreraSeleccionada || !this.editNombre.trim()) return;

    const nombreNorm = this.editNombre.trim();

    const duplicado = this.carreras.some(
      c => c.id !== this.carreraSeleccionada!.id &&
           c.nombre.toLowerCase() === nombreNorm.toLowerCase()
    );

    if (duplicado) {
      this.mostrarMensajeModal('⚠️ Ya existe una carrera con ese nombre');
      return;
    }

    this.carreraSeleccionada.guardando = true;
    this.cdr.detectChanges();

    try {
      await update(ref(dbDocente, `carreras/${this.carreraSeleccionada.id}`), {
        nombre: nombreNorm
      });

      this.modalEditarVisible = false;
      this.mostrarMensaje('✅ Nombre actualizado correctamente');
    } catch (e) {
      console.error(e);
      this.mostrarMensajeModal('❌ Error al actualizar el nombre');
    } finally {
      if (this.carreraSeleccionada) this.carreraSeleccionada.guardando = false;
      this.cdr.detectChanges();
    }
  }

  // ── Eliminar carrera ──────────────────────────────────────────────

  async eliminarCarrera(id: string): Promise<void> {
    if (!confirm('¿Está seguro de eliminar esta carrera y todas sus capacitaciones?')) return;

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

  // ── Eliminar capacitación individual ─────────────────────────────

  async eliminarCapacitacion(carreraId: string, capKey: string, totalCaps: number): Promise<void> {
    if (!confirm('¿Eliminar esta capacitación?')) return;

    try {
      await remove(ref(dbDocente, `carreras/${carreraId}/capacitaciones/${capKey}`));
      this.mostrarMensaje('✅ Capacitación eliminada');
    } catch (e) {
      console.error(e);
      this.mostrarMensaje('❌ Error al eliminar capacitación');
    }
  }

  // ── Mensajes ──────────────────────────────────────────────────────

  private mostrarMensaje(texto: string): void {
    this.mensaje = texto;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.mensaje = '';
      this.cdr.detectChanges();
    }, 3500);
  }

  private mostrarMensajeModal(texto: string): void {
    this.mensajeModal = texto;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.mensajeModal = '';
      this.cdr.detectChanges();
    }, 3500);
  }
}
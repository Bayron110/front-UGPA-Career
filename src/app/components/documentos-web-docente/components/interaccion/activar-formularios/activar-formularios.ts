import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { get, off, onValue, ref, set, update } from 'firebase/database';
import { dbDocente } from '../../../../../firebase/firebase-docente';

@Component({
  selector: 'app-activar-formularios',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './activar-formularios.html',
  styleUrl: './activar-formularios.css'
})
export class ActivarFormularios implements OnInit, OnDestroy {
  cargando = true;
  guardando = false; 
  mensaje = '';

  patrocinio = false;
  planIndividual = false;
  seguimientoDocente = false;

  private refActivador = ref(dbDocente, 'Activador');

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.crearNodoSiNoExiste();
    this.escucharCambios();
  }

  ngOnDestroy(): void {
    off(this.refActivador);
  }

  async crearNodoSiNoExiste(): Promise<void> {
    this.cargando = true;
    this.cdr.detectChanges();

    try {
      const snap = await get(this.refActivador);

      if (!snap.exists()) {
        await set(this.refActivador, {
          patrocinio: false,
          planIndividual: false,
          seguimientoDocente: false
        });
      }
    } catch (error) {
      console.error('Error creando nodo Activador:', error);
      this.mostrarMensaje('❌ Error al crear el nodo Activador');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  escucharCambios(): void {
    onValue(this.refActivador, (snap) => {
      const data = snap.val() || {};

      this.patrocinio = Boolean(data.patrocinio);
      this.planIndividual = Boolean(data.planIndividual);
      this.seguimientoDocente = Boolean(data.seguimientoDocente);

      this.cargando = false;
      this.cdr.detectChanges();
    });
  }

  async cambiarEstado(
    campo: 'patrocinio' | 'planIndividual' | 'seguimientoDocente'
  ): Promise<void> {
    if (this.guardando) return;

    this.guardando = true;
    this.cdr.detectChanges();

    try {
      const nuevoEstado = !this[campo];

      await update(this.refActivador, {
        [campo]: nuevoEstado
      });

      this.mostrarMensaje(
        nuevoEstado
          ? '✅ Formulario activado correctamente'
          : '✅ Formulario desactivado correctamente'
      );
    } catch (error) {
      console.error('Error actualizando formulario:', error);
      this.mostrarMensaje('❌ No se pudo actualizar el estado');
    } finally {
      this.guardando = false;
      this.cdr.detectChanges();
    }
  }

  private mostrarMensaje(texto: string): void {
    this.mensaje = texto;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.mensaje = '';
      this.cdr.detectChanges();
    }, 3000);
  }
}
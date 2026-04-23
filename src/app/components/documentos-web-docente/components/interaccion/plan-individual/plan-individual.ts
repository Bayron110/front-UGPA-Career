import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { onValue, ref, set, off } from 'firebase/database';
import { dbDocente } from '../../../../../firebase/firebase-docente';

@Component({
  selector: 'app-plan-individual',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plan-individual.html',
  styleUrl: './plan-individual.css'
})
export class PlanIndividual implements OnInit, OnDestroy {

  codigoUnidad = 'UGPA-RGI1-01-PRO-251';
  anio = new Date().getFullYear().toString();
  mes = String(new Date().getMonth() + 1).padStart(2, '0');

  codigoPreview = '';
  guardando = false;
  cargando = true;
  mensaje = '';

  registroActual: { codigo: string; fechaGuardado: string } | null = null;

  private refConfig = ref(dbDocente, 'config-plan-individual/1');

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.escucharConfiguracion();
  }

  ngOnDestroy(): void {
    off(this.refConfig);
  }

  escucharConfiguracion(): void {
    this.cargando = true;
    onValue(this.refConfig, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const codigoGuardado = data.codigo || '';

        if (codigoGuardado) {
          const partes = codigoGuardado.split('-');
          if (partes.length >= 7) {
            this.codigoUnidad = partes.slice(0, 5).join('-');
            this.anio = partes[5] || this.anio;
            this.mes = (partes[6] || this.mes).padStart(2, '0');
          }
        }

        this.registroActual = {
          codigo: data.codigo || '',
          fechaGuardado: data.fechaGuardado || ''
        };
      } else {
        this.registroActual = null;
      }

      this.cargando = false;
      this.actualizarCodigoPreview();
      this.cdr.detectChanges();
    });
  }

  actualizarCodigoPreview(): void {
    const base = this.codigoUnidad.trim() || 'UGPA-RGI2-02-PRO-134';
    const anio = this.anio.trim() || new Date().getFullYear().toString();
    const mes = (this.mes.trim() || String(new Date().getMonth() + 1)).padStart(2, '0');
    this.codigoPreview = `${base}-${anio}-${mes}`;
    this.cdr.detectChanges();
  }

  formularioValido(): boolean {
    return !!(
      this.codigoUnidad.trim() &&
      this.anio.trim() &&
      this.mes.trim()
    );
  }

  async guardarConfiguracion(): Promise<void> {
    if (!this.formularioValido()) {
      this.mostrarMensaje('❌ Complete los campos requeridos');
      return;
    }

    this.guardando = true;
    this.mensaje = '';
    this.cdr.detectChanges();

    try {
      const ahora = new Date();
      await set(ref(dbDocente, 'config-plan-individual/1'), {
        codigo: this.codigoPreview,
        fechaGuardado: ahora.toLocaleDateString('es-EC')
      });
      this.mostrarMensaje('✅ Configuración actualizada correctamente');
    } catch (error) {
      console.error(error);
      this.mostrarMensaje('❌ Error al guardar la configuración');
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
import { Injectable } from '@angular/core';
import {
  ref,
  onValue,
  update,
  set,
  remove,
  DatabaseReference
} from 'firebase/database';
import { dbDocente } from '../../firebase/firebase-docente'; // ajusta el path a tu firebase-docente.ts

export interface RegistroPatrocinio {
  tipo: 'patrocinio';
  cedula: string;
  clave: string;
  docente: string;
  carrera: string;
  capacitacion: string;
  codigo: string;
  entregado?: boolean;
  sede?: string;          // ← nuevo
}

export interface RegistroPlan {
  tipo: 'plan';
  cedula: string;
  clave: string;
  docente: string;
  carrera: string;
  codigo: string;
  entregado?: boolean;
  sede?: string;          // ← nuevo
  fechaInicioG?: string;
  fechaFinG?: string;
  fechaInicioE?: string;
  fechaFinE?: string;
  nivelFormacionGenerica?: string;
  nivelFormacionEspecifica?: string;
}
export type Registro = RegistroPatrocinio | RegistroPlan;

export interface DocenteAgrupado {
  cedula: string;
  docente: string;
  patrocinios: RegistroPatrocinio[];
  planes: RegistroPlan[];
}

@Injectable({ providedIn: 'root' })
export class DocentesRegistradosService {

  // ── Normalización de claves (mismo criterio que patrocinio.js) ──
  limpiarClave(texto: string): string {
    return String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  claveDesdeCodigo(codigo: string): string {
    return this.limpiarClave(codigo);
  }

  // ── Escucha en tiempo real ──
  escucharPatrocinios(cb: (data: RegistroPatrocinio[]) => void): () => void {
    const nodo = ref(dbDocente, 'patrociniosGenerados');
    return onValue(nodo, (snapshot) => {
      const resultado: RegistroPatrocinio[] = [];
      snapshot.forEach((cedulaSnap) => {
        const cedula = cedulaSnap.key as string;
        cedulaSnap.forEach((capSnap) => {
          const d = capSnap.val();
          // dentro de escucharPatrocinios, al armar cada objeto:
          resultado.push({
            tipo: 'patrocinio',
            cedula,
            clave: capSnap.key as string,
            docente: d?.docente || '',
            carrera: d?.carrera || '',
            capacitacion: d?.capacitacion || '',
            codigo: d?.codigo || '',
            entregado: !!d?.entregado,
            sede: d?.sede || ''          // ← nuevo
          });
        });
      });
      cb(resultado);
    });
  }

  escucharPlanes(cb: (data: RegistroPlan[]) => void): () => void {
    const nodo = ref(dbDocente, 'planesGenerados');
    return onValue(nodo, (snapshot) => {
      const resultado: RegistroPlan[] = [];
      snapshot.forEach((cedulaSnap) => {
        const cedula = cedulaSnap.key as string;
        cedulaSnap.forEach((planSnap) => {
          const d = planSnap.val();
          // dentro de escucharPlanes, al armar cada objeto:
          resultado.push({
            tipo: 'plan',
            cedula,
            clave: planSnap.key as string,
            docente: d?.docente || '',
            carrera: d?.carrera || '',
            codigo: d?.codigo || '',
            entregado: !!d?.entregado,
            sede: d?.sede || '',          // ← nuevo
            fechaInicioG: d?.fechaInicioG || '',
            fechaFinG: d?.fechaFinG || '',
            fechaInicioE: d?.fechaInicioE || '',
            fechaFinE: d?.fechaFinE || '',
            nivelFormacionGenerica: d?.nivelFormacionGenerica || '',
            nivelFormacionEspecifica: d?.nivelFormacionEspecifica || ''
          });
        });
      });
      cb(resultado);
    });
  }

  // ── Referencias de nodo individual ──
  private refPatrocinio(cedula: string, clave: string): DatabaseReference {
    return ref(dbDocente, `patrociniosGenerados/${cedula}/${clave}`);
  }

  private refPlan(cedula: string, clave: string): DatabaseReference {
    return ref(dbDocente, `planesGenerados/${cedula}/${clave}`);
  }

  // ── EDITAR (mueve el nodo si cambia la key) ──
  async guardarPatrocinio(original: RegistroPatrocinio, nuevo: RegistroPatrocinio, esNuevo: boolean) {
    const nuevaClave = this.limpiarClave(nuevo.capacitacion);
    const payload = {
      docente: nuevo.docente,
      cedula: nuevo.cedula,
      carrera: nuevo.carrera,
      capacitacion: nuevo.capacitacion,
      codigo: nuevo.codigo,
      entregado: !!nuevo.entregado,
      sede: nuevo.sede || ''        // ← nuevo
    };

    if (esNuevo) {
      await set(this.refPatrocinio(nuevo.cedula, nuevaClave), payload);
      return;
    }

    const cambioClave = original.cedula !== nuevo.cedula || original.clave !== nuevaClave;

    if (cambioClave) {
      await set(this.refPatrocinio(nuevo.cedula, nuevaClave), payload);
      await remove(this.refPatrocinio(original.cedula, original.clave));
    } else {
      await update(this.refPatrocinio(original.cedula, original.clave), payload);
    }
  }

  async guardarPlan(original: RegistroPlan, nuevo: RegistroPlan, esNuevo: boolean) {
    const nuevaClave = this.claveDesdeCodigo(nuevo.codigo);
    // en guardarPlan, dentro del payload:
    const payload = {
      docente: nuevo.docente,
      cedula: nuevo.cedula,
      carrera: nuevo.carrera,
      codigo: nuevo.codigo,
      entregado: !!nuevo.entregado,
      sede: nuevo.sede || '',       // ← nuevo
      fechaInicioG: nuevo.fechaInicioG || '',
      fechaFinG: nuevo.fechaFinG || '',
      fechaInicioE: nuevo.fechaInicioE || '',
      fechaFinE: nuevo.fechaFinE || '',
      nivelFormacionGenerica: nuevo.nivelFormacionGenerica || '',
      nivelFormacionEspecifica: nuevo.nivelFormacionEspecifica || ''
    };

    if (esNuevo) {
      await set(this.refPlan(nuevo.cedula, nuevaClave), payload);
      return;
    }

    const cambioClave = original.cedula !== nuevo.cedula || original.clave !== nuevaClave;

    if (cambioClave) {
      await set(this.refPlan(nuevo.cedula, nuevaClave), payload);
      await remove(this.refPlan(original.cedula, original.clave));
    } else {
      await update(this.refPlan(original.cedula, original.clave), payload);
    }
  }

  // ── ELIMINAR ──
  async eliminarPatrocinio(cedula: string, clave: string) {
    await remove(this.refPatrocinio(cedula, clave));
  }

  async eliminarPlan(cedula: string, clave: string) {
    await remove(this.refPlan(cedula, clave));
  }

  // ── TOGGLE ENTREGADO (rápido, sin abrir modal) ──
  async marcarEntregadoPatrocinio(cedula: string, clave: string, valor: boolean) {
    await update(this.refPatrocinio(cedula, clave), { entregado: valor });
  }

  async marcarEntregadoPlan(cedula: string, clave: string, valor: boolean) {
    await update(this.refPlan(cedula, clave), { entregado: valor });
  }
}
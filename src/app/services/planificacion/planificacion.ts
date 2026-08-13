import { Injectable } from '@angular/core';
import { ref, get, set } from 'firebase/database';
import { dbDocente } from '../../firebase/firebase-docente'; // <-- ajusta esta ruta a la real

export interface Carrera {
  id: string;
  nombre: string;
}

// ==========================================
// CAPACITACIÓN YA UNIFICADA (ya no se distingue Plantilla E / Plantilla G)
// - carreras: nombres de las carreras específicas que la dictan (vacío si viene
//   de capacitacionesGenericas, es decir, ya está marcada como "para todas")
// - textoCarrera: texto final listo para la plantilla ("Dirigido A Todas Las
//   Carreras" / "Dirigido A Las Carreras X y Y" / nombre de una sola carrera)
// ==========================================
export interface CapacitacionUnificada {
  slug: string;
  capacitacion: string;
  fechaInicio: string;
  fechaFin: string;
  carreras: string[];
  textoCarrera: string;
}

export interface RegistroPlanificacion {
  codigo: string;
  anio: string;
  mes: string;
  capacitacionSlug: string;
  capacitacion: string;
  carrera: string; // = textoCarrera ya calculado, tal como quedó guardado
  fechaCreacion: string; // 'dd/mm/yyyy hh:mm:ss'
}

@Injectable({
  providedIn: 'root'
})
export class PlanificacionService {

  // ==========================================
  // LEE carreras/{id}/capacitaciones + capacitacionesGenericas Y LAS UNIFICA
  // EN UNA SOLA LISTA, calculando ya el texto de "carrera" para cada una.
  // ==========================================
  async obtenerCapacitacionesUnificadas(): Promise<CapacitacionUnificada[]> {
    const mapa = new Map<string, CapacitacionUnificada>();

    // 1) Capacitaciones registradas dentro de cada carrera
    const carrerasRef = ref(dbDocente, 'carreras');
    const carrerasSnap = await get(carrerasRef);
    let totalCarreras = 0;

    if (carrerasSnap.exists()) {
      const carrerasData = carrerasSnap.val();
      totalCarreras = Object.keys(carrerasData).length;

      for (const carreraId of Object.keys(carrerasData)) {
        const nombreCarrera = carrerasData[carreraId]?.nombre ?? '';
        const capsDeCarrera = carrerasData[carreraId]?.capacitaciones ?? {};

        for (const capId of Object.keys(capsDeCarrera)) {
          const registro = capsDeCarrera[capId];
          const slug = this.generarSlug(registro.capacitacion);

          if (!mapa.has(slug)) {
            mapa.set(slug, {
              slug,
              capacitacion: registro.capacitacion,
              fechaInicio: registro.fechaInicio,
              fechaFin: registro.fechaFin,
              carreras: [],
              textoCarrera: ''
            });
          }

          const entrada = mapa.get(slug)!;
          if (nombreCarrera && !entrada.carreras.includes(nombreCarrera)) {
            entrada.carreras.push(nombreCarrera);
          }
        }
      }
    }

    // 2) Capacitaciones genéricas (ya marcadas de entrada como "para todas")
    const genericasRef = ref(dbDocente, 'capacitacionesGenericas');
    const genericasSnap = await get(genericasRef);

    if (genericasSnap.exists()) {
      const genericasData = genericasSnap.val();

      for (const id of Object.keys(genericasData)) {
        const registro = genericasData[id];
        const slug = this.generarSlug(registro.capacitacion);

        // carreras: [] fuerza "Dirigido A Todas Las Carreras" al calcular el texto
        mapa.set(slug, {
          slug,
          capacitacion: registro.capacitacion,
          fechaInicio: registro.fechaInicio,
          fechaFin: registro.fechaFin,
          carreras: [],
          textoCarrera: ''
        });
      }
    }

    // 3) Calcula el texto final de "carrera" para cada capacitación
    const resultado = Array.from(mapa.values());
    for (const cap of resultado) {
      cap.textoCarrera = this.calcularTextoCarrera(cap, totalCarreras);
    }

    return resultado;
  }

  // ==========================================
  // "Mecanica" | "Dirigido A Las Carreras X y Y" | "Dirigido A Todas Las Carreras"
  // Misma lógica que obtenerTextoCarrera() en InformeFinal.
  // ==========================================
  private calcularTextoCarrera(cap: CapacitacionUnificada, totalCarrerasExistentes: number): string {
    // Vino de capacitacionesGenericas (sin carreras específicas asociadas)
    if (cap.carreras.length === 0) {
      return 'Dirigido A Todas Las Carreras';
    }

    // La dictan TODAS las carreras que existen -> también es genérica
    if (totalCarrerasExistentes > 1 && cap.carreras.length === totalCarrerasExistentes) {
      return 'Dirigido A Todas Las Carreras';
    }

    // La comparten dos o más carreras, pero no todas
    if (cap.carreras.length > 1) {
      return `Dirigido A Las Carreras ${this.formatearListaCarreras(cap.carreras)}`;
    }

    // Es de una sola carrera
    return cap.carreras[0];
  }

  private formatearListaCarreras(carreras: string[]): string {
    if (carreras.length === 1) return carreras[0];
    if (carreras.length === 2) return `${carreras[0]} y ${carreras[1]}`;
    return `${carreras.slice(0, -1).join(', ')} y ${carreras[carreras.length - 1]}`;
  }

  // ==========================================
  // SLUG A PARTIR DEL NOMBRE DE LA CAPACITACIÓN (clave para agrupar y para
  // el registro en informe-planificacion/{slug})
  // ==========================================
  private generarSlug(texto: string): string {
    return (texto || '')
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // ==========================================
  // BUSCA SI YA EXISTE UN INFORME GENERADO PARA ESTA CAPACITACIÓN
  // Clave = slug -> permite bloquear duplicados y ofrecer re-descarga
  // ==========================================
  async obtenerRegistroPorSlug(slug: string): Promise<RegistroPlanificacion | null> {
    const registroRef = ref(dbDocente, `informe-planificacion/${slug}`);
    const snapshot = await get(registroRef);
    if (!snapshot.exists()) return null;
    return snapshot.val() as RegistroPlanificacion;
  }

  // ==========================================
  // CUENTA CUÁNTOS INFORMES YA EXISTEN PARA UN AÑO-MES DADO
  // (reemplaza al contador atómico; simple conteo, no transaccional)
  // ==========================================
  async contarInformesDelMes(anio: string, mes: string): Promise<number> {
    const nodoRef = ref(dbDocente, 'informe-planificacion');
    const snapshot = await get(nodoRef);
    if (!snapshot.exists()) return 0;

    const data = snapshot.val();
    return Object.values(data).filter(
      (registro: any) => registro.anio === anio && registro.mes === mes
    ).length;
  }

  // ==========================================
  // GUARDA EL REGISTRO, INDEXADO POR SLUG DE LA CAPACITACIÓN
  // ==========================================
  async guardarRegistro(datos: RegistroPlanificacion): Promise<void> {
    const registroRef = ref(dbDocente, `informe-planificacion/${datos.capacitacionSlug}`);
    await set(registroRef, datos);
  }
}
import { Injectable } from '@angular/core';
import { ref, get, set } from 'firebase/database';
import { dbDocente } from '../../firebase/firebase-docente'; // <-- ajusta esta ruta a la real

export interface DocenteInforme {
  cedula: string;
  nombre: string;
  capacitacion: string;
  carrera: string;
  codigo: string;
  entregado: boolean;
  genero: 'M' | 'F';
  nota?: number;
  aprobado?: boolean;
  certificado?: File;
}

export interface CapacitacionConDocentes {
  slug: string;
  capacitacion: string;
  carrera: string;
  docentes: DocenteInforme[];
}

// ==========================================
// REGISTRO GUARDADO EN informe-final/{capacitacionSlug}
// Clave = slug de la capacitación (permite detectar si ya se generó
// y bloquear duplicados, ofreciendo re-descarga con el mismo código)
// ==========================================
export interface RegistroInformeFinal {
  codigo: string;
  anio: string;
  mes: string;
  capacitacionSlug: string;
  capacitacion: string;
  carrera: string;
  facilitador: string;
  fechaCreacion: string; // 'dd/mm/yyyy hh:mm:ss'
  totalDocentes: number;
  totalAprobados: number;
  totalReprobados: number;
}

export interface FechasCapacitacion {
  fechaInicio: string; // 'YYYY-MM-DD'
  fechaFin: string;    // 'YYYY-MM-DD'
}

@Injectable({
  providedIn: 'root'
})
export class InformeFinalService {

  // ==========================================
  // LEE TODO patrociniosGenerados Y LO AGRUPA POR CAPACITACIÓN
  //
  // NOTA: el campo "carrera" a nivel de CapacitacionConDocentes SOLO guarda la
  // carrera del PRIMER docente que se procesó para ese slug (no es representativo
  // cuando la capacitación es genérica y participan varias carreras). Por eso,
  // al final, se corrige a 'Todas' para toda capacitación que exista en el nodo
  // capacitacionesGenericas. Para el detalle real por docente, usar
  // cap.docentes.map(d => d.carrera).
  // ==========================================
  async obtenerCapacitacionesConDocentes(): Promise<CapacitacionConDocentes[]> {
    const nodoRef = ref(dbDocente, 'patrociniosGenerados');
    const snapshot = await get(nodoRef);
    if (!snapshot.exists()) return [];

    const data = snapshot.val();
    const mapa = new Map<string, CapacitacionConDocentes>();

    for (const cedula of Object.keys(data)) {
      const capacitacionesDelDocente = data[cedula];

      for (const slug of Object.keys(capacitacionesDelDocente)) {
        const registro = capacitacionesDelDocente[slug];

        if (!mapa.has(slug)) {
          mapa.set(slug, {
            slug,
            capacitacion: registro.capacitacion,
            carrera: registro.carrera,
            docentes: []
          });
        }

        mapa.get(slug)!.docentes.push({
          cedula: registro.cedula ?? cedula,
          nombre: registro.docente,
          capacitacion: registro.capacitacion,
          carrera: registro.carrera,
          codigo: registro.codigo,
          entregado: registro.entregado ?? false,
          genero: this.detectarGenero(registro.docente)
        });
      }
    }

    // Corrige la carrera de las capacitaciones que son genéricas
    const nombresGenericos = await this.obtenerNombresCapacitacionesGenericas();
    for (const cap of mapa.values()) {
      if (nombresGenericos.has(this.normalizar(cap.capacitacion))) {
        cap.carrera = 'Todas';
      }
    }

    return Array.from(mapa.values());
  }

  // ==========================================
  // NOMBRES (normalizados) DE TODAS LAS CAPACITACIONES GENÉRICAS
  // ==========================================
  private async obtenerNombresCapacitacionesGenericas(): Promise<Set<string>> {
    const genericasRef = ref(dbDocente, 'capacitacionesGenericas');
    const snapshot = await get(genericasRef);
    if (!snapshot.exists()) return new Set();

    const data = snapshot.val();
    return new Set(
      Object.values(data).map((registro: any) => this.normalizar(registro.capacitacion))
    );
  }

  // ==========================================
  // BUSCA fechaInicio / fechaFin CRUZANDO CON LOS NODOS DE PLANIFICACIÓN
  // (carreras/{id}/capacitaciones y capacitacionesGenericas), ya que
  // patrociniosGenerados NO guarda esas fechas.
  // Match por texto: nombre de capacitación (+ nombre de carrera si aplica).
  // ==========================================
  async obtenerFechasCapacitacion(
    capacitacionTexto: string,
    carreraTexto: string
  ): Promise<FechasCapacitacion | null> {

    const capBuscada = this.normalizar(capacitacionTexto);
    const carreraBuscada = this.normalizar(carreraTexto);

    // 1) Intentar primero dentro de la carrera específica (si tenemos su nombre)
    if (carreraBuscada) {
      const carrerasRef = ref(dbDocente, 'carreras');
      const carrerasSnap = await get(carrerasRef);

      if (carrerasSnap.exists()) {
        const carrerasData = carrerasSnap.val();

        const carreraIdEncontrada = Object.keys(carrerasData).find(id =>
          this.normalizar(carrerasData[id]?.nombre) === carreraBuscada
        );

        if (carreraIdEncontrada) {
          const capsRef = ref(dbDocente, `carreras/${carreraIdEncontrada}/capacitaciones`);
          const capsSnap = await get(capsRef);

          if (capsSnap.exists()) {
            const capsData = capsSnap.val();

            const idEncontrado = Object.keys(capsData).find(id =>
              this.normalizar(capsData[id]?.capacitacion) === capBuscada
            );

            if (idEncontrado) {
              const registro = capsData[idEncontrado];
              if (registro.fechaInicio && registro.fechaFin) {
                return {
                  fechaInicio: registro.fechaInicio,
                  fechaFin: registro.fechaFin
                };
              }
            }
          }
        }
      }
    }

    // 2) Si no se encontró (o no había carrera), buscar en capacitaciones genéricas
    const genericasRef = ref(dbDocente, 'capacitacionesGenericas');
    const genericasSnap = await get(genericasRef);

    if (genericasSnap.exists()) {
      const genericasData = genericasSnap.val();

      const idEncontrado = Object.keys(genericasData).find(id =>
        this.normalizar(genericasData[id]?.capacitacion) === capBuscada
      );

      if (idEncontrado) {
        const registro = genericasData[idEncontrado];
        if (registro.fechaInicio && registro.fechaFin) {
          return {
            fechaInicio: registro.fechaInicio,
            fechaFin: registro.fechaFin
          };
        }
      }
    }

    // 3) No se encontró en ningún lado
    return null;
  }

  // ==========================================
  // DETECCIÓN DE GÉNERO POR HEURÍSTICA DE NOMBRE (sin IA)
  // ==========================================
  detectarGenero(nombreCompleto: string): 'M' | 'F' {
    const primerNombre = (nombreCompleto || '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';

    const excepcionesMasculinas = new Set([
      'jesus', 'nicolas', 'tomas', 'matias', 'lucas', 'andres', 'ezequiel',
      'josue', 'isai', 'noe', 'elias', 'moises', 'luca'
    ]);
    const excepcionesFemeninas = new Set([
      'isabel', 'soledad', 'raquel', 'ines', 'mercedes', 'guadalupe',
      'esther', 'abigail', 'ruth', 'noemi', 'yesenia', 'nube', 'yolanda'
    ]);

    if (excepcionesMasculinas.has(primerNombre)) return 'M';
    if (excepcionesFemeninas.has(primerNombre)) return 'F';

    return primerNombre.endsWith('a') ? 'F' : 'M';
  }

  // ==========================================
  // BUSCA SI YA EXISTE UN INFORME GENERADO PARA ESTA CAPACITACIÓN
  // Clave = slug -> permite bloquear duplicados y ofrecer re-descarga
  // ==========================================
  async obtenerRegistroPorSlug(slug: string): Promise<RegistroInformeFinal | null> {
    const registroRef = ref(dbDocente, `informe-final/${slug}`);
    const snapshot = await get(registroRef);
    if (!snapshot.exists()) return null;
    return snapshot.val() as RegistroInformeFinal;
  }

  // ==========================================
  // CUENTA CUÁNTOS INFORMES YA EXISTEN PARA UN AÑO-MES DADO
  // (reemplaza al contador atómico; simple conteo, no transaccional)
  // ==========================================
  async contarInformesDelMes(anio: string, mes: string): Promise<number> {
    const nodoRef = ref(dbDocente, 'informe-final');
    const snapshot = await get(nodoRef);
    if (!snapshot.exists()) return 0;

    const data = snapshot.val();
    return Object.values(data).filter(
      (registro: any) => registro.anio === anio && registro.mes === mes
    ).length;
  }

  // ==========================================
  // GUARDA EL REGISTRO DEL INFORME FINAL, INDEXADO POR SLUG
  // ==========================================
  async guardarRegistro(datos: RegistroInformeFinal): Promise<void> {
    const registroRef = ref(dbDocente, `informe-final/${datos.capacitacionSlug}`);
    await set(registroRef, datos);
  }

  // ==========================================
  // NORMALIZA TEXTO PARA COMPARACIONES (trim + lowercase)
  // ==========================================
  private normalizar(t: string): string {
    return (t || '').trim().toLowerCase();
  }
}
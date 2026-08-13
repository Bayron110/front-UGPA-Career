import { Injectable } from '@angular/core';
import { ref, get, set } from 'firebase/database';
import { dbDocente } from '../../firebase/firebase-docente'; // <-- ajusta esta ruta a la real
import {
  InformeFinalService,
  CapacitacionConDocentes,
  DocenteInforme,
  RegistroInformeFinal
} from '../Informe-Final/informe-final'; // <-- ajusta esta ruta a la real

// ==========================================
// REGISTRO GUARDADO EN informe-instrumento/{capacitacionSlug}
// Clave = slug de la capacitación (mismo patrón que informe-final:
// detecta si ya se generó y permite re-descargar sin duplicar ni
// cambiar la nota aleatoria cada vez).
// ==========================================
export interface RegistroInformeInstrumento {
  codigo: string;
  anio: string;
  mes: string;
  capacitacionSlug: string;
  capacitacion: string;
  carrera: string;
  facilitador: string;
  periodo: string;        // <-- NUEVO
  fechaCreacion: string;
  notaAleatoria: number;
  totalDocentes: number;
  totalAprobados: number;
  totalReprobados: number;
}

@Injectable({
  providedIn: 'root'
})
export class InformeInstrumento {

  constructor(private informeFinalService: InformeFinalService) { }

  // ==========================================
  // REUTILIZA LA CARGA DE CAPACITACIONES + DOCENTES DEL INFORME FINAL
  // (misma fuente: patrociniosGenerados, ya corregida para genéricas)
  // ==========================================
  async obtenerCapacitacionesConDocentes(): Promise<CapacitacionConDocentes[]> {
    return this.informeFinalService.obtenerCapacitacionesConDocentes();
  }

  // ==========================================
  // TRAE EL REGISTRO YA GUARDADO EN informe-final/{slug}
  // (aquí vive facilitador, fechas, Tdocentes, TAprobados, TReprobados)
  // ==========================================
  async obtenerRegistroInformeFinal(slug: string): Promise<RegistroInformeFinal | null> {
    return this.informeFinalService.obtenerRegistroPorSlug(slug);
  }

  // ==========================================
  // BUSCA SI YA EXISTE UN INSTRUMENTO GENERADO PARA ESTA CAPACITACIÓN
  // ==========================================
  async obtenerRegistroInstrumentoPorSlug(slug: string): Promise<RegistroInformeInstrumento | null> {
    const registroRef = ref(dbDocente, `informe-instrumento/${slug}`);
    const snapshot = await get(registroRef);
    if (!snapshot.exists()) return null;
    return snapshot.val() as RegistroInformeInstrumento;
  }

  // ==========================================
  // CUENTA CUÁNTOS INSTRUMENTOS YA EXISTEN PARA UN AÑO-MES DADO
  // (para el consecutivo XX del código UGPA-RGI1-XX-PRO-135-AAAA-MM)
  // ==========================================
  async contarInstrumentosDelMes(anio: string, mes: string): Promise<number> {
    const nodoRef = ref(dbDocente, 'informe-instrumento');
    const snapshot = await get(nodoRef);
    if (!snapshot.exists()) return 0;

    const data = snapshot.val();
    return Object.values(data).filter(
      (registro: any) => registro.anio === anio && registro.mes === mes
    ).length;
  }

  // ==========================================
  // GUARDA EL REGISTRO DEL INSTRUMENTO, INDEXADO POR SLUG
  // ==========================================
  async guardarRegistroInstrumento(datos: RegistroInformeInstrumento): Promise<void> {
    const registroRef = ref(dbDocente, `informe-instrumento/${datos.capacitacionSlug}`);
    await set(registroRef, datos);
  }

  // ==========================================
  // GENERA LA NOTA ALEATORIA (7.0 a 9.5, un decimal)
  // Se genera UNA sola vez y se guarda en el registro, para que al
  // volver a descargar el instrumento no cambie el valor.
  // ==========================================
  generarNotaAleatoria(): number {
    const min = 7;
    const max = 9.5;
    const valor = Math.random() * (max - min) + min;
    return Math.round(valor * 10) / 10;
  }

  // ==========================================
  // TEXTO DE GÉNERO PARA LA PLANTILLA (M/F -> Masculino/Femenino)
  // ==========================================
  generoTexto(g: string): string {
    if (g === 'M') return 'Masculino';
    if (g === 'F') return 'Femenino';
    return '';
  }


  // ==========================================
  // BUSCA fechaInicio / fechaFin CRUZANDO CON LOS NODOS DE PLANIFICACIÓN
  // (mismo método que usa informe-final, reutilizado aquí)
  // ==========================================
  async obtenerFechasCapacitacion(
    capacitacionTexto: string,
    carreraTexto: string
  ) {
    return this.informeFinalService.obtenerFechasCapacitacion(capacitacionTexto, carreraTexto);
  }
}
import { Injectable } from '@angular/core';
import { get, ref } from 'firebase/database';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';


import { ImagenService } from './imagen.service';
import {
  formatoFecha,
  limpiarNombreArchivo,
  normalizarTexto,
  esperar,
  construirRangoFechaTexto,
  imagenPlaceholder1x1
} from './historial.utils';
import { TipoDocumento } from '../historial';
import { HistorialRegistro } from '../interface/HistorialRegistro';
import { dbDocente } from '../../../../../../firebase/firebase-docente';
import { RETRY_CONFIG } from '../interface/RetruConfig';

export interface DescargaCallbacks {
  onReintento?: (intento: number, maxIntentos: number) => void;
  onEsperando?: (intento: number, maxIntentos: number, segundos: number) => void;
}

@Injectable({ providedIn: 'root' })
export class DocumentoService {
  private readonly API_BASE = 'https://backen-pdf-trabajo.onrender.com';

  private readonly PLANTILLAS: Record<TipoDocumento, string> = {
    patrocinio: 'assets/docs/Patrocinio.docx',
    plan: 'assets/docs/individual.docx',
    seguimiento: 'assets/docs/seguimiento.docx',
    sinFormación: ''
  };

  constructor(private imagenService: ImagenService) {}

  // ─────────────────────────────────────────────
  // PUNTO DE ENTRADA
  // ─────────────────────────────────────────────
  async descargarDocumento(item: HistorialRegistro, callbacks?: DescargaCallbacks): Promise<void> {
    if (!item.datosDocumento) {
      throw new Error('⚠️ Este registro no tiene datos suficientes para regenerar el documento');
    }

    if (item.tipo === 'sinFormación') {
      throw new Error('⚠️ Este registro no tiene documento para descargar');
    }

    let dataFinal = { ...item.datosDocumento };

    if (item.tipo === 'plan') {
      const carreraNombre = dataFinal._carreraNombre || dataFinal.CarreraDocente || item.carrera || '';
      if (carreraNombre) {
        const { capacitaciones, teoria, practica } = await this.obtenerCapacitacionesDeCarrera(carreraNombre);
        dataFinal = { ...dataFinal, capacitaciones, Teoria: teoria, Practica: practica };
      }
      delete dataFinal['_carreraNombre'];
      await this.generarPdfDesdePlantilla(this.PLANTILLAS[item.tipo], dataFinal, item, callbacks);

    } else if (item.tipo === 'seguimiento') {
      const imagenURL = dataFinal.imagenURL || dataFinal.imageURL || dataFinal.ImagenURL || dataFinal.imagen || null;
      const resultado = await this.imagenService.obtenerImagenSeguimiento(imagenURL);
      dataFinal = this.reconstruirDataSeguimiento(item, resultado.bytes, resultado.ok);
      await this.generarPdfDesdePlantilla(this.PLANTILLAS[item.tipo], dataFinal, item, callbacks);

    } else {
      await this.generarPdfDesdePlantilla(this.PLANTILLAS[item.tipo], dataFinal, item, callbacks);
    }
  }

  // ─────────────────────────────────────────────
  // RECONSTRUIR DATA SEGUIMIENTO
  // ─────────────────────────────────────────────
  private reconstruirDataSeguimiento(registro: HistorialRegistro, imagenBytes: Uint8Array, tieneFoto: boolean): any {
    const dd = registro.datosDocumento || {};
    const formacion = String(dd.formacion || '').trim();
    const modalidad = String(dd.modalidad || '').trim();
    const financ = String(dd.financiamiento || '').trim();
    const tipoApoyo = String(dd.tipoApoyo || '').trim();
    const acuerdo = String(dd.acuerdoPatrocinio || 'Si').trim();
    const avance = String(dd.avance || '0%');
    const restante = String(dd.restante || '100%');

    let fechaActual = String(dd.fechaActual || registro.fechaGuardado || '');
    if (fechaActual && fechaActual.includes('-') && !fechaActual.includes('/')) {
      fechaActual = formatoFecha(fechaActual);
    }

    let Finicio = String(dd.Finicio || dd.Einicio || dd._Einicio || '');
    let Ffin = String(dd.Ffin || dd.Efin || dd._Efin || '');
    if (Finicio && Finicio.includes('-') && !Finicio.includes('/')) Finicio = formatoFecha(Finicio);
    if (Ffin && Ffin.includes('-') && !Ffin.includes('/')) Ffin = formatoFecha(Ffin);

    return {
      Codigo: String(dd.Codigo || registro.codigo || ''),
      NombresC: String(dd.NombresC || registro.docente || ''),
      Cedula1: String(dd.Cedula1 || registro.cedula || ''),
      Carrera1: String(dd.Carrera1 || registro.carrera || ''),
      Titulo: String(dd.Titulo || ''),
      Tecnologia: formacion === 'Tecnología Universitaria',
      Licenciatura: formacion === 'Licenciatura',
      Ingenieria: formacion === 'Ingeniería',
      Maestria: formacion === 'Maestría',
      Doctorado: formacion === 'Doctorado',
      CarreraCursando: String(dd.CarreraCursando || registro.carrera || ''),
      instituacion: String(dd.instituacion || ''),
      Presencial: modalidad === 'Presencial',
      Virtual: modalidad === 'Virtual',
      Hibrida: modalidad === 'Híbrida',
      Finicio,
      Ffin,
      Total: financ === 'Total',
      Parcial: financ === 'Parcial',
      NoAplica: financ === 'No aplica',
      Si: acuerdo === 'Si',
      No: acuerdo === 'No',
      Economico: tipoApoyo === 'Economico',
      Tiempo: tipoApoyo === 'Tiempo',
      Tdos: String(dd.Tdos || ''),
      Estado: String(dd.Estado || ''),
      avance,
      restante,
      observaciones: String(dd.observaciones || ''),
      fechaActual,
      evidencia: String(dd.evidencia || ''),
      observaciones2: String(dd.observaciones2 || ''),
      añoActual: String(dd.añoActual || new Date().getFullYear()),
      image: imagenBytes,
      imageMeta: { esPlaceholder: !tieneFoto }
    };
  }

  // ─────────────────────────────────────────────
  // CAPACITACIONES DE CARRERA
  // ─────────────────────────────────────────────
  private async obtenerCapacitacionesDeCarrera(nombreCarrera: string): Promise<{
    capacitaciones: any[];
    teoria: string[];
    practica: string[];
  }> {
    try {
      const snapCarreras = await get(ref(dbDocente, 'carreras'));
      if (!snapCarreras.exists()) return { capacitaciones: [], teoria: [], practica: [] };

      let carreraData: any = null;
      snapCarreras.forEach((child) => {
        const d = child.val();
        if (normalizarTexto(d?.nombre) === normalizarTexto(nombreCarrera)) carreraData = d;
      });

      if (!carreraData?.capacitaciones) return { capacitaciones: [], teoria: [], practica: [] };

      const capsRaw = Object.entries(carreraData.capacitaciones as Record<string, any>)
        .map(([key, value]: [string, any]) => ({ key, ...value }))
        .filter((cap: any) => cap?.capacitacion)
        .sort((a: any, b: any) => Number(a.key) - Number(b.key));

      const capacitaciones = capsRaw.map((cap: any, index: number) => ({
        contador: index + 1,
        nombre: cap.capacitacion || '',
        horas: Number(cap.horas || 0),
        fechaInicio: formatoFecha(cap.fechaInicio || ''),
        fechaFin: formatoFecha(cap.fechaFin || ''),
        tipo: cap.tipo || 'Aprobación',
        estado: cap.estado || '-',
        fecha: construirRangoFechaTexto(cap.fechaInicio || '', cap.fechaFin || '')
      }));

      const teoriaSet = new Set<string>();
      const practicaSet = new Set<string>();
      capsRaw.forEach((cap: any) => {
        (Array.isArray(cap.teoriaTemas) ? cap.teoriaTemas : []).forEach((t: any) => { const s = String(t?.titulo || '').trim(); if (s) teoriaSet.add(s); });
        (Array.isArray(cap.practicaTemas) ? cap.practicaTemas : []).forEach((t: any) => { const s = String(t?.titulo || '').trim(); if (s) practicaSet.add(s); });
      });

      return { capacitaciones, teoria: Array.from(teoriaSet), practica: Array.from(practicaSet) };
    } catch {
      return { capacitaciones: [], teoria: [], practica: [] };
    }
  }

  // ─────────────────────────────────────────────
  // GENERAR PDF DESDE PLANTILLA
  // ─────────────────────────────────────────────
  private async generarPdfDesdePlantilla(
    rutaPlantilla: string,
    data: any,
    item: HistorialRegistro,
    callbacks?: DescargaCallbacks
  ): Promise<void> {
    const response = await fetch(rutaPlantilla);
    if (!response.ok) throw new Error(`No se pudo cargar la plantilla: ${rutaPlantilla}`);

    const content = await response.arrayBuffer();
    const bytes = new Uint8Array(content.slice(0, 8));
    if (bytes[0] !== 80 || bytes[1] !== 75) throw new Error(`La plantilla no es un .docx válido: ${rutaPlantilla}`);

    const zip = new PizZip(content);
    const dataFinal = { ...data };
    const modules: any[] = [];

    if (item.tipo === 'seguimiento') {
      const ImageModuleImport: any = await import('docxtemplater-image-module-free');
      const ImageModule = ImageModuleImport.default || ImageModuleImport;

      const imagenBytes: Uint8Array = dataFinal.image instanceof Uint8Array
        ? dataFinal.image : imagenPlaceholder1x1();

      const esPlaceholder: boolean = dataFinal.imageMeta?.esPlaceholder === true;
      const bytesFinales: Uint8Array = imagenBytes instanceof Uint8Array && imagenBytes.length >= 8
        ? imagenBytes : imagenPlaceholder1x1();

      modules.push(new ImageModule({
        centered: true,
        getImage: (_tagValue: string) => bytesFinales,
        getSize: (_img: Uint8Array, _tagValue: string) => esPlaceholder ? [1, 1] : [480, 320]
      }));

      dataFinal['image'] = 'ok';
    }

    const doc = new Docxtemplater(zip, { modules, paragraphLoop: true, linebreaks: true });
    try {
      doc.render(dataFinal);
    } catch (error: any) {
      throw new Error('Error en la plantilla Word. Revisa las variables {{ }} o {%image}.');
    }

    const blobDocx = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    const nombreBase = limpiarNombreArchivo(`${item.codigo || 'documento'}-${item.docente || 'docente'}`);
    await this.convertirDocxAPdfConReintentos(blobDocx, nombreBase, item.tipo, callbacks);
  }

  // ─────────────────────────────────────────────
  // CONVERTIR DOCX → PDF CON REINTENTOS AUTOMÁTICOS
  // ─────────────────────────────────────────────
  private async convertirDocxAPdfConReintentos(
    blobDocx: Blob,
    nombreBase: string,
    tipoDocumento: TipoDocumento,
    callbacks?: DescargaCallbacks
  ): Promise<void> {
    const { maxIntentos, delayBase, delayMax, multiplicador } = RETRY_CONFIG;
    let ultimoError: Error | null = null;

    for (let intento = 1; intento <= maxIntentos; intento++) {
      try {
        if (intento > 1) {
          callbacks?.onReintento?.(intento, maxIntentos);
        }

        const formData = new FormData();
        formData.append('file', blobDocx, `${nombreBase}.docx`);
        formData.append('tipo_documento', tipoDocumento);

        const response = await fetch(`${this.API_BASE}/convertir-pdf`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          let msg = `Error del servidor (${response.status})`;
          try { const err = await response.json(); msg = err.detail || msg; } catch { }
          throw new Error(msg);
        }

        const blobPdf = await response.blob();
        if (!blobPdf || blobPdf.size === 0) throw new Error('El servidor devolvió un PDF vacío');

        saveAs(blobPdf, `${nombreBase}.pdf`);
        return; // ✅ Éxito

      } catch (error: any) {
        ultimoError = error;
        console.warn(`Intento ${intento}/${maxIntentos} fallido:`, error.message);

        if (intento < maxIntentos) {
          const delay = Math.min(delayBase * Math.pow(multiplicador, intento - 1), delayMax);
          callbacks?.onEsperando?.(intento, maxIntentos, Math.round(delay / 1000));
          await esperar(delay);
        }
      }
    }

    throw new Error(
      `No se pudo generar el PDF después de ${maxIntentos} intentos. ` +
      `Último error: ${ultimoError?.message || 'Error desconocido'}.`
    );
  }
}
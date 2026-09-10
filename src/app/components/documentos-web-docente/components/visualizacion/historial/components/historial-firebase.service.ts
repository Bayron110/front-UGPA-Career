import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { get, off, onValue, ref, update } from 'firebase/database';


import { formatoFecha } from './historial.utils';
import { dbDocente } from '../../../../../../firebase/firebase-docente';
import { HistorialRegistro } from '../interface/HistorialRegistro';

@Injectable({ providedIn: 'root' })
export class HistorialFirebaseService implements OnDestroy {

  private refPatrocinio = ref(dbDocente, 'patrociniosGenerados');
  private refPlan = ref(dbDocente, 'planesGenerados');
  private refSeguimiento = ref(dbDocente, 'seguimientoGenerados');
  private refDocentesSinFormacion = ref(dbDocente, 'docentesSinFormacion');
  private refCapacitacionesGenericas = ref(dbDocente, 'capacitacionesGenericas');
  private refCarreras = ref(dbDocente, 'carreras');

  private registros$ = new BehaviorSubject<HistorialRegistro[]>([]);
  private cargando$ = new BehaviorSubject<boolean>(true);

  private listenersActivos = false;

  ngOnDestroy(): void {
    this.detenerEscucha();
  }

  // ─────────────────────────────────────────────
  // OBSERVABLES PÚBLICOS
  // ─────────────────────────────────────────────
  obtenerRegistros$(): Observable<HistorialRegistro[]> {
    return this.registros$.asObservable();
  }

  obtenerCargando$(): Observable<boolean> {
    return this.cargando$.asObservable();
  }

  // ─────────────────────────────────────────────
  // ESCUCHA EN TIEMPO REAL
  // ─────────────────────────────────────────────
  iniciarEscucha(): void {
    if (this.listenersActivos) return;
    this.listenersActivos = true;

    this.cargarHistorial();
    onValue(this.refPatrocinio, () => this.cargarHistorial());
    onValue(this.refPlan, () => this.cargarHistorial());
    onValue(this.refSeguimiento, () => this.cargarHistorial());
    onValue(this.refDocentesSinFormacion, () => this.cargarHistorial());
  }

  detenerEscucha(): void {
    off(this.refPatrocinio);
    off(this.refPlan);
    off(this.refSeguimiento);
    off(this.refDocentesSinFormacion);
    this.listenersActivos = false;
  }

  // ─────────────────────────────────────────────
  // CARGA DE HISTORIAL
  // ─────────────────────────────────────────────
  async cargarHistorial(): Promise<void> {
    this.cargando$.next(true);

    try {
      const [snapPat, snapPlan, snapSeg, snapSinFormacion] = await Promise.all([
        get(this.refPatrocinio),
        get(this.refPlan),
        get(this.refSeguimiento),
        get(this.refDocentesSinFormacion),
      ]);

      const registros: HistorialRegistro[] = [];

      // ── Patrocinios ──
      if (snapPat.exists()) {
        snapPat.forEach((snapCedula) => {
          const cedulaKey = snapCedula.key || '';
          snapCedula.forEach((snapDoc) => {
            const data = snapDoc.val() || {};
            const nombreDocente = data.docente || data.nombre || data.NombresC || '';
            const carrera = data.carrera || data.Carrera1 || '';
            const cedula = data.cedula || data.Cedula1 || cedulaKey;
            const codigo = data.codigo || data.Codigo || '';

            registros.push({
              id: `${cedulaKey}_${snapDoc.key}`,
              tipo: 'patrocinio',
              tipoLabel: 'Patrocinio',
              cedula,
              docente: nombreDocente,
              carrera,
              codigo,
              capacitacion: data.capacitacion || data.NombreCA || '',
              fechaGuardado: data.fechaGuardado || data.fecha || '',
              timestamp: Number(data.timestamp || 0),
              datosDocumento: {
                NombresC: nombreDocente,
                Carrera1: carrera,
                Cedula1: cedula,
                NombreCA: data.capacitacion || data.NombreCA || '',
                Codigo: codigo,
                Fecha1: data.fechaTexto || data.fecha || data.Fecha1 || ''
              },
              entregado: Boolean(data.entregado),
              rutaDb: `patrociniosGenerados/${cedulaKey}/${snapDoc.key}`,
              actualizandoEstado: false
            });
          });
        });
      }

      // ── Planes ──
      if (snapPlan.exists()) {
        snapPlan.forEach((snapCedula) => {
          const cedulaKey = snapCedula.key || '';
          snapCedula.forEach((snapDoc) => {
            const data = snapDoc.val() || {};
            const nombreDocente = data.docente || data.nombre || data.NombresC || '';
            const carreraDoc = data.carrera || data.CarreraDocente || '';
            const cedula = data.cedula || cedulaKey;
            const codigo = data.codigo || data.Codigo || '';

            registros.push({
              id: `${cedulaKey}_${snapDoc.key}`,
              tipo: 'plan',
              tipoLabel: 'Plan Individual',
              cedula,
              docente: nombreDocente,
              carrera: carreraDoc,
              codigo,
              capacitacion: data.nombreFormacionEspecifica || data.nombreFormacionGenerica || '',
              fechaGuardado: data.fechaGuardado || data.fecha || '',
              timestamp: Number(data.timestamp || 0),
              datosDocumento: {
                Codigo: codigo,
                NombresC: nombreDocente,
                Nombresc: nombreDocente,
                CarreraDocente: carreraDoc,
                Carreradocente: carreraDoc,
                Respuesta1: data.respuesta1 || '',
                Respuesta2: data.respuesta2 || '',
                Respuesta3: data.respuesta3 || '',
                Respuesta4: data.respuesta4 || '',
                Respuesta5: data.respuesta5 || '',
                Respuesta6: data.respuesta6 || '',
                Respuesta7: data.respuesta7 || '',
                Respuesta8: data.respuesta8 || '',
                capacitaciones: [],
                Teoria: [],
                Practica: [],
                NombreFormacionEspecifica: data.nombreFormacionEspecifica || '',
                NivelFormacionEspecifica: data.nivelFormacionEspecifica || '',
                FechaInicioE: formatoFecha(data.fechaInicioE || ''),
                FechaFinE: formatoFecha(data.fechaFinE || ''),
                NombreFormacionGenerica: data.nombreFormacionGenerica || '',
                NivelFormacionGenerica: data.nivelFormacionGenerica || '',
                FechaInicioG: formatoFecha(data.fechaInicioG || ''),
                FechaFinG: formatoFecha(data.fechaFinG || ''),
                'NombreFormaciónEspecifica': data.nombreFormacionEspecifica || '',
                'NivelFormaciónEspecifica': data.nivelFormacionEspecifica || '',
                'NombreFormaciónGenerica': data.nombreFormacionGenerica || '',
                'NivelFormaciónGenerica': data.nivelFormacionGenerica || '',
                _carreraNombre: carreraDoc
              },
              entregado: Boolean(data.entregado),
              rutaDb: `planesGenerados/${cedulaKey}/${snapDoc.key}`,
              actualizandoEstado: false
            });
          });
        });
      }

      // ── Seguimientos ──
      if (snapSeg.exists()) {
        snapSeg.forEach((snapDoc) => {
          const data = snapDoc.val() || {};
          const datosDoc = data.datosDocumento || {};

          const nombreDocente = data.nombre || data.docente || datosDoc.NombresC || datosDoc.Nombresc || '';
          const carrera = data.carrera || datosDoc.Carrera1 || datosDoc.CarreraCursando || '';
          const cedula = data.cedula || datosDoc.Cedula1 || '';
          const codigo = data.codigo || datosDoc.Codigo || '';
          const imagenURL = datosDoc.imagenURL || datosDoc.imageURL || data.imagenURL || data.imageURL || null;

          registros.push({
            id: snapDoc.key || '',
            tipo: 'seguimiento',
            tipoLabel: 'Seguimiento',
            cedula,
            docente: nombreDocente,
            carrera,
            codigo,
            capacitacion: '',
            fechaGuardado: data.fechaGuardado || data.fecha || datosDoc.fechaActual || '',
            timestamp: Number(data.timestamp || 0),
            datosDocumento: {
              ...datosDoc,
              Codigo: codigo,
              NombresC: nombreDocente,
              Cedula1: cedula,
              Carrera1: carrera,
              CarreraCursando: data.CarreraCursando || datosDoc.CarreraCursando || carrera,
              Einicio: data.Einicio || datosDoc.Einicio || '',
              Efin: data.Efin || datosDoc.Efin || '',
              _Einicio: data.Einicio || datosDoc.Einicio || '',
              _Efin: data.Efin || datosDoc.Efin || '',
              imagenURL
            },
            entregado: Boolean(data.entregado),
            rutaDb: `seguimientoGenerados/${snapDoc.key}`,
            actualizandoEstado: false
          });
        });
      }

      // ── Sin Formación ──
      if (snapSinFormacion.exists()) {
        snapSinFormacion.forEach((snapDoc) => {
          const data = snapDoc.val() || {};
          const cedula = data.cedula || '';
          const nombre = data.nombre || '';
          const carrera = data.carrera || '';
          const anio = data.anio || '';
          const mes = data.mes || '';

          registros.push({
            id: snapDoc.key || `${cedula}_${anio}_${mes}`,
            tipo: 'sinFormación',
            tipoLabel: 'Sin Formación',
            cedula,
            docente: nombre,
            carrera,
            codigo: 'SIN FORMACIÓN',
            capacitacion: '',
            fechaGuardado: data.fecha || '',
            timestamp: data.registradoEn ? new Date(data.registradoEn).getTime() : 0,
            datosDocumento: {
              cedula, nombre, carrera, anio, mes,
              fecha: data.fecha || '',
              hora: data.hora || '',
              observacion: data.observacion || '',
              titulo: data.titulo || '',
              enProcesoFormacion: Boolean(data.enProcesoFormacion)
            },
            entregado: Boolean(data.entregado),
            rutaDb: `docentesSinFormacion/${snapDoc.key}`,
            actualizandoEstado: false
          });
        });
      }

      const registrosOrdenados = registros.sort((a, b) => {
        const ta = Number(a.timestamp || 0);
        const tb = Number(b.timestamp || 0);
        if (tb !== ta) return tb - ta;
        return String(b.codigo || '').localeCompare(String(a.codigo || ''));
      });

      this.registros$.next(registrosOrdenados);

    } catch (error) {
      console.error('Error cargando historial:', error);
      throw new Error('❌ Error al cargar el historial');
    } finally {
      this.cargando$.next(false);
    }
  }

  // ─────────────────────────────────────────────
  // CAPACITACIONES DISPONIBLES (para el filtro)
  // ─────────────────────────────────────────────
  async cargarCapacitacionesDisponibles(): Promise<string[]> {
    const set = new Set<string>();

    try {
      const [snapGenericas, snapCarreras] = await Promise.all([
        get(this.refCapacitacionesGenericas),
        get(this.refCarreras),
      ]);

      // capacitacionesGenericas (nodo plano)
      if (snapGenericas.exists()) {
        snapGenericas.forEach((snapCap) => {
          const nombre = String(snapCap.val()?.capacitacion || '').trim();
          if (nombre) set.add(nombre);
        });
      }

      // carreras/{id}/capacitaciones (nodo anidado)
      if (snapCarreras.exists()) {
        snapCarreras.forEach((snapCarrera) => {
          const caps = snapCarrera.val()?.capacitaciones;
          if (caps) {
            Object.values(caps as Record<string, any>).forEach((cap: any) => {
              const nombre = String(cap?.capacitacion || '').trim();
              if (nombre) set.add(nombre);
            });
          }
        });
      }
    } catch (error) {
      console.error('Error cargando capacitaciones disponibles:', error);
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }

  // ─────────────────────────────────────────────
  // CAMBIAR ESTADO DE ENTREGA
  // ─────────────────────────────────────────────
  async cambiarEstadoEntrega(item: HistorialRegistro, nuevoEstado: boolean): Promise<void> {
    if (item.entregado === nuevoEstado) return;

    try {
      await update(ref(dbDocente, item.rutaDb), { entregado: nuevoEstado });
      item.entregado = nuevoEstado;
    } catch {
      throw new Error('❌ No se pudo actualizar el estado');
    }
  }
}
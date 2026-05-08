import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { off, onValue, ref } from 'firebase/database';
import { dbDocente } from '../../../../../firebase/firebase-docente';

type TipoRegistro = 'patrocinio' | 'plan' | 'seguimiento' | 'sinFormacion';
type ContextoDashboard = 'documentos' | 'seguimiento' | 'sinFormacion';
type VistaDashboard = 'global' | 'carrera' | 'tipo';

interface RegistroBase {
  tipo: TipoRegistro;
  carrera: string;
  entregado: boolean;
  nombre?: string;
}

interface CarreraResumen {
  carrera: string;
  total: number;
  entregados: number;
  pendientes: number;
  porcentajeEntregados: number;
}

interface GrupoTipo {
  label: string;
  tipo: string;
  total: number;
  entregados: number;
  pendientes: number;
  pctEnt: number;
  pctPend: number;
}

interface DocenteVersus {
  nombre: string;
  carrera: string;
  total: number;
  ent: number;
  pend: number;
  pctEntregado: number;
  pctDelTotal: number;
}

@Component({
  selector: 'app-dasboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './dasboard.html',
  styleUrl: './dasboard.css'
})
export class Dasboard implements OnInit, OnDestroy {

  cargando = true;
  vistaActiva: VistaDashboard = 'global';
  contextoDashboard: ContextoDashboard = 'documentos';

  ultimaActualizacion = '—';

  tituloVista = 'Vista Global';
  subtituloVista = 'Resumen general de documentos entregados y pendientes';

  totalDocumentos = 0;
  totalEntregados = 0;
  totalPendientes = 0;
  porcentajeEntregados = 0;
  porcentajePendientes = 0;

  totalPatrocinios = 0;
  totalPlanes = 0;
  totalSeguimientos = 0;
  totalSinFormacion = 0;

  resumenCarreras: CarreraResumen[] = [];
  resumenCarrerasFiltrado: CarreraResumen[] = [];

  sortMode: 'pct' | 'total' | 'name' = 'pct';
  filterMode: 'all' | 'alto' | 'medio' | 'bajo' = 'all';

  carreraSeleccionada = '';
  tipoSeleccionado: 'todos' | TipoRegistro = 'todos';

  registrosFiltrados: RegistroBase[] = [];
  gruposPorTipo: GrupoTipo[] = [];

  tiposHeat: TipoRegistro[] = ['patrocinio', 'plan'];

  docentesVersus: DocenteVersus[] = [];

  paleta: string[] = [
    '#38bdf8',
    '#a78bfa',
    '#2ecc9a',
    '#fbbf24',
    '#fb7185',
    '#34d399',
    '#60a5fa',
    '#f472b6',
    '#c084fc',
    '#22d3ee'
  ];

  private matrizData = new Map<string, Map<string, { ent: number; total: number }>>();
  private todosRegistros: RegistroBase[] = [];

  private refPatrocinio = ref(dbDocente, 'patrociniosGenerados');
  private refPlan = ref(dbDocente, 'planesGenerados');
  private refSeguimiento = ref(dbDocente, 'seguimientoGenerados');
  private refSinFormacion = ref(dbDocente, 'docentesSinFormacion');

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.cargarDashboard();
    this.escucharCambios();
  }

  ngOnDestroy(): void {
    off(this.refPatrocinio);
    off(this.refPlan);
    off(this.refSeguimiento);
    off(this.refSinFormacion);
  }

  cambiarVista(vista: VistaDashboard): void {
    this.vistaActiva = vista;

    const titulos: Record<VistaDashboard, string> = {
      global: 'Vista Global',
      carrera: 'Entregados por Carrera',
      tipo: 'Análisis Carrera × Tipo'
    };

    const subtitulos: Record<VistaDashboard, string> = {
      global: 'Resumen general de documentos entregados y pendientes',
      carrera: 'Comparativo de entrega agrupado por carrera académica',
      tipo: 'Filtra y cruza datos por carrera y tipo de documento'
    };

    this.tituloVista = titulos[vista];
    this.subtituloVista = subtitulos[vista];

    this.cdr.detectChanges();
  }

  cambiarContextoDashboard(contexto: ContextoDashboard): void {
    this.contextoDashboard = contexto;
    this.carreraSeleccionada = '';

    if (contexto === 'documentos') {
      this.tiposHeat = ['patrocinio', 'plan'];
      this.tipoSeleccionado = 'todos';
      this.tituloVista = 'Documentos por carrera';
      this.subtituloVista = 'Patrocinio y plan individual agrupados por carreras configuradas por el administrador';
    }

    if (contexto === 'seguimiento') {
      this.tiposHeat = ['seguimiento'];
      this.tipoSeleccionado = 'seguimiento';
      this.tituloVista = 'Seguimiento docente';
      this.subtituloVista = 'Seguimientos agrupados por la carrera ingresada por el docente';
    }

    if (contexto === 'sinFormacion') {
      this.tiposHeat = ['sinFormacion'];
      this.tipoSeleccionado = 'sinFormacion';
      this.tituloVista = 'Docentes sin formación';
      this.subtituloVista = 'Docentes que registraron no estar en proceso de formación';
    }

    this.procesarRegistros(this.obtenerRegistrosPorContexto());
  }

  setSortMode(mode: 'pct' | 'total' | 'name'): void {
    this.sortMode = mode;
    this.aplicarSortYFilter();
  }

  setFilterMode(mode: 'all' | 'alto' | 'medio' | 'bajo'): void {
    this.filterMode = mode;
    this.aplicarSortYFilter();
  }

  setTipoSeleccionado(tipo: 'todos' | TipoRegistro): void {
    this.tipoSeleccionado = tipo;
    this.filtrarPorCarreraYTipo();
  }

  filtrarPorCarreraYTipo(): void {
    let base = this.obtenerRegistrosPorContexto();

    if (this.carreraSeleccionada) {
      base = base.filter(r => this.normalizarCarrera(r.carrera) === this.carreraSeleccionada);
    }

    if (this.tipoSeleccionado !== 'todos') {
      base = base.filter(r => r.tipo === this.tipoSeleccionado);
    }

    this.registrosFiltrados = base;
    this.construirGruposPorTipo(base);
    this.cdr.detectChanges();
  }

  contarEntregados(registros: RegistroBase[]): number {
    return registros.filter(r => r.entregado).length;
  }

  contarPendientes(registros: RegistroBase[]): number {
    return registros.filter(r => !r.entregado).length;
  }

  getCellPct(carrera: string, tipo: string): number {
    const tipoMap = this.matrizData.get(carrera);
    if (!tipoMap) return 0;

    const cell = tipoMap.get(tipo);
    if (!cell || cell.total === 0) return 0;

    return Math.round((cell.ent / cell.total) * 100);
  }

  getHeatLevel(carrera: string, tipo: string): string {
    const pct = this.getCellPct(carrera, tipo);

    if (pct === 0) return '0';
    if (pct >= 70) return 'high';
    if (pct >= 40) return 'mid';

    return 'low';
  }

  escucharCambios(): void {
    onValue(this.refPatrocinio, () => this.cargarDashboard());
    onValue(this.refPlan, () => this.cargarDashboard());
    onValue(this.refSeguimiento, () => this.cargarDashboard());
    onValue(this.refSinFormacion, () => this.cargarDashboard());
  }

  cargarDashboard(): void {
    this.cargando = true;
    this.cdr.detectChanges();

    Promise.all([
      new Promise<any>(res => onValue(this.refPatrocinio, s => res(s.val()), { onlyOnce: true })),
      new Promise<any>(res => onValue(this.refPlan, s => res(s.val()), { onlyOnce: true })),
      new Promise<any>(res => onValue(this.refSeguimiento, s => res(s.val()), { onlyOnce: true })),
      new Promise<any>(res => onValue(this.refSinFormacion, s => res(s.val()), { onlyOnce: true }))
    ])
      .then(([patrocinios, planes, seguimientos, sinFormacion]) => {
        const registros: RegistroBase[] = [];

        if (patrocinios) {
          Object.values(patrocinios).forEach((grupo: any) => {
            if (!grupo || typeof grupo !== 'object') return;

            Object.values(grupo).forEach((doc: any) => {
              registros.push({
                tipo: 'patrocinio',
                carrera: this.obtenerCarrera(doc),
                entregado: Boolean(doc?.entregado),
                nombre: this.obtenerNombre(doc)
              });
            });
          });
        }

        if (planes) {
          Object.values(planes).forEach((grupo: any) => {
            if (!grupo || typeof grupo !== 'object') return;

            Object.values(grupo).forEach((doc: any) => {
              registros.push({
                tipo: 'plan',
                carrera: this.obtenerCarrera(doc),
                entregado: Boolean(doc?.entregado),
                nombre: this.obtenerNombre(doc)
              });
            });
          });
        }

        if (seguimientos) {
          Object.values(seguimientos).forEach((doc: any) => {
            if (!doc || typeof doc !== 'object') return;

            registros.push({
              tipo: 'seguimiento',
              carrera: this.obtenerCarrera(doc),
              entregado: Boolean(doc?.entregado),
              nombre: this.obtenerNombre(doc)
            });
          });
        }

        if (sinFormacion) {
          Object.values(sinFormacion).forEach((doc: any) => {
            if (!doc || typeof doc !== 'object') return;

            registros.push({
              tipo: 'sinFormacion',
              carrera: this.obtenerCarrera(doc),
              entregado: Boolean(doc?.entregado),
              nombre: this.obtenerNombre(doc)
            });
          });
        }

        this.todosRegistros = registros;
        this.procesarRegistros(this.obtenerRegistrosPorContexto());

        const now = new Date();
        this.ultimaActualizacion = now.toLocaleTimeString('es-EC', {
          hour: '2-digit',
          minute: '2-digit'
        });

        this.cargando = false;
        this.cdr.detectChanges();
      })
      .catch(err => {
        console.error('Error cargando dashboard:', err);
        this.cargando = false;
        this.cdr.detectChanges();
      });
  }

  procesarRegistros(registros: RegistroBase[]): void {
    this.totalDocumentos = registros.length;
    this.totalEntregados = registros.filter(r => r.entregado).length;
    this.totalPendientes = this.totalDocumentos - this.totalEntregados;

    this.porcentajeEntregados = this.totalDocumentos
      ? Math.round((this.totalEntregados / this.totalDocumentos) * 100)
      : 0;

    this.porcentajePendientes = this.totalDocumentos
      ? 100 - this.porcentajeEntregados
      : 0;

    this.totalPatrocinios = registros.filter(r => r.tipo === 'patrocinio').length;
    this.totalPlanes = registros.filter(r => r.tipo === 'plan').length;
    this.totalSeguimientos = registros.filter(r => r.tipo === 'seguimiento').length;
    this.totalSinFormacion = registros.filter(r => r.tipo === 'sinFormacion').length;

    this.construirResumenCarreras(registros);
    this.construirMatrizHeat(registros);
    this.construirDocentesVersus(registros);

    this.aplicarSortYFilter();
    this.filtrarPorCarreraYTipo();

    this.cargando = false;
    this.cdr.detectChanges();
  }

  private obtenerRegistrosPorContexto(): RegistroBase[] {
    if (this.contextoDashboard === 'documentos') {
      return this.todosRegistros.filter(r => r.tipo === 'patrocinio' || r.tipo === 'plan');
    }

    if (this.contextoDashboard === 'seguimiento') {
      return this.todosRegistros.filter(r => r.tipo === 'seguimiento');
    }

    return this.todosRegistros.filter(r => r.tipo === 'sinFormacion');
  }

  private aplicarSortYFilter(): void {
    let lista = [...this.resumenCarreras];

    if (this.filterMode === 'alto') {
      lista = lista.filter(i => i.porcentajeEntregados >= 70);
    }

    if (this.filterMode === 'medio') {
      lista = lista.filter(i => i.porcentajeEntregados >= 40 && i.porcentajeEntregados < 70);
    }

    if (this.filterMode === 'bajo') {
      lista = lista.filter(i => i.porcentajeEntregados < 40);
    }

    if (this.sortMode === 'pct') {
      lista.sort((a, b) => b.porcentajeEntregados - a.porcentajeEntregados);
    }

    if (this.sortMode === 'total') {
      lista.sort((a, b) => b.total - a.total);
    }

    if (this.sortMode === 'name') {
      lista.sort((a, b) => a.carrera.localeCompare(b.carrera));
    }

    this.resumenCarrerasFiltrado = lista;
  }

  private construirResumenCarreras(registros: RegistroBase[]): void {
    const mapa = new Map<string, CarreraResumen>();

    registros.forEach(r => {
      const carrera = this.normalizarCarrera(r.carrera);

      if (!mapa.has(carrera)) {
        mapa.set(carrera, {
          carrera,
          total: 0,
          entregados: 0,
          pendientes: 0,
          porcentajeEntregados: 0
        });
      }

      const item = mapa.get(carrera)!;
      item.total++;

      if (r.entregado) {
        item.entregados++;
      } else {
        item.pendientes++;
      }
    });

    this.resumenCarreras = Array.from(mapa.values()).map(item => ({
      ...item,
      porcentajeEntregados: item.total
        ? Math.round((item.entregados / item.total) * 100)
        : 0
    }));
  }

  private construirMatrizHeat(registros: RegistroBase[]): void {
    this.matrizData.clear();

    registros.forEach(r => {
      const carrera = this.normalizarCarrera(r.carrera);

      if (!this.matrizData.has(carrera)) {
        this.matrizData.set(carrera, new Map());
      }

      const tipoMap = this.matrizData.get(carrera)!;

      if (!tipoMap.has(r.tipo)) {
        tipoMap.set(r.tipo, { ent: 0, total: 0 });
      }

      const cell = tipoMap.get(r.tipo)!;
      cell.total++;

      if (r.entregado) {
        cell.ent++;
      }
    });
  }

  private construirGruposPorTipo(base: RegistroBase[]): void {
    const tipos: { key: TipoRegistro; label: string }[] = [
      { key: 'patrocinio', label: 'Patrocinios' },
      { key: 'plan', label: 'Plan Individual' },
      { key: 'seguimiento', label: 'Seguimientos' },
      { key: 'sinFormacion', label: 'Sin formación' }
    ];

    this.gruposPorTipo = tipos
      .filter(t => {
        if (this.contextoDashboard === 'documentos') {
          return t.key === 'patrocinio' || t.key === 'plan';
        }

        if (this.contextoDashboard === 'seguimiento') {
          return t.key === 'seguimiento';
        }

        return t.key === 'sinFormacion';
      })
      .map(t => {
        const sub = base.filter(r => r.tipo === t.key);
        const entregados = sub.filter(r => r.entregado).length;
        const pendientes = sub.length - entregados;
        const total = sub.length;

        return {
          label: t.label,
          tipo: t.key,
          total,
          entregados,
          pendientes,
          pctEnt: total ? Math.round((entregados / total) * 100) : 0,
          pctPend: total ? Math.round((pendientes / total) * 100) : 0
        };
      })
      .filter(g => g.total > 0);
  }

  private construirDocentesVersus(registros: RegistroBase[]): void {
    const mapa = new Map<string, DocenteVersus>();
    const total = registros.length;

    registros.forEach(r => {
      const nombre = (r.nombre || 'Docente sin nombre').trim() || 'Docente sin nombre';
      const carrera = this.normalizarCarrera(r.carrera);
      const key = `${nombre}__${carrera}`;

      if (!mapa.has(key)) {
        mapa.set(key, {
          nombre,
          carrera,
          total: 0,
          ent: 0,
          pend: 0,
          pctEntregado: 0,
          pctDelTotal: 0
        });
      }

      const item = mapa.get(key)!;
      item.total++;

      if (r.entregado) {
        item.ent++;
      } else {
        item.pend++;
      }
    });

    this.docentesVersus = Array.from(mapa.values())
      .map(d => ({
        ...d,
        pctEntregado: d.total ? Math.round((d.ent / d.total) * 100) : 0,
        pctDelTotal: total ? Math.round((d.total / total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }

  private normalizarCarrera(carrera: any): string {
    return String(carrera || 'Sin carrera').trim() || 'Sin carrera';
  }

  private obtenerCarrera(doc: any): string {
    return this.normalizarCarrera(
      doc?.carrera ||
      doc?.CarreraCursando ||
      doc?.datosDocumento?.carrera ||
      doc?.datosDocumento?.CarreraCursando ||
      'Sin carrera'
    );
  }

  private obtenerNombre(doc: any): string {
    return String(
      doc?.nombre ||
      doc?.docente ||
      doc?.nombres ||
      doc?.nombreDocente ||
      doc?.['Nombres Completos'] ||
      doc?.datosDocumento?.nombre ||
      doc?.datosDocumento?.docente ||
      doc?.datosDocumento?.nombres ||
      doc?.datosDocumento?.['Nombres Completos'] ||
      'Docente sin nombre'
    ).trim();
  }
}
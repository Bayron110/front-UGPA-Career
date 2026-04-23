import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { off, onValue, ref } from 'firebase/database';
import { dbDocente } from '../../../../../firebase/firebase-docente';

/* ─── Interfaces ─────────────────────────────────────────── */

interface RegistroBase {
  tipo: 'patrocinio' | 'plan' | 'seguimiento';
  carrera: string;
  entregado: boolean;
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

/* ─── Componente ─────────────────────────────────────────── */

@Component({
  selector: 'app-dasboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './dasboard.html',
  styleUrl: './dasboard.css'
})
export class Dasboard implements OnInit, OnDestroy {

  /* ── Estado general ── */
  cargando     = true;
  vistaActiva: 'global' | 'carrera' | 'tipo' = 'global';
  ultimaActualizacion = '—';

  tituloVista   = 'Vista Global';
  subtituloVista = 'Resumen general de documentos entregados y pendientes';

  /* ── KPIs globales ── */
  totalDocumentos      = 0;
  totalEntregados      = 0;
  totalPendientes      = 0;
  porcentajeEntregados = 0;
  porcentajePendientes = 0;

  /* ── Por tipo ── */
  totalPatrocinios  = 0;
  totalPlanes       = 0;
  totalSeguimientos = 0;

  /* ── Vista Carrera ── */
  resumenCarreras:        CarreraResumen[] = [];
  resumenCarrerasFiltrado: CarreraResumen[] = [];
  sortMode   = 'pct';
  filterMode = 'all';

  /* ── Vista Carrera + Tipo ── */
  carreraSeleccionada = '';
  tipoSeleccionado    = 'todos';
  registrosFiltrados: RegistroBase[] = [];
  gruposPorTipo: GrupoTipo[] = [];

  private matrizData    = new Map<string, Map<string, { ent: number; total: number }>>();
  private todosRegistros: RegistroBase[] = [];

  private refPatrocinio  = ref(dbDocente, 'patrociniosGenerados');
  private refPlan        = ref(dbDocente, 'planesGenerados');
  private refSeguimiento = ref(dbDocente, 'seguimientoGenerados');

  constructor(private cdr: ChangeDetectorRef) {}
  tiposHeat: string[] = ['patrocinio', 'plan', 'seguimiento'];

  ngOnInit(): void {
    this.cargarDashboard();
    this.escucharCambios();
  }

  ngOnDestroy(): void {
    off(this.refPatrocinio);
    off(this.refPlan);
    off(this.refSeguimiento);
  }

  /* ══ Navegación ══ */

  cambiarVista(vista: 'global' | 'carrera' | 'tipo'): void {
    this.vistaActiva = vista;

    const titulos: Record<string, string> = {
      global:  'Vista Global',
      carrera: 'Entregados por Carrera',
      tipo:    'Análisis Carrera × Tipo'
    };
    const subtitulos: Record<string, string> = {
      global:  'Resumen general de documentos entregados y pendientes',
      carrera: 'Comparativo de entrega agrupado por carrera académica',
      tipo:    'Filtra y cruza datos por carrera y tipo de documento'
    };

    this.tituloVista    = titulos[vista];
    this.subtituloVista = subtitulos[vista];
    this.cdr.detectChanges();
  }

  /* ══ Sort / Filter — Vista Carrera ══ */

  setSortMode(mode: string): void {
    this.sortMode = mode;
    this.aplicarSortYFilter();
  }

  setFilterMode(mode: string): void {
    this.filterMode = mode;
    this.aplicarSortYFilter();
  }

  private aplicarSortYFilter(): void {
    let lista = [...this.resumenCarreras];

    /* Filtro por nivel */
    if (this.filterMode === 'alto')  lista = lista.filter(i => i.porcentajeEntregados >= 70);
    if (this.filterMode === 'medio') lista = lista.filter(i => i.porcentajeEntregados >= 40 && i.porcentajeEntregados < 70);
    if (this.filterMode === 'bajo')  lista = lista.filter(i => i.porcentajeEntregados < 40);

    /* Ordenamiento */
    if (this.sortMode === 'pct')   lista.sort((a, b) => b.porcentajeEntregados - a.porcentajeEntregados);
    if (this.sortMode === 'total') lista.sort((a, b) => b.total - a.total);
    if (this.sortMode === 'name')  lista.sort((a, b) => a.carrera.localeCompare(b.carrera));

    this.resumenCarrerasFiltrado = lista;
    this.cdr.detectChanges();
  }

  /* ══ Vista Carrera + Tipo ══ */

  setTipoSeleccionado(tipo: string): void {
    this.tipoSeleccionado = tipo;
    this.filtrarPorCarreraYTipo();
  }

  filtrarPorCarreraYTipo(): void {
    let base = this.todosRegistros;

    if (this.carreraSeleccionada) {
      base = base.filter(r => (r.carrera || 'Sin carrera').trim() === this.carreraSeleccionada);
    }

    if (this.tipoSeleccionado !== 'todos') {
      base = base.filter(r => r.tipo === this.tipoSeleccionado);
    }

    this.registrosFiltrados = base;

    const tipos: { key: 'patrocinio' | 'plan' | 'seguimiento'; label: string }[] = [
      { key: 'patrocinio',  label: 'Patrocinios' },
      { key: 'plan',        label: 'Plan Individual' },
      { key: 'seguimiento', label: 'Seguimientos' }
    ];

    this.gruposPorTipo = tipos.map(t => {
      const sub   = base.filter(r => r.tipo === t.key);
      const ent   = sub.filter(r => r.entregado).length;
      const pend  = sub.length - ent;
      const total = sub.length;
      return {
        label:      t.label,
        tipo:       t.key,
        total,
        entregados: ent,
        pendientes: pend,
        pctEnt:     total ? Math.round((ent  / total) * 100) : 0,
        pctPend:    total ? Math.round((pend / total) * 100) : 0
      };
    }).filter(g => g.total > 0);

    this.cdr.detectChanges();
  }

  /* ══ Helpers para el template ══ */

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

  /* ══ Firebase ══ */

  escucharCambios(): void {
    onValue(this.refPatrocinio,  () => this.cargarDashboard());
    onValue(this.refPlan,        () => this.cargarDashboard());
    onValue(this.refSeguimiento, () => this.cargarDashboard());
  }

  cargarDashboard(): void {
    this.cargando = true;
    this.cdr.detectChanges();

    Promise.all([
      new Promise<any>(res => onValue(this.refPatrocinio,  s => res(s.val()), { onlyOnce: true })),
      new Promise<any>(res => onValue(this.refPlan,        s => res(s.val()), { onlyOnce: true })),
      new Promise<any>(res => onValue(this.refSeguimiento, s => res(s.val()), { onlyOnce: true }))
    ])
    .then(([patrocinios, planes, seguimientos]) => {
      const registros: RegistroBase[] = [];

      if (patrocinios) {
        Object.values(patrocinios).forEach((docs: any) => {
          if (!docs || typeof docs !== 'object') return;
          Object.values(docs).forEach((doc: any) => {
            registros.push({ tipo: 'patrocinio', carrera: doc?.carrera ?? '', entregado: Boolean(doc?.entregado) });
          });
        });
      }

      if (planes) {
        Object.values(planes).forEach((docs: any) => {
          if (!docs || typeof docs !== 'object') return;
          Object.values(docs).forEach((doc: any) => {
            registros.push({ tipo: 'plan', carrera: doc?.carrera ?? '', entregado: Boolean(doc?.entregado) });
          });
        });
      }

      if (seguimientos) {
        Object.values(seguimientos).forEach((doc: any) => {
          registros.push({ tipo: 'seguimiento', carrera: doc?.carrera ?? '', entregado: Boolean(doc?.entregado) });
        });
      }

      this.todosRegistros = registros;
      this.procesarRegistros(registros);

      const now = new Date();
      this.ultimaActualizacion = now.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    })
    .catch(err => {
      console.error('Error cargando dashboard:', err);
      this.cargando = false;
      this.cdr.detectChanges();
    });
  }

  procesarRegistros(registros: RegistroBase[]): void {
    /* KPIs globales */
    this.totalDocumentos      = registros.length;
    this.totalEntregados      = registros.filter(r => r.entregado).length;
    this.totalPendientes      = this.totalDocumentos - this.totalEntregados;
    this.porcentajeEntregados = this.totalDocumentos
      ? Math.round((this.totalEntregados / this.totalDocumentos) * 100) : 0;
    this.porcentajePendientes = 100 - this.porcentajeEntregados;

    /* Por tipo */
    this.totalPatrocinios  = registros.filter(r => r.tipo === 'patrocinio').length;
    this.totalPlanes       = registros.filter(r => r.tipo === 'plan').length;
    this.totalSeguimientos = registros.filter(r => r.tipo === 'seguimiento').length;

    /* Por carrera */
    const mapa = new Map<string, CarreraResumen>();
    registros.forEach(r => {
      const nombre = (r.carrera || 'Sin carrera').trim() || 'Sin carrera';
      if (!mapa.has(nombre)) {
        mapa.set(nombre, { carrera: nombre, total: 0, entregados: 0, pendientes: 0, porcentajeEntregados: 0 });
      }
      const item = mapa.get(nombre)!;
      item.total++;
      r.entregado ? item.entregados++ : item.pendientes++;
    });

    this.resumenCarreras = Array.from(mapa.values()).map(item => ({
      ...item,
      porcentajeEntregados: item.total ? Math.round((item.entregados / item.total) * 100) : 0
    }));

    /* Construir matriz heat */
    this.matrizData.clear();
    registros.forEach(r => {
      const c = (r.carrera || 'Sin carrera').trim() || 'Sin carrera';
      if (!this.matrizData.has(c)) this.matrizData.set(c, new Map());
      const tipoMap = this.matrizData.get(c)!;
      if (!tipoMap.has(r.tipo)) tipoMap.set(r.tipo, { ent: 0, total: 0 });
      const cell = tipoMap.get(r.tipo)!;
      cell.total++;
      if (r.entregado) cell.ent++;
    });

    /* Aplicar sort/filter iniciales y sincronizar vista tipo */
    this.aplicarSortYFilter();
    this.filtrarPorCarreraYTipo();

    this.cargando = false;
    this.cdr.detectChanges();
  }
}
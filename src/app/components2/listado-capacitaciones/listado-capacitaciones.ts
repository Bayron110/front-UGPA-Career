import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CareerService } from '../../services/Career/caeer-service';
import { DocenteService } from '../../services/docentes/docente';
import { Career } from '../../Interface/Career';
import { Docente } from '../../Interface/Docente';
import { Capacitacion } from '../../Interface/Capacitacion';

interface ControlFila {
  docenteId: string;
  capacitacionSeleccionadaId: string;
  entregoAcuerdoPatrocinio: boolean;
  entregoPlanIndividual: boolean;
  observacion: string;
  fechaActualizacion: string;
}

@Component({
  selector: 'app-listado-capacitaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listado-capacitaciones.html',
  styleUrl: './listado-capacitaciones.css'
})
export class ListadoCapacitaciones implements OnInit {
  docentes: Docente[] = [];
  docentesFiltrados: Docente[] = [];
  carreras: Career[] = [];

  cargando = false;
  error = '';
  busqueda = '';

  controlFilas: { [docenteId: string]: ControlFila } = {};

  constructor(
    private docenteService: DocenteService,
    private careerService: CareerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarControlLocal();
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    this.careerService.obtenerCarreras().subscribe({
      next: (carrerasData) => {
        this.carreras = carrerasData || [];

        this.docenteService.obtenerDocentes().subscribe({
          next: (docentesData) => {
            this.docentes = docentesData || [];
            this.inicializarControles();
            this.filtrar();
            this.cargando = false;
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error al obtener docentes:', err);
            this.error = 'No se pudieron cargar los docentes.';
            this.cargando = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        console.error('Error al obtener carreras:', err);
        this.error = 'No se pudieron cargar las carreras.';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  cargarDocentes(): void {
    this.cargarDatos();
  }

  inicializarControles(): void {
    for (const docente of this.docentes) {
      const id = this.getDocenteId(docente);

      if (!id) continue;

      if (!this.controlFilas[id]) {
        this.controlFilas[id] = {
          docenteId: id,
          capacitacionSeleccionadaId: '',
          entregoAcuerdoPatrocinio: false,
          entregoPlanIndividual: false,
          observacion: '',
          fechaActualizacion: new Date().toISOString()
        };
      }
    }

    this.guardarLocal();
  }

  getDocenteId(docente: any): string {
    return docente?.id || docente?._id || '';
  }

  getCarreraId(docente: any): string {
    return docente?.carreraId || '';
  }

  getNombreDocente(docente: any): string {
    return docente?.nombre || docente?.nombreDocente || 'Sin nombre';
  }

  getNombreCarrera(docente: any): string {
    const carrera = this.getCarreraDeDocente(docente);
    return carrera?.nombre || carrera?.capacitaciones || docente?.carrera || 'Sin carrera';
  }

  getCarreraDeDocente(docente: any): Career | undefined {
    const carreraId = this.getCarreraId(docente);
    if (!carreraId) return undefined;

    return this.carreras.find(
      (c: any) => (c.id || c._id) === carreraId
    );
  }

  getCapacitacionesPorDocente(docente: any): Capacitacion[] {
    const carrera = this.getCarreraDeDocente(docente);
    return carrera?.capacitaciones || [];
  }

  getCapacitacionId(cap: Capacitacion, index: number, docente?: any): string {
    const anyCap: any = cap;

    if (anyCap?.id) return anyCap.id;
    if (anyCap?._id) return anyCap._id;

    const carreraId = docente ? this.getCarreraId(docente) : 'sin-carrera';
    const nombre = cap?.nombre || 'sin-nombre';

    return `${carreraId}-${index}-${nombre}`;
  }

  getNombreCapacitacion(cap: any): string {
    return cap?.nombre || 'Sin nombre';
  }

  getControl(docente: any): ControlFila {
    const docenteId = this.getDocenteId(docente);

    if (!this.controlFilas[docenteId]) {
      this.controlFilas[docenteId] = {
        docenteId,
        capacitacionSeleccionadaId: '',
        entregoAcuerdoPatrocinio: false,
        entregoPlanIndividual: false,
        observacion: '',
        fechaActualizacion: new Date().toISOString()
      };
    }

    return this.controlFilas[docenteId];
  }

  getCapacitacionSeleccionada(docente: any): Capacitacion | undefined {
    const control = this.getControl(docente);
    const caps = this.getCapacitacionesPorDocente(docente);

    return caps.find((cap, index) =>
      this.getCapacitacionId(cap, index, docente) === control.capacitacionSeleccionadaId
    );
  }

  filtrar(): void {
    const texto = this.busqueda.trim().toLowerCase();

    if (!texto) {
      this.docentesFiltrados = [...this.docentes];
      return;
    }

    this.docentesFiltrados = this.docentes.filter((docente: any) => {
      const nombreDocente = this.getNombreDocente(docente).toLowerCase();
      const nombreCarrera = this.getNombreCarrera(docente).toLowerCase();

      return nombreDocente.includes(texto) || nombreCarrera.includes(texto);
    });
  }

  onBusquedaChange(): void {
    this.filtrar();
  }

  guardarCambios(docente: any): void {
    const docenteId = this.getDocenteId(docente);

    if (this.controlFilas[docenteId]) {
      this.controlFilas[docenteId].fechaActualizacion = new Date().toISOString();
      this.guardarLocal();
      this.cdr.detectChanges();
    }
  }

  onCapacitacionChange(docente: any): void {
    const control = this.getControl(docente);
    control.entregoAcuerdoPatrocinio = false;
    this.guardarCambios(docente);
  }

  limpiarFila(docente: any): void {
    const docenteId = this.getDocenteId(docente);

    this.controlFilas[docenteId] = {
      docenteId,
      capacitacionSeleccionadaId: '',
      entregoAcuerdoPatrocinio: false,
      entregoPlanIndividual: false,
      observacion: '',
      fechaActualizacion: new Date().toISOString()
    };

    this.guardarLocal();
    this.cdr.detectChanges();
  }

  guardarLocal(): void {
    localStorage.setItem('ctrl_cap_docentes', JSON.stringify(this.controlFilas));
  }

  cargarControlLocal(): void {
    const raw = localStorage.getItem('ctrl_cap_docentes');
    if (raw) {
      try {
        this.controlFilas = JSON.parse(raw);
      } catch (e) {
        console.error('Error al leer localStorage:', e);
        this.controlFilas = {};
      }
    }
  }

  totalDocentes(): number {
    return this.docentes.length;
  }

  totalCompletos(): number {
    return this.docentes.filter((docente) => {
      const c = this.getControl(docente);
      return c.entregoAcuerdoPatrocinio && c.entregoPlanIndividual;
    }).length;
  }

  totalPendientes(): number {
    return this.docentes.filter((docente) => {
      const c = this.getControl(docente);
      return !(c.entregoAcuerdoPatrocinio && c.entregoPlanIndividual);
    }).length;
  }

  estadoBadge(docente: any): 'completo' | 'proceso' | 'pendiente' {
    const c = this.getControl(docente);
    const entregados =
      (c.entregoAcuerdoPatrocinio ? 1 : 0) +
      (c.entregoPlanIndividual ? 1 : 0);

    if (entregados === 2) return 'completo';
    if (entregados === 1) return 'proceso';
    return 'pendiente';
  }

  estadoTexto(docente: any): string {
    const estado = this.estadoBadge(docente);

    if (estado === 'completo') return 'Completo';
    if (estado === 'proceso') return 'En proceso';
    return 'Pendiente';
  }

  trackByDocente(index: number, docente: any): string {
    return this.getDocenteId(docente) || index.toString();
  }
}
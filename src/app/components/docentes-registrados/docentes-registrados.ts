import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DocentesRegistradosService,
  RegistroPatrocinio,
  RegistroPlan,
  DocenteAgrupado,
  Registro
} from '../../services/registro-act/docentes-registrados'; // ajusta el path si lo pones en otra carpeta

interface DocenteConSedes extends DocenteAgrupado {
  sedes: string[];
  tieneConflictoSede: boolean;
  patrociniosFaltantes: number;
  planesFaltantes: number;
  incompleto: boolean;
}

@Component({
  selector: 'app-docentes-registrados',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './docentes-registrados.html',
  styleUrl: './docentes-registrados.css'
})

export class DocentesRegistrados implements OnInit, OnDestroy {

  private unsubPatrocinios: (() => void) | null = null;
  private unsubPlanes: (() => void) | null = null;

  cargando = signal(true);
  busqueda = signal('');

  patrocinios = signal<RegistroPatrocinio[]>([]);
  planes = signal<RegistroPlan[]>([]);

  soloConflictosSede = signal(false);
  soloIncompletos = signal(false);

  // Cantidad de documentos esperada por docente. Ajusta aquí si cambia la regla.
  private readonly PATROCINIOS_ESPERADOS = 2;
  private readonly PLANES_ESPERADOS = 1;

  // Agrupa por cédula, mezclando patrocinios + planes
  docentesAgrupados = computed<DocenteAgrupado[]>(() => {
    const mapa = new Map<string, DocenteAgrupado>();

    for (const p of this.patrocinios()) {
      if (!mapa.has(p.cedula)) {
        mapa.set(p.cedula, { cedula: p.cedula, docente: p.docente, patrocinios: [], planes: [] });
      }
      mapa.get(p.cedula)!.patrocinios.push(p);
    }

    for (const pl of this.planes()) {
      if (!mapa.has(pl.cedula)) {
        mapa.set(pl.cedula, { cedula: pl.cedula, docente: pl.docente, patrocinios: [], planes: [] });
      }
      const grupo = mapa.get(pl.cedula)!;
      grupo.planes.push(pl);
      if (!grupo.docente) grupo.docente = pl.docente;
    }

    return Array.from(mapa.values()).sort((a, b) => a.docente.localeCompare(b.docente, 'es'));
  });

  docentesConSedes = computed<DocenteConSedes[]>(() => {
    return this.docentesAgrupados().map(d => {
      const sedes = new Set<string>();
      d.patrocinios.forEach(p => { if (p.sede) sedes.add(p.sede); });
      d.planes.forEach(p => { if (p.sede) sedes.add(p.sede); });
      const sedesArr = Array.from(sedes);

      const patrociniosFaltantes = Math.max(0, this.PATROCINIOS_ESPERADOS - d.patrocinios.length);
      const planesFaltantes = Math.max(0, this.PLANES_ESPERADOS - d.planes.length);

      return {
        ...d,
        sedes: sedesArr,
        tieneConflictoSede: sedesArr.length > 1,
        patrociniosFaltantes,
        planesFaltantes,
        incompleto: patrociniosFaltantes > 0 || planesFaltantes > 0
      };
    });
  });

  docentesFiltrados = computed<DocenteConSedes[]>(() => {
    const q = this.busqueda().trim().toLowerCase();
    let lista = this.docentesConSedes();

    if (this.soloConflictosSede()) {
      lista = lista.filter(d => d.tieneConflictoSede);
    }
    if (this.soloIncompletos()) {
      lista = lista.filter(d => d.incompleto);
    }

    if (!q) return lista;

    return lista.filter(d =>
      d.cedula.toLowerCase().includes(q) ||
      d.docente.toLowerCase().includes(q) ||
      d.patrocinios.some(p => p.carrera.toLowerCase().includes(q) || p.capacitacion.toLowerCase().includes(q)) ||
      d.planes.some(p => p.carrera.toLowerCase().includes(q))
    );
  });

  totalRegistros = computed(() => this.patrocinios().length + this.planes().length);

  totalConflictosSede = computed(() =>
    this.docentesConSedes().filter(d => d.tieneConflictoSede).length
  );

  totalIncompletos = computed(() =>
    this.docentesConSedes().filter(d => d.incompleto).length
  );

  // ── Estado del modal de edición/duplicado ──
  modalAbierto = signal(false);
  esNuevoDuplicado = signal(false);
  registroOriginal: Registro | null = null;
  edicion = signal<Registro | null>(null);
  guardando = signal(false);

  constructor(private svc: DocentesRegistradosService) { }

  ngOnInit(): void {
    this.unsubPatrocinios = this.svc.escucharPatrocinios((data) => {
      this.patrocinios.set(data);
      this.cargando.set(false);
    });
    this.unsubPlanes = this.svc.escucharPlanes((data) => {
      this.planes.set(data);
      this.cargando.set(false);
    });
  }

  ngOnDestroy(): void {
    this.unsubPatrocinios?.();
    this.unsubPlanes?.();
  }

  // ── Acciones de fila ──
  editar(registro: Registro) {
    this.registroOriginal = registro;
    this.esNuevoDuplicado.set(false);
    this.edicion.set(structuredClone(registro));
    this.modalAbierto.set(true);
  }

  duplicar(registro: Registro) {
    this.registroOriginal = registro;
    this.esNuevoDuplicado.set(true);

    const copia = structuredClone(registro);
    copia.cedula = '';
    if (copia.tipo === 'patrocinio') {
      copia.capacitacion = '';
      copia.codigo = '';
    } else {
      copia.codigo = '';
    }
    this.edicion.set(copia);
    this.modalAbierto.set(true);
  }

  async eliminar(registro: Registro) {
    const etiqueta = registro.tipo === 'patrocinio' ? registro.capacitacion : registro.codigo;
    const confirmado = confirm(`¿Eliminar "${etiqueta}" de ${registro.docente}? Esta acción no se puede deshacer.`);
    if (!confirmado) return;

    if (registro.tipo === 'patrocinio') {
      await this.svc.eliminarPatrocinio(registro.cedula, registro.clave);
    } else {
      await this.svc.eliminarPlan(registro.cedula, registro.clave);
    }
  }

  async toggleEntregado(registro: Registro) {
    const nuevoValor = !registro.entregado;
    if (registro.tipo === 'patrocinio') {
      await this.svc.marcarEntregadoPatrocinio(registro.cedula, registro.clave, nuevoValor);
    } else {
      await this.svc.marcarEntregadoPlan(registro.cedula, registro.clave, nuevoValor);
    }
  }

  // ── Modal ──
  cerrarModal() {
    this.modalAbierto.set(false);
    this.registroOriginal = null;
    this.edicion.set(null);
  }

  async guardarModal() {
    const nuevo = this.edicion();
    if (!nuevo || !this.registroOriginal) return;

    if (!nuevo.cedula.trim() || !nuevo.docente.trim()) {
      alert('Cédula y docente son obligatorios');
      return;
    }
    if (nuevo.tipo === 'patrocinio' && !nuevo.capacitacion.trim()) {
      alert('La capacitación es obligatoria');
      return;
    }
    if (!nuevo.codigo.trim()) {
      alert('El código es obligatorio');
      return;
    }

    this.guardando.set(true);
    try {
      if (nuevo.tipo === 'patrocinio') {
        await this.svc.guardarPatrocinio(
          this.registroOriginal as RegistroPatrocinio,
          nuevo,
          this.esNuevoDuplicado()
        );
      } else {
        await this.svc.guardarPlan(
          this.registroOriginal as RegistroPlan,
          nuevo,
          this.esNuevoDuplicado()
        );
      }
      this.cerrarModal();
    } catch (error) {
      console.error(error);
      alert('Ocurrió un error al guardar');
    } finally {
      this.guardando.set(false);
    }
  }
}
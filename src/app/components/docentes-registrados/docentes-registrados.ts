import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { ref, update, onValue, off, DataSnapshot } from 'firebase/database';
import { dbDocente } from '../../firebase/firebase-docente';
import { tienePermiso } from '../../guards/permisos-guard';

type Rol = 'docente' | 'coordinador';

interface Docente {
  cedula: string;
  nombresCompletos: string;
  carreras: string[]; // ahora docentes y coordinadores pueden tener varias carreras
  rol: Rol;
}

interface CambioPendiente {
  rol: Rol;
  carreras: string[];
}

interface NuevoDocenteForm {
  cedula: string;
  nombresCompletos: string;
  rol: Rol;
  carreras: string[];
  carreraNueva: string;
}

@Component({
  selector: 'app-docentes-registrados',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './docentes-registrados.html',
  styleUrl: './docentes-registrados.css'
})
export class DocentesRegistrados implements OnInit, OnDestroy {

  // ── Permiso del módulo (clave 'irADocentes' según MODULOS_SISTEMA) ──
  puedeEditar = tienePermiso('irADocentes', 'edicion');

  // ── Tabs ──
  tabActiva = signal<'cargar' | 'registrados'>('registrados');

  cambiarTab(tab: 'cargar' | 'registrados'): void {
    if (tab === 'cargar' && !this.puedeEditar) return;
    this.tabActiva.set(tab);
  }

  // ── Carga de Excel (subida inicial de docentes) ──
  docentes = signal<Docente[]>([]);
  cargando = signal(false);
  mensaje = signal<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  nombreArchivo = signal<string>('');

  onFileSelected(event: Event): void {
    if (!this.puedeEditar) return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.nombreArchivo.set(file.name);
    this.mensaje.set(null);

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const primeraHoja = workbook.Sheets[workbook.SheetNames[0]];

        const filas: any[][] = XLSX.utils.sheet_to_json(primeraHoja, { header: 1 });

        const docentesParseados: Docente[] = filas
          .slice(1)
          .filter(fila => fila.length > 0 && fila[0])
          .map(fila => ({
            cedula: String(fila[0]).trim(),
            nombresCompletos: String(fila[1] ?? '').trim(),
            // El Excel sigue trayendo una carrera por fila; queda como primer elemento del arreglo.
            // Si luego necesita más carreras, se editan desde la tabla de "Docentes Registrados".
            carreras: [String(fila[2] ?? '').trim()].filter(c => c.length > 0),
            rol: 'docente' as Rol
          }));

        this.docentes.set(docentesParseados);
      } catch (error) {
        console.error(error);
        this.mensaje.set({ tipo: 'error', texto: 'No se pudo leer el archivo. Verificá el formato.' });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async guardarEnFirebase(): Promise<void> {
    if (!this.puedeEditar) return;

    if (this.docentes().length === 0) {
      this.mensaje.set({ tipo: 'error', texto: 'No hay datos para guardar.' });
      return;
    }

    this.cargando.set(true);
    this.mensaje.set(null);

    try {
      const updates: Record<string, Docente> = {};
      for (const docente of this.docentes()) {
        if (!docente.cedula) continue;
        updates[`docentes-registrados/${docente.cedula}`] = docente;
      }

      await update(ref(dbDocente), updates);

      this.mensaje.set({
        tipo: 'ok',
        texto: `Se guardaron ${this.docentes().length} docentes correctamente.`
      });
      this.docentes.set([]);
      this.nombreArchivo.set('');
      this.tabActiva.set('registrados');
    } catch (error) {
      console.error(error);
      this.mensaje.set({ tipo: 'error', texto: 'Ocurrió un error al guardar en la base de datos.' });
    } finally {
      this.cargando.set(false);
    }
  }

  limpiar(): void {
    if (!this.puedeEditar) return;
    this.docentes.set([]);
    this.nombreArchivo.set('');
    this.mensaje.set(null);
  }

  // ── Listado desde la base de datos (tiempo real) ──
  docentesRegistrados = signal<Docente[]>([]);
  cargandoRegistrados = signal(true);

  // Filtro por carrera
  carreraSeleccionada = signal<string>('todas');

  private refDocentes = ref(dbDocente, 'docentes-registrados');
  private listenerCallback = (snapshot: DataSnapshot) => {
    const valor = snapshot.val() as Record<string, any> | null;

    const lista: Docente[] = valor
      ? Object.values(valor).map((d: any) => ({
          cedula: String(d.cedula ?? ''),
          nombresCompletos: String(d.nombresCompletos ?? ''),
          rol: (d.rol === 'coordinador' ? 'coordinador' : 'docente') as Rol,
          // Compatibilidad con datos guardados antes de este cambio:
          // "carreras" (nuevo) > "carrerasACargo" (coordinador viejo) > "carrera" (docente viejo)
          carreras: Array.isArray(d.carreras)
            ? d.carreras
            : Array.isArray(d.carrerasACargo)
              ? d.carrerasACargo
              : d.carrera
                ? [String(d.carrera)]
                : []
        }))
      : [];

    this.docentesRegistrados.set(lista);
    this.cargandoRegistrados.set(false);
  };

  // Lista de carreras únicas (para selects y checklists)
  carrerasDisponibles = computed(() => {
    const set = new Set(this.docentesRegistrados().flatMap(d => d.carreras));
    return Array.from(set).filter(c => c.length > 0).sort((a, b) => a.localeCompare(b));
  });

  // Docentes agrupados por carrera (si un docente tiene varias, aparece en cada grupo)
  docentesPorCarrera = computed(() => {
    const filtro = this.carreraSeleccionada();
    const base = this.docentesRegistrados();

    const grupos: Record<string, Docente[]> = {};
    for (const d of base) {
      const carrerasDelDocente = this.carrerasMostradas(d).length > 0 ? this.carrerasMostradas(d) : ['Sin carrera'];
      for (const carrera of carrerasDelDocente) {
        if (filtro !== 'todas' && carrera !== filtro) continue;
        if (!grupos[carrera]) grupos[carrera] = [];
        // evita duplicar el mismo docente dos veces si ya quedó en este grupo
        if (!grupos[carrera].some(x => x.cedula === d.cedula)) {
          grupos[carrera].push(d);
        }
      }
    }
    for (const carrera in grupos) {
      grupos[carrera].sort((a, b) => a.nombresCompletos.localeCompare(b.nombresCompletos));
    }
    return Object.keys(grupos)
      .sort((a, b) => a.localeCompare(b))
      .map(carrera => ({ carrera, docentes: grupos[carrera] }));
  });

  cambiarFiltroCarrera(carrera: string): void {
    this.carreraSeleccionada.set(carrera);
  }

  // ── Cambios pendientes (rol + carreras) ──
  cambiosPendientes = signal<Map<string, CambioPendiente>>(new Map());
  guardandoCambios = signal(false);
  menuCarrerasAbierto = signal<string | null>(null); // cédula del docente con el checklist abierto

  hayCambiosPendientes = computed(() => this.cambiosPendientes().size > 0);
  cantidadCambiosPendientes = computed(() => this.cambiosPendientes().size);

  docenteSeleccionado = computed(() => {
    const cedula = this.menuCarrerasAbierto();
    if (!cedula) return null;
    return this.docentesRegistrados().find(d => d.cedula === cedula) ?? null;
  });

  rolMostrado(docente: Docente): Rol {
    return this.cambiosPendientes().get(docente.cedula)?.rol ?? docente.rol;
  }

  carrerasMostradas(docente: Docente): string[] {
    return this.cambiosPendientes().get(docente.cedula)?.carreras ?? docente.carreras ?? [];
  }

  tieneCambioPendiente(docente: Docente): boolean {
    return this.cambiosPendientes().has(docente.cedula);
  }

  estaCarreraAsignada(docente: Docente, carrera: string): boolean {
    return this.carrerasMostradas(docente).includes(carrera);
  }

  // Carreras que ya tiene a cargo OTRO coordinador (para excluirlas del checklist)
  private carrerasOcupadasPorOtrosCoordinadores(cedulaAIgnorar: string): Set<string> {
    const ocupadas = new Set<string>();
    for (const otro of this.docentesRegistrados()) {
      if (otro.cedula === cedulaAIgnorar) continue;
      if (this.rolMostrado(otro) !== 'coordinador') continue;
      for (const c of this.carrerasMostradas(otro)) ocupadas.add(c);
    }
    return ocupadas;
  }

  // Carreras que se muestran en el checklist del modal de edición:
  // - si es coordinador, se excluyen las que ya tiene a cargo otro coordinador
  // - si es docente, se muestran todas (varios docentes sí pueden compartir carrera)
  carrerasParaChecklist(docente: Docente): string[] {
    if (this.rolMostrado(docente) !== 'coordinador') {
      return this.carrerasDisponibles();
    }
    const ocupadas = this.carrerasOcupadasPorOtrosCoordinadores(docente.cedula);
    return this.carrerasDisponibles().filter(c => !ocupadas.has(c));
  }

  cambiarRolLocal(docente: Docente, nuevoRol: Rol): void {
    if (!this.puedeEditar) return;

    const pendientes = new Map(this.cambiosPendientes());
    const cambioExistente = pendientes.get(docente.cedula);
    const carrerasBase = cambioExistente?.carreras ?? docente.carreras ?? [];

    pendientes.set(docente.cedula, {
      rol: nuevoRol,
      carreras: carrerasBase
    });

    this.cambiosPendientes.set(pendientes);
  }

  toggleCarreraACargo(docente: Docente, carrera: string, event: Event): void {
    if (!this.puedeEditar) return;
    event.stopPropagation();

    const pendientes = new Map(this.cambiosPendientes());
    const cambioExistente = pendientes.get(docente.cedula);
    const rolActual = cambioExistente?.rol ?? docente.rol;
    const listaActual = cambioExistente?.carreras ?? docente.carreras ?? [];

    const nuevaLista = listaActual.includes(carrera)
      ? listaActual.filter(c => c !== carrera)
      : [...listaActual, carrera];

    pendientes.set(docente.cedula, { rol: rolActual, carreras: nuevaLista });
    this.cambiosPendientes.set(pendientes);
  }

  abrirCerrarMenuCarreras(cedula: string, event: Event): void {
    if (!this.puedeEditar) return;
    event.stopPropagation();
    this.menuCarrerasAbierto.set(this.menuCarrerasAbierto() === cedula ? null : cedula);
  }

  cerrarMenuCarreras(): void {
    this.menuCarrerasAbierto.set(null);
  }

  async guardarCambios(): Promise<void> {
    if (!this.puedeEditar) return;

    const pendientes = this.cambiosPendientes();
    if (pendientes.size === 0) return;

    this.guardandoCambios.set(true);
    this.mensaje.set(null);

    try {
      const updates: Record<string, any> = {};
      for (const [cedula, cambio] of pendientes.entries()) {
        updates[`docentes-registrados/${cedula}/rol`] = cambio.rol;
        updates[`docentes-registrados/${cedula}/carreras`] = cambio.carreras;
      }

      await update(ref(dbDocente), updates);

      this.mensaje.set({
        tipo: 'ok',
        texto: `Se guardaron ${pendientes.size} cambio(s) correctamente.`
      });
      this.cambiosPendientes.set(new Map());
      this.menuCarrerasAbierto.set(null);
    } catch (error) {
      console.error(error);
      this.mensaje.set({ tipo: 'error', texto: 'Ocurrió un error al guardar los cambios.' });
    } finally {
      this.guardandoCambios.set(false);
    }
  }

  descartarCambios(): void {
    this.cambiosPendientes.set(new Map());
    this.menuCarrerasAbierto.set(null);
  }

  // ── Agregar nuevo docente manualmente ──
  mostrarModalAgregar = signal(false);
  guardandoNuevoDocente = signal(false);

  nuevoDocente = signal<NuevoDocenteForm>({
    cedula: '',
    nombresCompletos: '',
    rol: 'docente',
    carreras: [],
    carreraNueva: ''
  });

  abrirModalAgregar(): void {
    if (!this.puedeEditar) return;
    this.nuevoDocente.set({ cedula: '', nombresCompletos: '', rol: 'docente', carreras: [], carreraNueva: '' });
    this.mensaje.set(null);
    this.mostrarModalAgregar.set(true);
  }

  cerrarModalAgregar(): void {
    this.mostrarModalAgregar.set(false);
  }

  actualizarCampoNuevoDocente(campo: 'cedula' | 'nombresCompletos' | 'carreraNueva', valor: string): void {
    this.nuevoDocente.update(f => ({ ...f, [campo]: valor }));
  }

  cambiarRolNuevoDocente(rol: Rol): void {
    this.nuevoDocente.update(f => ({ ...f, rol }));
  }

  toggleCarreraExistenteNuevoDocente(carrera: string): void {
    this.nuevoDocente.update(f => ({
      ...f,
      carreras: f.carreras.includes(carrera)
        ? f.carreras.filter(c => c !== carrera)
        : [...f.carreras, carrera]
    }));
  }

  agregarCarreraNuevaAlFormulario(): void {
    const nueva = this.nuevoDocente().carreraNueva.trim();
    if (!nueva) return;
    this.nuevoDocente.update(f => ({
      ...f,
      carreras: f.carreras.includes(nueva) ? f.carreras : [...f.carreras, nueva],
      carreraNueva: ''
    }));
  }

  quitarCarreraDelFormulario(carrera: string): void {
    this.nuevoDocente.update(f => ({ ...f, carreras: f.carreras.filter(c => c !== carrera) }));
  }

  // Si el nuevo docente se registra como coordinador, también respetamos la
  // exclusividad: no ofrecemos carreras que ya tenga a cargo otro coordinador
  carrerasDisponiblesParaNuevoDocente = computed(() => {
    const form = this.nuevoDocente();
    if (form.rol !== 'coordinador') return this.carrerasDisponibles();
    const ocupadas = new Set<string>();
    for (const otro of this.docentesRegistrados()) {
      if (this.rolMostrado(otro) !== 'coordinador') continue;
      for (const c of this.carrerasMostradas(otro)) ocupadas.add(c);
    }
    return this.carrerasDisponibles().filter(c => !ocupadas.has(c));
  });

  async guardarNuevoDocente(): Promise<void> {
    if (!this.puedeEditar) return;

    const form = this.nuevoDocente();
    const cedula = form.cedula.trim();
    const nombres = form.nombresCompletos.trim();

    if (!cedula || !nombres) {
      this.mensaje.set({ tipo: 'error', texto: 'Cédula y nombres completos son obligatorios.' });
      return;
    }
    if (form.carreras.length === 0) {
      this.mensaje.set({ tipo: 'error', texto: 'Seleccioná o escribí al menos una carrera.' });
      return;
    }
    if (this.docentesRegistrados().some(d => d.cedula === cedula)) {
      this.mensaje.set({ tipo: 'error', texto: 'Ya existe un docente registrado con esa cédula.' });
      return;
    }

    this.guardandoNuevoDocente.set(true);
    this.mensaje.set(null);

    try {
      const nuevo: Docente = {
        cedula,
        nombresCompletos: nombres,
        rol: form.rol,
        carreras: form.carreras
      };
      await update(ref(dbDocente), { [`docentes-registrados/${cedula}`]: nuevo });

      this.mensaje.set({ tipo: 'ok', texto: 'Docente agregado correctamente.' });
      this.mostrarModalAgregar.set(false);
    } catch (error) {
      console.error(error);
      this.mensaje.set({ tipo: 'error', texto: 'Ocurrió un error al agregar el docente.' });
    } finally {
      this.guardandoNuevoDocente.set(false);
    }
  }

  ngOnInit(): void {
    onValue(this.refDocentes, this.listenerCallback);
  }

  ngOnDestroy(): void {
    off(this.refDocentes, 'value', this.listenerCallback);
  }
}
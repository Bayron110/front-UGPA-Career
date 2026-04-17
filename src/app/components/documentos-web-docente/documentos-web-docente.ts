import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  push,
  remove,
  onValue
} from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyANtWmjXdlHkf-LO4t2gtpyymmjeEr2emI",
  authDomain: "repaso-fire-d8ceb.firebaseapp.com",
  databaseURL: "https://repaso-fire-d8ceb-default-rtdb.firebaseio.com",
  projectId: "repaso-fire-d8ceb",
  storageBucket: "repaso-fire-d8ceb.firebasestorage.app",
  messagingSenderId: "1080713449199",
  appId: "1:1080713449199:web:a94fd6c6e26766b4e2551a"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app, firebaseConfig.databaseURL);

@Component({
  selector: 'app-documentos-web-docente',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './documentos-web-docente.html',
  styleUrl: './documentos-web-docente.css'
})
export class DocumentosWebDocente implements OnInit {

  tabActiva: 'config' | 'carreras' | 'capacitaciones' | 'historial' = 'config';

  // ── CONFIG GENERAL ───────────────────────────────────────────
  guardandoConfig = false;
  guardandoFormularios = false;
  guardandoCodigoPlan = false;
  guardandoCodigoSeguimiento = false;

  configMsg = '';
  formulariosMsg = '';
  codigoPlanMsg = '';
  codigoSeguimientoMsg = '';

  fecha1Texto = 'desde el 1 dia del mes de marzo de 2026';
  anio = '2026';
  mes = '03';

  previewCodigo = 'UGPA-RGI2-01-PRO-134-2026-03';

  chkPatrocinio = true;
  chkPlanIndividual = true;
  chkSeguimientoDocente = true;

  // ── CONFIG CÓDIGO PLAN INDIVIDUAL ───────────────────────────
  planPrefijo = 'UGPA';
  planBloque = 'RGI2';
  planSecuenciaPreview = '01';
  planProceso = 'PRO';
  planConsecutivoFijo = '251';
  previewCodigoPlan = 'UGPA-RGI2-01-PRO-251-2026-03';

  // ── CONFIG CÓDIGO SEGUIMIENTO ────────────────────────────────
  seguimientoCodigo = 'UGPA-RGI1-01-PRO-248-2025-09';

  // ── CARRERAS ────────────────────────────────────────────────
  carreras: { id: string; nombre: string }[] = [];
  nuevaCarrera = '';
  guardandoCarrera = false;
  carreraMsg = '';
  importandoExcel = false;

  // ── CAPACITACIONES ──────────────────────────────────────────
  capacitaciones: { id: string; nombre: string; actividadesTeoricasArr?: string[]; actividadesPracticasArr?: string[] }[] = [];
  nuevaCapacitacion = '';
  guardandoCapacitacion = false;
  capacitacionMsg = '';
  editandoCapacitacionId: string | null = null;
  editandoCapacitacionNombre = '';

  // Campos para las 3 actividades teóricas y 3 prácticas al agregar
  nuevasActividadesTeoricasArr: string[] = ['', '', ''];
  nuevasActividadesPracticasArr: string[] = ['', '', ''];

  // Edición de actividades
  editandoActividadesTeoricasArr: string[] = ['', '', ''];
  editandoActividadesPracticasArr: string[] = ['', '', ''];

  // ── HISTORIAL ───────────────────────────────────────────────
  historial: any[] = [];
  historialFiltrado: any[] = [];
  filtroTipo: 'todos' | 'patrocinio' | 'planIndividual' | 'seguimiento' = 'todos';
  filtroDocente = '';
  cargandoHistorial = false;

  async ngOnInit(): Promise<void> {
    await this.cargarConfiguracion();
    this.cargarCarreras();
    this.cargarCapacitaciones();
    this.cargarHistorial();
  }

  cambiarTab(tab: typeof this.tabActiva): void {
    this.tabActiva = tab;
  }

  // ── CONFIG ──────────────────────────────────────────────────
  actualizarPreview(): void {
    const a = (this.anio || '2026').toString().trim();
    const m = (this.mes || '03').toString().trim().padStart(2, '0');
    this.previewCodigo = `UGPA-RGI2-01-PRO-134-${a}-${m}`;
    this.actualizarPreviewPlan();
  }

  actualizarPreviewPlan(): void {
    const a = (this.anio || '2026').toString().trim();
    const m = (this.mes || '03').toString().trim().padStart(2, '0');
    const prefijo = (this.planPrefijo || 'UGPA').trim();
    const bloque = (this.planBloque || 'RGI2').trim();
    const sec = (this.planSecuenciaPreview || '01').trim().padStart(2, '0');
    const proceso = (this.planProceso || 'PRO').trim();
    const consecutivo = (this.planConsecutivoFijo || '251').trim();

    this.previewCodigoPlan = `${prefijo}-${bloque}-${sec}-${proceso}-${consecutivo}-${a}-${m}`;
  }

  async cargarConfiguracion(): Promise<void> {
    try {
      const [snapConfig, snapForms, snapPlan, snapSeg] = await Promise.all([
        get(ref(db, 'config/general')),
        get(ref(db, 'config/formularios')),
        get(ref(db, 'config/codigos/planIndividual')),
        get(ref(db, 'config/codigos/seguimiento'))
      ]);

      if (!snapConfig.exists()) {
        await this.crearConfiguracionInicial();
      } else {
        const config = snapConfig.val();
        this.fecha1Texto = config.fecha1Texto || this.fecha1Texto;
        this.anio = String(config.anio || '2026');
        this.mes = String(config.mes || '03').padStart(2, '0');
      }

      if (snapForms.exists()) {
        const forms = snapForms.val();
        this.chkPatrocinio = !!forms.patrocinio;
        this.chkPlanIndividual = !!forms.planIndividual;
        this.chkSeguimientoDocente = !!forms.seguimientoDocente;
      }

      if (!snapPlan.exists()) {
        await this.crearConfigCodigoPlanInicial();
      } else {
        const plan = snapPlan.val();
        this.planPrefijo = plan.prefijo || 'UGPA';
        this.planBloque = plan.bloque || 'RGI2';
        this.planSecuenciaPreview = String(plan.secuenciaPreview || '01').padStart(2, '0');
        this.planProceso = plan.proceso || 'PRO';
        this.planConsecutivoFijo = String(plan.consecutivoFijo || '251');
      }

      if (snapSeg.exists()) {
        const seg = snapSeg.val();
        this.seguimientoCodigo = seg.codigo || 'UGPA-RGI1-01-PRO-248-2025-09';
      } else {
        await this.crearConfigCodigoSeguimientoInicial();
      }

      this.actualizarPreview();
      this.actualizarPreviewPlan();
    } catch (error) {
      console.error('Error al cargar config:', error);
    }
  }

  async crearConfiguracionInicial(): Promise<void> {
    try {
      await set(ref(db, 'config/general'), {
        fecha1Texto: this.fecha1Texto,
        anio: this.anio,
        mes: this.mes
      });

      await set(ref(db, 'config/formularios'), {
        patrocinio: true,
        planIndividual: true,
        seguimientoDocente: true
      });
    } catch (error) {
      console.error('Error config inicial:', error);
    }
  }

  async crearConfigCodigoPlanInicial(): Promise<void> {
    try {
      await set(ref(db, 'config/codigos/planIndividual'), {
        prefijo: 'UGPA',
        bloque: 'RGI2',
        secuenciaPreview: '01',
        proceso: 'PRO',
        consecutivoFijo: '251'
      });
    } catch (error) {
      console.error('Error config plan inicial:', error);
    }
  }

  async crearConfigCodigoSeguimientoInicial(): Promise<void> {
    try {
      await set(ref(db, 'config/codigos/seguimiento'), {
        codigo: 'UGPA-RGI1-01-PRO-248-2025-09'
      });
    } catch (error) {
      console.error('Error config seguimiento inicial:', error);
    }
  }

  async guardarConfiguracion(): Promise<void> {
    this.guardandoConfig = true;
    try {
      await update(ref(db, 'config/general'), {
        fecha1Texto: this.fecha1Texto.trim(),
        anio: this.anio.toString().trim(),
        mes: this.mes.toString().trim().padStart(2, '0')
      });

      this.actualizarPreview();
      this.actualizarPreviewPlan();
      this.configMsg = '✅ Guardado';
    } catch (error) {
      console.error(error);
      this.configMsg = '❌ Error';
    } finally {
      this.guardandoConfig = false;
      setTimeout(() => this.configMsg = '', 3000);
    }
  }

  async guardarCodigoPlanIndividual(): Promise<void> {
    this.guardandoCodigoPlan = true;

    try {
      await set(ref(db, 'config/codigos/planIndividual'), {
        prefijo: this.planPrefijo.trim() || 'UGPA',
        bloque: this.planBloque.trim() || 'RGI2',
        secuenciaPreview: this.planSecuenciaPreview.toString().trim().padStart(2, '0'),
        proceso: this.planProceso.trim() || 'PRO',
        consecutivoFijo: this.planConsecutivoFijo.toString().trim() || '251'
      });

      this.actualizarPreviewPlan();
      this.codigoPlanMsg = '✅ Guardado';
    } catch (error) {
      console.error(error);
      this.codigoPlanMsg = '❌ Error';
    } finally {
      this.guardandoCodigoPlan = false;
      setTimeout(() => this.codigoPlanMsg = '', 3000);
    }
  }

  async guardarCodigoSeguimiento(): Promise<void> {
    this.guardandoCodigoSeguimiento = true;
    try {
      await set(ref(db, 'config/codigos/seguimiento'), {
        codigo: this.seguimientoCodigo.trim()
      });
      this.codigoSeguimientoMsg = '✅ Guardado';
    } catch (error) {
      console.error(error);
      this.codigoSeguimientoMsg = '❌ Error';
    } finally {
      this.guardandoCodigoSeguimiento = false;
      setTimeout(() => this.codigoSeguimientoMsg = '', 3000);
    }
  }

  async guardarFormularios(): Promise<void> {
    this.guardandoFormularios = true;
    try {
      await set(ref(db, 'config/formularios'), {
        patrocinio: this.chkPatrocinio,
        planIndividual: this.chkPlanIndividual,
        seguimientoDocente: this.chkSeguimientoDocente
      });
      this.formulariosMsg = '✅ Guardado';
    } catch (error) {
      console.error(error);
      this.formulariosMsg = '❌ Error';
    } finally {
      this.guardandoFormularios = false;
      setTimeout(() => this.formulariosMsg = '', 3000);
    }
  }

  // ── CARRERAS ────────────────────────────────────────────────
  cargarCarreras(): void {
    onValue(ref(db, 'carreras'), (snap) => {
      if (!snap.exists()) {
        this.carreras = [];
        return;
      }

      const val = snap.val();
      this.carreras = Object.entries(val).map(([id, v]: any) => ({
        id,
        nombre: v.nombre
      }));
    });
  }

  async agregarCarrera(): Promise<void> {
    const nombre = this.nuevaCarrera.trim();
    if (!nombre) return;

    this.guardandoCarrera = true;
    try {
      await push(ref(db, 'carreras'), { nombre });
      this.nuevaCarrera = '';
      this.carreraMsg = '✅ Carrera agregada';
    } catch (error) {
      console.error(error);
      this.carreraMsg = '❌ Error';
    } finally {
      this.guardandoCarrera = false;
      setTimeout(() => this.carreraMsg = '', 3000);
    }
  }

  async eliminarCarrera(id: string): Promise<void> {
    if (!confirm('¿Eliminar esta carrera?')) return;
    await remove(ref(db, `carreras/${id}`));
  }

  importarDesdeExcel(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    this.importandoExcel = true;
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lineas = text
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(l => l.length > 0);

        for (const nombre of lineas) {
          await push(ref(db, 'carreras'), { nombre });
        }

        this.carreraMsg = `✅ ${lineas.length} carreras importadas`;
      } catch (error) {
        console.error(error);
        this.carreraMsg = '❌ Error al importar';
      } finally {
        this.importandoExcel = false;
        setTimeout(() => this.carreraMsg = '', 4000);
        input.value = '';
      }
    };

    reader.readAsText(file);
  }

  // ── CAPACITACIONES ──────────────────────────────────────────
  cargarCapacitaciones(): void {
    onValue(ref(db, 'capacitaciones'), (snap) => {
      if (!snap.exists()) {
        this.capacitaciones = [];
        return;
      }

      const val = snap.val();
      this.capacitaciones = Object.entries(val).map(([id, v]: any) => {
        // Convertir objetos de Firebase a arrays si existen
        const teoricasRaw = v.actividadesTeoricasArr;
        const practicasRaw = v.actividadesPracticasArr;

        const actividadesTeoricasArr = teoricasRaw
          ? (Array.isArray(teoricasRaw) ? teoricasRaw : Object.values(teoricasRaw))
          : [];
        const actividadesPracticasArr = practicasRaw
          ? (Array.isArray(practicasRaw) ? practicasRaw : Object.values(practicasRaw))
          : [];

        return {
          id,
          nombre: v.nombre,
          actividadesTeoricasArr,
          actividadesPracticasArr
        };
      });
    });
  }

  async agregarCapacitacion(): Promise<void> {
    const nombre = this.nuevaCapacitacion.trim();
    if (!nombre) return;

    // Validar que las 3 actividades de cada tipo estén completas
    const teoricasValidas = this.nuevasActividadesTeoricasArr.every(a => a.trim() !== '');
    const practicasValidas = this.nuevasActividadesPracticasArr.every(a => a.trim() !== '');

    if (!teoricasValidas || !practicasValidas) {
      this.capacitacionMsg = '⚠️ Completa las 6 actividades (3 teóricas y 3 prácticas)';
      setTimeout(() => this.capacitacionMsg = '', 3000);
      return;
    }

    this.guardandoCapacitacion = true;
    try {
      await push(ref(db, 'capacitaciones'), {
        nombre,
        actividadesTeoricasArr: this.nuevasActividadesTeoricasArr.map(a => a.trim()),
        actividadesPracticasArr: this.nuevasActividadesPracticasArr.map(a => a.trim())
      });

      this.nuevaCapacitacion = '';
      this.nuevasActividadesTeoricasArr = ['', '', ''];
      this.nuevasActividadesPracticasArr = ['', '', ''];
      this.capacitacionMsg = '✅ Capacitación agregada';
    } catch (error) {
      console.error(error);
      this.capacitacionMsg = '❌ Error';
    } finally {
      this.guardandoCapacitacion = false;
      setTimeout(() => this.capacitacionMsg = '', 3000);
    }
  }

  iniciarEdicion(cap: { id: string; nombre: string; actividadesTeoricasArr?: string[]; actividadesPracticasArr?: string[] }): void {
    this.editandoCapacitacionId = cap.id;
    this.editandoCapacitacionNombre = cap.nombre;
    this.editandoActividadesTeoricasArr = cap.actividadesTeoricasArr?.length
      ? [...cap.actividadesTeoricasArr]
      : ['', '', ''];
    this.editandoActividadesPracticasArr = cap.actividadesPracticasArr?.length
      ? [...cap.actividadesPracticasArr]
      : ['', '', ''];

    // Asegurar que siempre tenga exactamente 3 elementos
    while (this.editandoActividadesTeoricasArr.length < 3) this.editandoActividadesTeoricasArr.push('');
    while (this.editandoActividadesPracticasArr.length < 3) this.editandoActividadesPracticasArr.push('');
  }

  cancelarEdicion(): void {
    this.editandoCapacitacionId = null;
    this.editandoCapacitacionNombre = '';
    this.editandoActividadesTeoricasArr = ['', '', ''];
    this.editandoActividadesPracticasArr = ['', '', ''];
  }

  async guardarEdicionCapacitacion(): Promise<void> {
    if (!this.editandoCapacitacionId) return;

    const nombre = this.editandoCapacitacionNombre.trim();
    if (!nombre) return;

    const teoricasValidas = this.editandoActividadesTeoricasArr.every(a => a.trim() !== '');
    const practicasValidas = this.editandoActividadesPracticasArr.every(a => a.trim() !== '');

    if (!teoricasValidas || !practicasValidas) {
      this.capacitacionMsg = '⚠️ Completa las 6 actividades';
      setTimeout(() => this.capacitacionMsg = '', 3000);
      return;
    }

    try {
      await update(ref(db, `capacitaciones/${this.editandoCapacitacionId}`), {
        nombre,
        actividadesTeoricasArr: this.editandoActividadesTeoricasArr.map(a => a.trim()),
        actividadesPracticasArr: this.editandoActividadesPracticasArr.map(a => a.trim())
      });
      this.cancelarEdicion();
      this.capacitacionMsg = '✅ Capacitación actualizada';
      setTimeout(() => this.capacitacionMsg = '', 3000);
    } catch (error) {
      console.error('Error al editar', error);
    }
  }

  async eliminarCapacitacion(id: string): Promise<void> {
    if (!confirm('¿Eliminar esta capacitación?')) return;
    await remove(ref(db, `capacitaciones/${id}`));
  }

  // ── HISTORIAL ───────────────────────────────────────────────
  cargarHistorial(): void {
    this.cargandoHistorial = true;

    const refrescar = async () => {
      try {
        const [snapPat, snapPlan, snapSeg] = await Promise.all([
          get(ref(db, 'registrosPatrocinio')),
          get(ref(db, 'registrosPlanIndividual')),
          get(ref(db, 'registrosSeguimientoDocente'))
        ]);

        const registros: any[] = [];

        if (snapPat.exists()) {
          snapPat.forEach((child) => {
            registros.push({ id: child.key, ...child.val() });
          });
        }

        if (snapPlan.exists()) {
          snapPlan.forEach((child) => {
            registros.push({ id: child.key, ...child.val() });
          });
        }

        if (snapSeg.exists()) {
          snapSeg.forEach((child) => {
            registros.push({ id: child.key, ...child.val() });
          });
        }

        this.historial = registros.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        this.aplicarFiltros();
      } catch (error) {
        console.error('Error cargando historial:', error);
      } finally {
        this.cargandoHistorial = false;
      }
    };

    onValue(ref(db, 'registrosPatrocinio'), () => refrescar());
    onValue(ref(db, 'registrosPlanIndividual'), () => refrescar());
    onValue(ref(db, 'registrosSeguimientoDocente'), () => refrescar());

    refrescar();
  }

  aplicarFiltros(): void {
    let resultado = [...this.historial];

    if (this.filtroTipo !== 'todos') {
      resultado = resultado.filter(r => r.tipo === this.filtroTipo);
    }

    if (this.filtroDocente.trim()) {
      const busqueda = this.filtroDocente.toLowerCase().trim();
      resultado = resultado.filter(r =>
        (r.docente || '').toLowerCase().includes(busqueda)
      );
    }

    this.historialFiltrado = resultado;
  }

  cambiarFiltroTipo(tipo: typeof this.filtroTipo): void {
    this.filtroTipo = tipo;
    this.aplicarFiltros();
  }
}
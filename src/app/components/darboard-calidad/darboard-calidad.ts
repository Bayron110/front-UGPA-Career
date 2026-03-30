import {
  Component,
  ElementRef,
  ViewChild,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

Chart.register(
  BarController, BarElement, CategoryScale, LinearScale,
  DoughnutController, ArcElement, Tooltip, Legend
);

interface ExcelRow { [key: string]: any; }

interface RespuestaDetalle {
  valor: string;
  cantidad: number;
  porcentaje: number;
}

interface ResumenPregunta {
  pregunta: string;
  total: number;
  respuestas: RespuestaDetalle[];
}

interface ResumenPrincipal {
  nombre: string;
  total: number;
}

@Component({
  selector: 'app-darboard-calidad',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './darboard-calidad.html',
  styleUrls: ['./darboard-calidad.css']
})
export class DarboardCalidad {
  @ViewChild('graficoPreguntas') graficoPreguntasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('graficoPrincipal') graficoPrincipalRef!: ElementRef<HTMLCanvasElement>;

  // ── Datos del Excel ──────────────────────────────
  filasExcel: ExcelRow[] = [];
  columnasExcel: string[] = [];           // todas las columnas del archivo
  columnaPrincipal = '';                  // columna activa del doughnut
  columnasPreguntas: string[] = [];       // columnas activas en gráfico de barras/tabla

  // ── Resúmenes calculados ──────────────────────────
  resumenPreguntas: ResumenPregunta[] = [];
  resumenPrincipal: ResumenPrincipal[] = [];

  // ── Estado general ────────────────────────────────
  totalRegistros = 0;
  cargando = false;
  mensaje = '';
  nombreArchivo = '';
  preguntaSeleccionada = '';
  accordionOpen: boolean[] = [];

  // ── Modal de configuración ────────────────────────
  mostrarModal = false;
  columnaPrincipalTemp = '';              // valor temporal mientras el modal está abierto
  columnasSeleccionadasTemp: string[] = [];

  // ── Charts ────────────────────────────────────────
  chartPreguntas: Chart | null = null;
  chartPrincipal: Chart | null = null;

  private readonly PALETTE = [
    '#6366f1', '#8b5cf6', '#06b6d4', '#10b981',
    '#f59e0b', '#ef4444', '#ec4899', '#14b8a6',
    '#f97316', '#84cc16'
  ];

  String = String;

  constructor(private cdr: ChangeDetectorRef) {}

  // ════════════════════════════════════════════════════
  //  MODAL
  // ════════════════════════════════════════════════════

  abrirConfiguracion(): void {
    this.columnaPrincipalTemp = this.columnaPrincipal;
    this.columnasSeleccionadasTemp = [...this.columnasPreguntas];
    this.mostrarModal = true;
  }

  cancelarModal(): void {
    this.mostrarModal = false;
  }

  toggleColumna(col: string): void {
    const idx = this.columnasSeleccionadasTemp.indexOf(col);
    if (idx > -1) {
      this.columnasSeleccionadasTemp.splice(idx, 1);
    } else {
      // Mantener el orden original del Excel
      const ordenOriginal = this.columnasExcel.filter(
        c => c !== this.columnaPrincipalTemp
      );
      this.columnasSeleccionadasTemp = ordenOriginal.filter(
        c => this.columnasSeleccionadasTemp.includes(c) || c === col
      );
    }
  }

  aplicarConfiguracion(): void {
    this.mostrarModal = false;
    this.columnaPrincipal = this.columnaPrincipalTemp;

    // Las columnas a analizar son las seleccionadas, excluyendo la principal
    this.columnasPreguntas = this.columnasSeleccionadasTemp.filter(
      c => c !== this.columnaPrincipal
    );

    this.destruirGraficos();
    this.generarResumenPrincipal();
    this.generarResumenPreguntas();

    this.accordionOpen = this.resumenPreguntas.map((_, i) => i === 0);
    this.preguntaSeleccionada = this.resumenPreguntas.length
      ? this.resumenPreguntas[0].pregunta : '';

    this.cdr.detectChanges();
    setTimeout(() => {
      this.crearGraficoPreguntas();
      this.crearGraficoPrincipal();
    }, 0);
  }

  // ════════════════════════════════════════════════════
  //  CARGA DE ARCHIVO
  // ════════════════════════════════════════════════════

  async onExcelSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    this.cargando = true;
    this.mensaje = '';
    this.nombreArchivo = archivo.name;
    this.resetearDatos(false);
    this.destruirGraficos();

    try {
      const filas = await this.leerExcel(archivo);

      if (!filas.length) {
        this.resetearDatos();
        this.mensaje = 'El archivo no contiene datos.';
        this.cargando = false;
        return;
      }

      this.filasExcel = filas;
      this.columnasExcel = Object.keys(filas[0] || {});
      this.totalRegistros = filas.length;

      if (!this.columnasExcel.length) {
        this.resetearDatos();
        this.mensaje = 'No se detectaron columnas válidas en el Excel.';
        this.cargando = false;
        return;
      }

      // Abrir el modal para que el usuario elija la columna principal
      // Pre-seleccionar la primera columna por defecto
      this.columnaPrincipalTemp = this.columnasExcel[0];
      this.columnasSeleccionadasTemp = this.columnasExcel.slice(1);

      this.cargando = false;
      this.cdr.detectChanges();

      // Mostrar modal de configuración en lugar de renderizar directamente
      this.mostrarModal = true;

      input.value = '';
    } catch (error) {
      console.error('Error al leer el Excel:', error);
      this.resetearDatos();
      this.mensaje = 'Ocurrió un error al procesar el archivo Excel.';
      this.cargando = false;
    }
  }

  leerExcel(file: File): Promise<ExcelRow[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) { reject(new Error('No se pudo leer el archivo.')); return; }
          const wb = XLSX.read(data, { type: 'array' });
          const hoja = wb.Sheets[wb.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(hoja, { defval: '' }));
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsArrayBuffer(file);
    });
  }

  // ════════════════════════════════════════════════════
  //  GENERACIÓN DE RESÚMENES
  // ════════════════════════════════════════════════════

  generarResumenPrincipal(): void {
    const contador = new Map<string, number>();
    for (const fila of this.filasExcel) {
      const valor = String(fila[this.columnaPrincipal] ?? '').trim() || 'Sin dato';
      contador.set(valor, (contador.get(valor) || 0) + 1);
    }
    this.resumenPrincipal = Array.from(contador.entries())
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total);
  }

  generarResumenPreguntas(): void {
    this.resumenPreguntas = this.columnasPreguntas.map((columna) => {
      const contador = new Map<string, number>();
      for (const fila of this.filasExcel) {
        const valorOriginal = String(fila[columna] ?? '').trim();
        if (!valorOriginal) continue;
        const vn = valorOriginal.toLowerCase();
        contador.set(vn, (contador.get(vn) || 0) + 1);
      }
      const total = Array.from(contador.values()).reduce((a, n) => a + n, 0);
      const respuestas: RespuestaDetalle[] = Array.from(contador.entries())
        .map(([valor, cantidad]) => ({
          valor: this.formatearRespuesta(valor),
          cantidad,
          porcentaje: total ? Math.round((cantidad / total) * 10000) / 100 : 0
        }))
        .sort((a, b) => b.cantidad - a.cantidad);
      return { pregunta: columna, total, respuestas };
    });
  }

  formatearRespuesta(valor: string): string {
    return valor.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }

  // ════════════════════════════════════════════════════
  //  GRÁFICOS
  // ════════════════════════════════════════════════════

  crearGraficoPreguntas(): void {
    if (!this.graficoPreguntasRef?.nativeElement) return;
    const canvas = this.graficoPreguntasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.chartPreguntas) { this.chartPreguntas.destroy(); this.chartPreguntas = null; }

    const preguntaActual = this.resumenPreguntas.find(p => p.pregunta === this.preguntaSeleccionada);
    if (!preguntaActual) return;

    const gradients = preguntaActual.respuestas.map((_, i) => {
      const grad = ctx.createLinearGradient(0, 0, 0, 360);
      const base = this.PALETTE[i % this.PALETTE.length];
      grad.addColorStop(0, base);
      grad.addColorStop(1, base + '55');
      return grad;
    });

    this.chartPreguntas = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: preguntaActual.respuestas.map(r => r.valor),
        datasets: [{
          label: preguntaActual.pregunta,
          data: preguntaActual.respuestas.map(r => r.cantidad),
          backgroundColor: gradients,
          borderWidth: 0,
          borderRadius: 8,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,15,35,0.92)',
            padding: 12,
            cornerRadius: 10,
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            callbacks: {
              label: (context) => {
                const item = preguntaActual.respuestas[context.dataIndex];
                return [` Cantidad: ${item.cantidad}`, ` Porcentaje: ${item.porcentaje.toFixed(2)}%`];
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { autoSkip: false, maxRotation: 35, minRotation: 0, font: { size: 12, family: "'DM Sans', sans-serif" }, color: '#6b7280' },
            grid: { display: false },
            border: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 11, family: "'DM Sans', sans-serif" }, color: '#9ca3af' },
            grid: { color: 'rgba(0,0,0,0.05)' },
            border: { display: false }
          }
        }
      }
    });
  }

  crearGraficoPrincipal(): void {
    if (!this.graficoPrincipalRef?.nativeElement) return;
    const canvas = this.graficoPrincipalRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.chartPrincipal) { this.chartPrincipal.destroy(); this.chartPrincipal = null; }

    this.chartPrincipal = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: this.resumenPrincipal.map(i => i.nombre),
        datasets: [{
          label: this.columnaPrincipal,
          data: this.resumenPrincipal.map(i => i.total),
          backgroundColor: this.resumenPrincipal.map((_, i) => this.PALETTE[i % this.PALETTE.length]),
          borderWidth: 3,
          borderColor: '#ffffff',
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 700, easing: 'easeOutQuart' },
        cutout: '65%',
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { padding: 16, boxWidth: 12, boxHeight: 12, font: { size: 12, family: "'DM Sans', sans-serif" }, color: '#374151' }
          },
          tooltip: {
            backgroundColor: 'rgba(15,15,35,0.92)',
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: (context) => {
                const value = context.parsed;
                const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const pct = total ? ((value / total) * 100).toFixed(2) : '0.00';
                return ` ${value} registros (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  // ════════════════════════════════════════════════════
  //  HELPERS
  // ════════════════════════════════════════════════════

  toggleAccordion(index: number): void {
    this.accordionOpen[index] = !this.accordionOpen[index];
  }

  onPreguntaChange(): void {
    setTimeout(() => { this.crearGraficoPreguntas(); }, 0);
  }

  getPreguntaMasRespondida(): ResumenPregunta | null {
    return this.resumenPreguntas.length
      ? [...this.resumenPreguntas].sort((a, b) => b.total - a.total)[0] : null;
  }

  getRespuestaMasFrecuenteGlobal(): { pregunta: string; valor: string; cantidad: number } | null {
    let mejor: { pregunta: string; valor: string; cantidad: number } | null = null;
    for (const p of this.resumenPreguntas)
      for (const r of p.respuestas)
        if (!mejor || r.cantidad > mejor.cantidad)
          mejor = { pregunta: p.pregunta, valor: r.valor, cantidad: r.cantidad };
    return mejor;
  }

  getTotalRespuestasAnalizadas(): number {
    return this.resumenPreguntas.reduce((acc, item) => acc + item.total, 0);
  }

  private destruirGraficos(): void {
    if (this.chartPreguntas) { this.chartPreguntas.destroy(); this.chartPreguntas = null; }
    if (this.chartPrincipal) { this.chartPrincipal.destroy(); this.chartPrincipal = null; }
  }

  resetearDatos(destruirGraficas = true): void {
    this.filasExcel = [];
    this.columnasExcel = [];
    this.columnaPrincipal = '';
    this.columnasPreguntas = [];
    this.resumenPreguntas = [];
    this.resumenPrincipal = [];
    this.totalRegistros = 0;
    this.preguntaSeleccionada = '';
    this.accordionOpen = [];
    this.mostrarModal = false;
    if (destruirGraficas) this.destruirGraficos();
  }
}
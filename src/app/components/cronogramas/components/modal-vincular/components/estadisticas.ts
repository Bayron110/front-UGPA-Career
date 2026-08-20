import { ElementRef } from '@angular/core';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export type EstadoNotif = 'activa' | 'pendiente' | 'sin-telegram';

export interface StatsGenerales {
    total: number;
    activas: number;
    pendientes: number;
    sinTelegram: number;
    sinActivar: number;
    presentes: number;
    ausentes: number;
    pctActivas: number;
    pctSinActivar: number;
    pctAsistencia: number;
}

export interface StatsPorGrupo {
    etiqueta: string;
    total: number;
    activas: number;
    pendientes: number;
    sinTelegram: number;
    sinActivar: number;
    presentes: number;
    ausentes: number;
}

export interface CanvasRefs {
    notifDonut?: ElementRef<HTMLCanvasElement>;
    sedeStack?: ElementRef<HTMLCanvasElement>;
    sedeSinActivar?: ElementRef<HTMLCanvasElement>;
    carreraStack?: ElementRef<HTMLCanvasElement>;
    carreraSinActivar?: ElementRef<HTMLCanvasElement>;
}

/** KPIs generales a partir de la lista de estudiantes vinculados */
export function calcularStatsGenerales(
    lista: any[],
    estadoFn: (p: any) => EstadoNotif
): StatsGenerales {
    const total = lista.length;
    const activas = lista.filter(p => estadoFn(p) === 'activa').length;
    const pendientes = lista.filter(p => estadoFn(p) === 'pendiente').length;
    const sinTelegram = lista.filter(p => estadoFn(p) === 'sin-telegram').length;
    const sinActivar = pendientes + sinTelegram;
    const presentes = lista.filter(p => p.asistencia).length;

    return {
        total, activas, pendientes, sinTelegram, sinActivar, presentes,
        ausentes: total - presentes,
        pctActivas: total ? Math.round((activas / total) * 100) : 0,
        pctSinActivar: total ? Math.round((sinActivar / total) * 100) : 0,
        pctAsistencia: total ? Math.round((presentes / total) * 100) : 0
    };
}

/**
 * Agrupa a los estudiantes vinculados por "sede" o "carrera" y cuenta,
 * dentro de cada grupo: notificaciones activas, pendientes, sin Telegram,
 * y asistencia. Ordenado de mayor a menor cantidad de estudiantes.
 */
export function agruparEstudiantesPor(
    lista: any[],
    campo: 'sede' | 'carrera',
    estadoFn: (p: any) => EstadoNotif
): StatsPorGrupo[] {
    const etiquetaVacia = campo === 'sede' ? 'Sin sede' : 'Sin carrera';

    const mapa = new Map<string, {
        activas: number; pendientes: number; sinTelegram: number; presentes: number; total: number;
    }>();

    for (const p of lista) {
        const valorCrudo = (p as any)[campo];
        const clave = (valorCrudo && String(valorCrudo).trim()) ? String(valorCrudo).trim() : etiquetaVacia;

        if (!mapa.has(clave)) {
            mapa.set(clave, { activas: 0, pendientes: 0, sinTelegram: 0, presentes: 0, total: 0 });
        }

        const entry = mapa.get(clave)!;
        const estado = estadoFn(p);
        if (estado === 'activa') entry.activas++;
        else if (estado === 'pendiente') entry.pendientes++;
        else entry.sinTelegram++;

        if (p.asistencia) entry.presentes++;
        entry.total++;
    }

    return [...mapa.entries()]
        .map(([etiqueta, v]) => ({
            etiqueta,
            activas: v.activas,
            pendientes: v.pendientes,
            sinTelegram: v.sinTelegram,
            sinActivar: v.pendientes + v.sinTelegram,
            presentes: v.presentes,
            ausentes: v.total - v.presentes,
            total: v.total
        }))
        .sort((a, b) => b.total - a.total);
}

/**
 * Maneja la creación/destrucción de las 5 gráficas de Chart.js.
 * El componente solo le pasa los ElementRef de los <canvas> y los datos
 * ya calculados (statsGenerales / statsPorSede / statsPorCarrera).
 */
export class EstadisticasHelper {

    private chartNotifDonut?: Chart;
    private chartSedeStack?: Chart;
    private chartSedeSinActivar?: Chart;
    private chartCarreraStack?: Chart;
    private chartCarreraSinActivar?: Chart;

    private limpiarChartDeCanvas(ref?: ElementRef<HTMLCanvasElement>): void {
        if (!ref) return;
        Chart.getChart(ref.nativeElement)?.destroy();
    }

    renderizarGraficas(
        refs: CanvasRefs,
        statsGenerales: StatsGenerales,
        porSede: StatsPorGrupo[],
        porCarrera: StatsPorGrupo[]
    ): void {
        this.destruirGraficas();
        [refs.notifDonut, refs.sedeStack, refs.sedeSinActivar, refs.carreraStack, refs.carreraSinActivar]
            .forEach(ref => this.limpiarChartDeCanvas(ref));

        if (statsGenerales.total === 0) return;

        const colorActiva      = '#22c55e';
        const colorPendiente   = '#f59e0b';
        const colorSinTelegram = '#6b7280';
        const colorSinActivar  = '#ef4444';
        const colorTexto       = '#cbd5e1';
        const colorGrilla      = 'rgba(255,255,255,0.06)';

        if (refs.notifDonut) {
            this.chartNotifDonut = new Chart(refs.notifDonut.nativeElement, {
                type: 'doughnut',
                data: {
                    labels: ['Activas', 'Pendientes', 'Sin Telegram'],
                    datasets: [{
                        data: [statsGenerales.activas, statsGenerales.pendientes, statsGenerales.sinTelegram],
                        backgroundColor: [colorActiva, colorPendiente, colorSinTelegram],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { color: colorTexto } } }
                }
            });
        }

        if (refs.sedeStack) {
            this.chartSedeStack = this.crearBarraApilada(
                refs.sedeStack.nativeElement,
                porSede.map(s => s.etiqueta),
                porSede.map(s => s.activas), porSede.map(s => s.pendientes), porSede.map(s => s.sinTelegram),
                colorActiva, colorPendiente, colorSinTelegram, colorTexto, colorGrilla
            );
        }

        if (refs.sedeSinActivar) {
            const ordenado = [...porSede].sort((a, b) => b.sinActivar - a.sinActivar);
            this.chartSedeSinActivar = this.crearBarraRanking(
                refs.sedeSinActivar.nativeElement,
                ordenado.map(s => s.etiqueta), ordenado.map(s => s.sinActivar),
                colorSinActivar, colorTexto, colorGrilla
            );
        }

        if (refs.carreraStack) {
            this.chartCarreraStack = this.crearBarraApilada(
                refs.carreraStack.nativeElement,
                porCarrera.map(c => c.etiqueta),
                porCarrera.map(c => c.activas), porCarrera.map(c => c.pendientes), porCarrera.map(c => c.sinTelegram),
                colorActiva, colorPendiente, colorSinTelegram, colorTexto, colorGrilla
            );
        }

        if (refs.carreraSinActivar) {
            const ordenado = [...porCarrera].sort((a, b) => b.sinActivar - a.sinActivar);
            this.chartCarreraSinActivar = this.crearBarraRanking(
                refs.carreraSinActivar.nativeElement,
                ordenado.map(c => c.etiqueta), ordenado.map(c => c.sinActivar),
                colorSinActivar, colorTexto, colorGrilla
            );
        }
    }

    /** Barra apilada reutilizable (Activas / Pendientes / Sin Telegram) por categoría */
    private crearBarraApilada(
        canvasEl: HTMLCanvasElement,
        etiquetas: string[],
        activas: number[], pendientes: number[], sinTelegram: number[],
        colorActiva: string, colorPendiente: string, colorSinTelegram: string,
        colorTexto: string, colorGrilla: string
    ): Chart {
        return new Chart(canvasEl, {
            type: 'bar',
            data: {
                labels: etiquetas,
                datasets: [
                    { label: 'Activas',      data: activas,     backgroundColor: colorActiva },
                    { label: 'Pendientes',   data: pendientes,  backgroundColor: colorPendiente },
                    { label: 'Sin Telegram', data: sinTelegram, backgroundColor: colorSinTelegram }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, ticks: { color: colorTexto }, grid: { color: colorGrilla } },
                    y: { stacked: true, beginAtZero: true, ticks: { color: colorTexto, precision: 0 }, grid: { color: colorGrilla } }
                },
                plugins: { legend: { position: 'bottom', labels: { color: colorTexto } } }
            }
        });
    }

    /** Barra horizontal de ranking reutilizable (ej. "sin activar" de mayor a menor) */
    private crearBarraRanking(
        canvasEl: HTMLCanvasElement,
        etiquetas: string[], valores: number[],
        color: string, colorTexto: string, colorGrilla: string
    ): Chart {
        return new Chart(canvasEl, {
            type: 'bar',
            data: {
                labels: etiquetas,
                datasets: [{ label: 'Sin activar notificaciones', data: valores, backgroundColor: color }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { beginAtZero: true, ticks: { color: colorTexto, precision: 0 }, grid: { color: colorGrilla } },
                    y: { ticks: { color: colorTexto }, grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    destruirGraficas(): void {
        this.chartNotifDonut?.destroy();
        this.chartSedeStack?.destroy();
        this.chartSedeSinActivar?.destroy();
        this.chartCarreraStack?.destroy();
        this.chartCarreraSinActivar?.destroy();
        this.chartNotifDonut = undefined;
        this.chartSedeStack = undefined;
        this.chartSedeSinActivar = undefined;
        this.chartCarreraStack = undefined;
        this.chartCarreraSinActivar = undefined;
    }
}
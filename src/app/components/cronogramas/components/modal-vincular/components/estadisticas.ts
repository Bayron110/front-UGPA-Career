import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export type EstadoNotif = 'activa' | 'pendiente' | 'sin-telegram';

export function estadoNotifVinculado(p: any): EstadoNotif {
    if (p.notificacionesActivas && p.telegramChatId) return 'activa';
    if (p.telegramUser || p.telegramChatId) return 'pendiente';
    return 'sin-telegram';
}

export function statsGenerales(personasVinculadas: any[]) {
    const lista = personasVinculadas.filter(p => p.tipo === 'estudiante');
    const total = lista.length;
    const activas = lista.filter(p => estadoNotifVinculado(p) === 'activa').length;
    const pendientes = lista.filter(p => estadoNotifVinculado(p) === 'pendiente').length;
    const sinTelegram = lista.filter(p => estadoNotifVinculado(p) === 'sin-telegram').length;
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

export function agruparEstudiantesPor(
    personasVinculadas: any[],
    campo: 'sede' | 'carrera'
) {
    const lista = personasVinculadas.filter(p => p.tipo === 'estudiante');
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
        const estado = estadoNotifVinculado(p);
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

export function statsPorSede(personasVinculadas: any[]) {
    return agruparEstudiantesPor(personasVinculadas, 'sede').map(s => ({ sede: s.etiqueta, ...s }));
}

export function statsPorCarrera(personasVinculadas: any[]) {
    return agruparEstudiantesPor(personasVinculadas, 'carrera').map(c => ({ carrera: c.etiqueta, ...c }));
}

// ── Gráficas ─────────────────────────────────────────────────────────────

export interface CanvasesGraficas {
    notifDonut?: HTMLCanvasElement;
    sedeStack?: HTMLCanvasElement;
    sedeSinActivar?: HTMLCanvasElement;
    carreraStack?: HTMLCanvasElement;
    carreraSinActivar?: HTMLCanvasElement;
}

export interface ChartsCreados {
    notifDonut?: Chart;
    sedeStack?: Chart;
    sedeSinActivar?: Chart;
    carreraStack?: Chart;
    carreraSinActivar?: Chart;
}

export function destruirGraficas(charts: ChartsCreados): void {
    charts.notifDonut?.destroy();
    charts.sedeStack?.destroy();
    charts.sedeSinActivar?.destroy();
    charts.carreraStack?.destroy();
    charts.carreraSinActivar?.destroy();
}

function crearBarraApilada(
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

function crearBarraRanking(
    canvasEl: HTMLCanvasElement,
    etiquetas: string[], valores: number[],
    color: string, colorTexto: string, colorGrilla: string
): Chart {
    return new Chart(canvasEl, {
        type: 'bar',
        data: {
            labels: etiquetas,
            datasets: [{
                label: 'Sin activar notificaciones',
                data: valores,
                backgroundColor: color
            }]
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

/**
 * Crea (o recrea) todas las gráficas del dashboard. Devuelve las nuevas
 * instancias para que las guardes en tu componente y luego las destruyas
 * con destruirGraficas() cuando corresponda.
 */
export function renderizarGraficas(
    personasVinculadas: any[],
    canvases: CanvasesGraficas,
    chartsPrevios: ChartsCreados
): ChartsCreados {
    destruirGraficas(chartsPrevios);

    // Limpia charts "huérfanos" que Chart.js pueda tener registrados
    // en esos mismos <canvas> (ej. si Angular reutilizó el nodo del DOM).
    Object.values(canvases).forEach(el => {
        if (el) Chart.getChart(el)?.destroy();
    });

    const nuevos: ChartsCreados = {};

    const stats = statsGenerales(personasVinculadas);
    if (stats.total === 0) return nuevos;

    const porSede = statsPorSede(personasVinculadas);
    const porCarrera = statsPorCarrera(personasVinculadas);

    const colorActiva      = '#22c55e';
    const colorPendiente   = '#f59e0b';
    const colorSinTelegram = '#6b7280';
    const colorSinActivar  = '#ef4444';
    const colorTexto       = '#cbd5e1';
    const colorGrilla      = 'rgba(255,255,255,0.06)';

    if (canvases.notifDonut) {
        nuevos.notifDonut = new Chart(canvases.notifDonut, {
            type: 'doughnut',
            data: {
                labels: ['Activas', 'Pendientes', 'Sin Telegram'],
                datasets: [{
                    data: [stats.activas, stats.pendientes, stats.sinTelegram],
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

    if (canvases.sedeStack) {
        nuevos.sedeStack = crearBarraApilada(
            canvases.sedeStack,
            porSede.map(s => s.sede),
            porSede.map(s => s.activas), porSede.map(s => s.pendientes), porSede.map(s => s.sinTelegram),
            colorActiva, colorPendiente, colorSinTelegram, colorTexto, colorGrilla
        );
    }

    if (canvases.sedeSinActivar) {
        const ordenado = [...porSede].sort((a, b) => b.sinActivar - a.sinActivar);
        nuevos.sedeSinActivar = crearBarraRanking(
            canvases.sedeSinActivar,
            ordenado.map(s => s.sede), ordenado.map(s => s.sinActivar),
            colorSinActivar, colorTexto, colorGrilla
        );
    }

    if (canvases.carreraStack) {
        nuevos.carreraStack = crearBarraApilada(
            canvases.carreraStack,
            porCarrera.map(c => c.carrera),
            porCarrera.map(c => c.activas), porCarrera.map(c => c.pendientes), porCarrera.map(c => c.sinTelegram),
            colorActiva, colorPendiente, colorSinTelegram, colorTexto, colorGrilla
        );
    }

    if (canvases.carreraSinActivar) {
        const ordenado = [...porCarrera].sort((a, b) => b.sinActivar - a.sinActivar);
        nuevos.carreraSinActivar = crearBarraRanking(
            canvases.carreraSinActivar,
            ordenado.map(c => c.carrera), ordenado.map(c => c.sinActivar),
            colorSinActivar, colorTexto, colorGrilla
        );
    }

    return nuevos;
}
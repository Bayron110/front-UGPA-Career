export type EstadoNotif = 'activa' | 'pendiente' | 'sin-telegram';

function estadoNotifVinculado(p: any): EstadoNotif {
    if (p.notificacionesActivas && p.telegramChatId) return 'activa';
    if (p.telegramUser || p.telegramChatId) return 'pendiente';
    return 'sin-telegram';
}

function etiquetaNotif(estado: EstadoNotif): string {
    if (estado === 'activa') return 'Activa';
    if (estado === 'pendiente') return 'Pendiente';
    return 'Sin Telegram';
}

function formatearFecha(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function slug(texto: string): string {
    return texto
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function cargarSheetJS(): Promise<any> {
    if ((window as any).XLSX) return Promise.resolve((window as any).XLSX);
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = () => resolve((window as any).XLSX);
        script.onerror = () => reject(new Error('No se pudo cargar la librería de exportación.'));
        document.head.appendChild(script);
    });
}

/**
 * Exporta los estudiantes vinculados a un archivo Excel.
 * Lanza un Error si algo falla, para que el llamador decida cómo avisar
 * al usuario (alert, toast, etc.) sin depender de esta función.
 */
export async function exportarExcel(
    personasVinculadas: any[],
    nombreCronograma: string | undefined
): Promise<void> {
    const datos = personasVinculadas.filter(p => p.tipo === 'estudiante');

    if (datos.length === 0) {
        throw new Error('No hay estudiantes vinculados para exportar.');
    }

    const XLSX = await cargarSheetJS();

    const filas = datos.map(p => ({
        'Cédula': p.cedula ?? '',
        'Nombre': p.nombres ?? '',
        'Carrera': p.carrera ?? '',
        'Sede': p.sede ?? '',
        'Telegram': p.telegramUser ? '@' + p.telegramUser : '',
        'Notificaciones': etiquetaNotif(estadoNotifVinculado(p)),
        'Asistencia': p.asistencia ? 'Presente' : 'Ausente',
        'Fecha de vinculación': formatearFecha(p.fechaVinculacion)
    }));

    const hoja = XLSX.utils.json_to_sheet(filas);

    hoja['!cols'] = [
        { wch: 14 }, { wch: 28 }, { wch: 26 }, { wch: 20 },
        { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 18 }
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Estudiantes');

    const nombreCrono = nombreCronograma ?? 'cronograma';
    const fecha = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `estudiantes_${slug(nombreCrono)}_${fecha}.xlsx`;

    XLSX.writeFile(libro, nombreArchivo);
}
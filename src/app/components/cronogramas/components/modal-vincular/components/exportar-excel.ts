export type EstadoNotif = 'activa' | 'pendiente' | 'sin-telegram';

export class ExportarExcelHelper {

    /**
     * Genera y descarga el Excel de estudiantes vinculados.
     * `obtenerEstado` es la función del componente que calcula el
     * EstadoNotif de cada persona (estadoNotifVinculado), para no duplicar
     * esa lógica aquí.
     */
    async exportar(
        datos: any[],
        nombreCronograma: string,
        obtenerEstado: (p: any) => EstadoNotif
    ): Promise<void> {
        const XLSX = await this.cargarSheetJS();

        const filas = datos.map(p => ({
            'Cédula': p.cedula ?? '',
            'Nombre': p.nombres ?? '',
            'Carrera': p.carrera ?? '',
            'Sede': p.sede ?? '',
            'Telegram': p.telegramUser ? '@' + p.telegramUser : '',
            'Notificaciones': this.etiquetaNotif(obtenerEstado(p)),
            'Asistencia': p.asistencia ? 'Presente' : 'Ausente',
            'Fecha de vinculación': this.formatearFecha(p.fechaVinculacion)
        }));

        const hoja = XLSX.utils.json_to_sheet(filas);

        hoja['!cols'] = [
            { wch: 14 }, { wch: 28 }, { wch: 26 }, { wch: 20 },
            { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 18 }
        ];

        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, 'Estudiantes');

        const fecha = new Date().toISOString().slice(0, 10);
        const nombreArchivo = `estudiantes_${this.slug(nombreCronograma)}_${fecha}.xlsx`;

        XLSX.writeFile(libro, nombreArchivo);
    }

    private etiquetaNotif(estado: EstadoNotif): string {
        if (estado === 'activa') return 'Activa';
        if (estado === 'pendiente') return 'Pendiente';
        return 'Sin Telegram';
    }

    private formatearFecha(iso: string | undefined): string {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }

    private slug(texto: string): string {
        return texto
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }

    private cargarSheetJS(): Promise<any> {
        if ((window as any).XLSX) return Promise.resolve((window as any).XLSX);
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = () => resolve((window as any).XLSX);
            script.onerror = () => reject(new Error('No se pudo cargar la librería de exportación.'));
            document.head.appendChild(script);
        });
    }
}
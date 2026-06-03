import { Injectable } from '@angular/core';

import {
    initializeApp,
    getApps,
    getApp
} from 'firebase/app';

import {
    getDatabase,
    ref,
    push,
    set,
    get,
    update,
    remove,
    child,
    onValue
} from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyAl394v1xuNXxqkT6lEsiPQf74mFSIW6bw",
    authDomain: "cronogramas-estudiantes.firebaseapp.com",
    databaseURL: "https://cronogramas-estudiantes-default-rtdb.firebaseio.com",
    projectId: "cronogramas-estudiantes",
    storageBucket: "cronogramas-estudiantes.firebasestorage.app",
    messagingSenderId: "1079875324500",
    appId: "1:1079875324500:web:d398c2ea7e224c2d1c7bc1"
};

/**
 * Evita crear Firebase dos veces
 */
const app = getApps().find(a => a.name === 'cronogramas')
    ?? initializeApp(firebaseConfig, 'cronogramas');

const db = getDatabase(app);

export interface ActividadCronograma {
    actividad: string;
    fechaInicio: string;
    fechaFin: string;
}

export interface Cronograma {
    id?: string;

    nombre: string;
    periodo: string;

    colorFondo: string;
    colorTexto: string;
    colorBorde: string;

    fuente: string;

    fechaInicio: string;
    fechaFin: string;

    fechaPublicacion: string;

    estado: 'PROGRAMADO' | 'VIGENTE' | 'FINALIZADO';

    actividades: ActividadCronograma[];

    // ← Esto es lo que falta
    estudiantesVinculados?: {
        [cedula: string]: {
            cedula: string;
            nombre: string;
            carrera: string;
            telegramUser: string;
            asistencia: boolean;
            fechaVinculacion: string;
        }
    };
}
@Injectable({
    providedIn: 'root'
})
export class CronogramaService {

    private ruta = 'cronogramas';

    constructor() { }

    /**
     * Crear cronograma
     */
async crearCronograma(cronograma: Cronograma): Promise<string> {
    try {
        const datos = JSON.parse(JSON.stringify(cronograma));

        // AGREGA ESTO — verifica qué instancia se está usando
        console.log('DB instance:', db);
        console.log('DB app name:', db.app.name);
        console.log('DB URL:', (db as any)._repoInternal?.repoInfo_?.host);

        console.log('1. Datos a guardar:', datos);

        const nuevoRef = push(ref(db, this.ruta));
        console.log('2. Key generada:', nuevoRef.key);
        console.log('3. Ref toString:', nuevoRef.toString()); // ← ESTA ES LA CLAVE

        await set(nuevoRef, datos);
        console.log('4. Guardado exitosamente');

        return nuevoRef.key ?? '';

    } catch (error) {
        console.error('ERROR FIREBASE:', error);
        throw error;
    }
}

    /**
     * Publicar cronograma
     */
    async publicarCronograma(
        cronograma: Cronograma
    ): Promise<string> {

        const cronogramaPreparado =
            this.prepararPublicacion(cronograma);

        return await this.crearCronograma(
            cronogramaPreparado
        );
    }

    /**
     * Obtener todos
     */
    async obtenerCronogramas(): Promise<Cronograma[]> {

        const snapshot = await get(ref(db, this.ruta));

        if (!snapshot.exists()) {
            return [];
        }

        const data = snapshot.val();

        return Object.keys(data).map(id => ({
            id,
            ...data[id]
        }));
    }

    /**
     * Escuchar cambios en tiempo real
     */
    escucharCronogramas(
        callback: (cronogramas: Cronograma[]) => void
    ): void {

        const cronogramasRef =
            ref(db, this.ruta);

        onValue(cronogramasRef, snapshot => {

            if (!snapshot.exists()) {
                callback([]);
                return;
            }

            const data = snapshot.val();

            const lista = Object.keys(data).map(id => ({
                id,
                ...data[id]
            }));

            callback(lista);
        });
    }

    /**
     * Obtener uno
     */
    async obtenerCronograma(
        id: string
    ): Promise<Cronograma | null> {

        const snapshot = await get(
            child(
                ref(db),
                `${this.ruta}/${id}`
            )
        );

        if (!snapshot.exists()) {
            return null;
        }

        return {
            id,
            ...snapshot.val()
        };
    }

    /**
     * Actualizar
     */
    async actualizarCronograma(
        id: string,
        datos: Partial<Cronograma>
    ): Promise<void> {

        await update(
            ref(
                db,
                `${this.ruta}/${id}`
            ),
            datos
        );
    }

    /**
     * Eliminar
     */
    async eliminarCronograma(
        id: string
    ): Promise<void> {

        await remove(
            ref(
                db,
                `${this.ruta}/${id}`
            )
        );
    }

    /**
     * Duplicar cronograma
     */
    async duplicarCronograma(
        id: string
    ): Promise<string> {

        const cronograma =
            await this.obtenerCronograma(id);

        if (!cronograma) {
            throw new Error(
                'Cronograma no encontrado'
            );
        }

        delete cronograma.id;

        cronograma.nombre =
            cronograma.nombre + ' (Copia)';

        cronograma.fechaPublicacion = '';

        cronograma.estado =
            'PROGRAMADO';

        return await this.crearCronograma(
            cronograma
        );
    }

    /**
     * Calcular estado
     */
    calcularEstado(
        fechaInicio: string,
        fechaFin: string
    ): 'PROGRAMADO' | 'VIGENTE' | 'FINALIZADO' {

        if (!fechaInicio || !fechaFin) {
            return 'PROGRAMADO';
        }

        const hoy = new Date();

        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        if (isNaN(inicio.getTime())) {
            return 'PROGRAMADO';
        }

        if (isNaN(fin.getTime())) {
            return 'PROGRAMADO';
        }

        if (hoy < inicio) {
            return 'PROGRAMADO';
        }

        if (
            hoy >= inicio &&
            hoy <= fin
        ) {
            return 'VIGENTE';
        }

        return 'FINALIZADO';
    }

    /**
     * Actualizar estado individual
     */
    async actualizarEstado(
        id: string
    ): Promise<void> {

        const cronograma =
            await this.obtenerCronograma(id);

        if (!cronograma) {
            return;
        }

        const estado =
            this.calcularEstado(
                cronograma.fechaInicio,
                cronograma.fechaFin
            );

        await this.actualizarCronograma(
            id,
            {
                estado
            }
        );
    }

    /**
     * Actualizar todos los estados
     */
    async actualizarTodosLosEstados(): Promise<void> {

        const cronogramas =
            await this.obtenerCronogramas();

        for (const cronograma of cronogramas) {

            if (!cronograma.id) {
                continue;
            }

            const estado =
                this.calcularEstado(
                    cronograma.fechaInicio,
                    cronograma.fechaFin
                );

            await this.actualizarCronograma(
                cronograma.id,
                {
                    estado
                }
            );
        }
    }

    /**
     * Obtener vigentes
     */
    async obtenerVigentes(): Promise<Cronograma[]> {

        const cronogramas =
            await this.obtenerCronogramas();

        return cronogramas.filter(
            c => c.estado === 'VIGENTE'
        );
    }

    /**
     * Obtener programados
     */
    async obtenerProgramados(): Promise<Cronograma[]> {

        const cronogramas =
            await this.obtenerCronogramas();

        return cronogramas.filter(
            c => c.estado === 'PROGRAMADO'
        );
    }

    /**
     * Obtener finalizados
     */
    async obtenerFinalizados(): Promise<Cronograma[]> {

        const cronogramas =
            await this.obtenerCronogramas();

        return cronogramas.filter(
            c => c.estado === 'FINALIZADO'
        );
    }

    /**
     * Obtener fecha menor
     */
    obtenerFechaInicio(
        actividades: ActividadCronograma[]
    ): string {

        if (
            !actividades ||
            actividades.length === 0
        ) {
            return '';
        }

        return actividades[0].fechaInicio;
    }

    /**
     * Obtener fecha mayor
     */
    obtenerFechaFin(
        actividades: ActividadCronograma[]
    ): string {

        if (
            !actividades ||
            actividades.length === 0
        ) {
            return '';
        }

        return actividades[
            actividades.length - 1
        ].fechaFin;
    }
    /**
     * Preparar publicación
     */
    prepararPublicacion(
        cronograma: Cronograma
    ): Cronograma {

        const fechaInicio =
            this.obtenerFechaInicio(
                cronograma.actividades
            );

        const fechaFin =
            this.obtenerFechaFin(
                cronograma.actividades
            );

        const estado =
            this.calcularEstado(
                fechaInicio,
                fechaFin
            );

        return {
            ...cronograma,

            fechaInicio,

            fechaFin,

            estado,

            fechaPublicacion:
                new Date().toISOString()
        };
    }
}
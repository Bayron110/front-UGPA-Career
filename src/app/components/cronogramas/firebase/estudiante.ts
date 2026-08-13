import { Injectable } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyBrQcB6YN3FY2kvkthvtFjmRip1vz6l2Fg",
    authDomain: "inducciones-grupos.firebaseapp.com",
    databaseURL: "https://inducciones-grupos-default-rtdb.firebaseio.com",
    projectId: "inducciones-grupos",
    storageBucket: "inducciones-grupos.firebasestorage.app",
    messagingSenderId: "870909696149",
    appId: "1:870909696149:web:64276b9facd0c12c12e39c"
};

const app = getApps().find(a => a.name === 'inducciones')
    ?? initializeApp(firebaseConfig, 'inducciones');

const db = getDatabase(app);

export interface Estudiante {
    id?: string;
    cedula: string;
    nombres: string;
    carrera: string;
    sede: string;
    telegramUser: string;
    asistencia: boolean;
}

export interface GrupoInduccion {
    id: string;
    nombres: string;
    totalEstudiantes: number;
    creadoEn: number;
}

@Injectable({ providedIn: 'root' })
export class EstudiantesService {

    /**
     * Obtener todos los grupos disponibles
     */
    async obtenerGrupos(): Promise<GrupoInduccion[]> {
        const snapshot = await get(ref(db, 'grupos'));
        if (!snapshot.exists()) return [];

        const data = snapshot.val();

        return Object.keys(data)
            .map(id => ({
                id,
                nombres:           data[id].nombres         ?? id,
                totalEstudiantes: data[id].totalEstudiantes ?? 0,
                creadoEn:         data[id].creadoEn        ?? 0
            }))
            .sort((a, b) => b.creadoEn - a.creadoEn); // más reciente primero
    }

    /**
     * Obtener estudiantes de un grupo específico
     */
    async obtenerEstudiantesDeGrupo(grupoId: string): Promise<Estudiante[]> {
        const snapshot = await get(ref(db, `grupos/${grupoId}/estudiantes`));
        if (!snapshot.exists()) return [];

        const data = snapshot.val();

        return Object.keys(data).map(cedula => ({
            id:           cedula,
            cedula:       data[cedula].cedula       ?? cedula,
            nombres:      data[cedula].nombres      ?? '—',
            carrera:      data[cedula].carrera      ?? '—',
            sede:         data[cedula].sede         ?? data[cedula].Sede ?? data[cedula].sede_nombre ?? '',
            telegramUser: data[cedula].telegramUser ?? data[cedula].telegram ?? '',
            asistencia:   data[cedula].asistencia   ?? false
        }));
    }

    /**
     * Obtener TODOS los estudiantes de TODOS los grupos en una sola lectura.
     * Útil para búsquedas retroactivas por cédula (ej. actualizar la sede
     * de estudiantes que ya fueron vinculados a un cronograma antes de que
     * existiera el campo "sede", o que se vincularon manualmente).
     * Si una misma cédula aparece en más de un grupo, se conserva la del
     * grupo más reciente (creadoEn más alto).
     */
    async obtenerTodosLosEstudiantes(): Promise<Map<string, Estudiante>> {
        const snapshot = await get(ref(db, 'grupos'));
        const mapa = new Map<string, Estudiante & { __creadoEn: number }>();
        if (!snapshot.exists()) return mapa as unknown as Map<string, Estudiante>;

        const gruposData = snapshot.val();

        for (const grupoId of Object.keys(gruposData)) {
            const grupo = gruposData[grupoId];
            const creadoEn = grupo.creadoEn ?? 0;
            const estudiantes = grupo.estudiantes ?? {};

            for (const cedula of Object.keys(estudiantes)) {
                const d = estudiantes[cedula];
                const existente = mapa.get(cedula);

                if (existente && existente.__creadoEn >= creadoEn) continue;

                mapa.set(cedula, {
                    id:           cedula,
                    cedula:       d.cedula       ?? cedula,
                    nombres:      d.nombres      ?? '—',
                    carrera:      d.carrera      ?? '—',
                    sede:         d.sede         ?? d.Sede ?? d.sede_nombre ?? '',
                    telegramUser: d.telegramUser ?? d.telegram ?? '',
                    asistencia:   d.asistencia   ?? false,
                    __creadoEn:   creadoEn
                });
            }
        }

        return mapa as unknown as Map<string, Estudiante>;
    }
}
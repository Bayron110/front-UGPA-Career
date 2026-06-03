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
            id:          cedula,
            cedula:      data[cedula].cedula      ?? cedula,
            nombres:      data[cedula].nombres      ?? '—',
            carrera:     data[cedula].carrera     ?? '—',
            telegramUser: data[cedula].telegramUser ?? data[cedula].telegram ?? '',
            asistencia:  data[cedula].asistencia  ?? false
        }));
    }
}
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

// Proyecto Firestore de "UTET" (requisitos de titulación) — distinto al de cronogramas
const utetFirebaseConfig = {
    apiKey: "AIzaSyCaHf1C0BB0X_H3BDZ1o-UDAsPmLTjsZLA",
    authDomain: "utet-4387a.firebaseapp.com",
    projectId: "utet-4387a",
    storageBucket: "utet-4387a.firebasestorage.app",
    messagingSenderId: "902848131454",
    appId: "1:902848131454:web:47f515eb6480834724c32f"
};

const NOMBRE_APP_UTET = 'utetFirestoreApp';

function obtenerAppUtet(): FirebaseApp {
    const existente = getApps().find(a => a.name === NOMBRE_APP_UTET);
    if (existente) return existente;
    return initializeApp(utetFirebaseConfig, NOMBRE_APP_UTET);
}

let dbUtet: Firestore | null = null;

/** Devuelve la instancia de Firestore del proyecto utet-4387a (singleton). */
export function getUtetFirestore(): Firestore {
    if (!dbUtet) {
        dbUtet = getFirestore(obtenerAppUtet());
    }
    return dbUtet;
}
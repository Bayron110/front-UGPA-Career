
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
const firebaseConfigDocente = {
    apiKey: "AIzaSyANtWmjXdlHkf-LO4t2gtpyymmjeEr2emI",
    authDomain: "repaso-fire-d8ceb.firebaseapp.com",
    databaseURL: "https://repaso-fire-d8ceb-default-rtdb.firebaseio.com",
    projectId: "repaso-fire-d8ceb",
    storageBucket: "repaso-fire-d8ceb.firebasestorage.app",
    messagingSenderId: "1080713449199",
    appId: "1:1080713449199:web:a94fd6c6e26766b4e2551a"
};

const appDocente =
    getApps().find(app => app.name === 'docenteApp') ||
    initializeApp(firebaseConfigDocente, 'docenteApp');

const dbDocente = getDatabase(appDocente);

export { appDocente, dbDocente };
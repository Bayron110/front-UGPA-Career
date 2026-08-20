import { Routes } from '@angular/router';

import { DocumentosWebDocente } from './components/documentos-web-docente/documentos-web-docente';
import { Home } from './pages/home/home';
import { Cronogramas } from './components/cronogramas/cronogramas';
import { Documentos } from './components/documentos/documentos';
import { DocentesRegistrados } from './components/docentes-registrados/docentes-registrados';
import { Login } from './components/login/login';
import { loginProteccionGuard } from './guards/login-proteccion-guard';
import { permisosGuard } from './guards/permisos-guard';

export const routes: Routes = [
    { path: "Home", component: Home, canActivate: [loginProteccionGuard] },

    {
        path: "Documentos-Web", component: DocumentosWebDocente,
        canActivate: [loginProteccionGuard, permisosGuard],
        data: { modulo: 'irDocumentosWeb', nivelMinimo: 'lectura' }
    },
    {
        path: "Cronogramas", component: Cronogramas,
        canActivate: [loginProteccionGuard, permisosGuard],
        data: { modulo: 'irACronogramas', nivelMinimo: 'lectura' }
    },
    {
        path: "Informes-UGPA", component: Documentos,
        canActivate: [loginProteccionGuard, permisosGuard],
        data: { modulo: 'irAInformesUGPA', nivelMinimo: 'lectura' }
    },
    {
        path: "Docente-Registro", component: DocentesRegistrados,
        canActivate: [loginProteccionGuard, permisosGuard],
        data: { modulo: 'irADocentes', nivelMinimo: 'lectura' }
    },

    { path: "Login", component: Login },
    { path: '', redirectTo: 'Login', pathMatch: 'full' },
];
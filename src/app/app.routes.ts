import { Routes } from '@angular/router';

import { DocumentosWebDocente } from './components/documentos-web-docente/documentos-web-docente';
import { Home } from './pages/home/home';
import { Cronogramas } from './components/cronogramas/cronogramas';
import { Documentos } from './components/documentos/documentos';

export const routes: Routes = [
    { path: "Home", component: Home },

    { path: "Documentos-Web", component: DocumentosWebDocente },
    {path:"Cronogramas", component: Cronogramas},
    {path:"Informes-UGPA", component: Documentos},
    { path: '', redirectTo: 'Home', pathMatch: 'full' },

];

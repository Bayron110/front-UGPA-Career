import { Routes } from '@angular/router';

import { DocumentosWebDocente } from './components/documentos-web-docente/documentos-web-docente';
import { Home } from './pages/home/home';
import { EventosComponent } from './components/eventos/eventos';

export const routes: Routes = [
    { path: "Home", component: Home },

    { path: "Documentos-Web", component: DocumentosWebDocente },
    {path:"Agenda", component: EventosComponent},
    { path: '', redirectTo: 'Home', pathMatch: 'full' },

];

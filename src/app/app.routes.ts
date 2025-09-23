import { Routes } from '@angular/router';
import { CarreraI } from './components/carrera-i/carrera-i';
import { Home } from './pages/home/home';
import { TipoCarrera } from './components/tipo-carrera/tipo-carrera';
import { CareerCal } from './components/career-cal/career-cal';

import { Guardados } from './components/guardados/guardados';
import { HistoryEjes } from './components/history-ejes/history-ejes';
import { GuardadoTsu } from './components/guardado-tsu/guardado-tsu';
import { HistoryEjesTsu } from './components/history-ejes-tsu/history-ejes-tsu';

export const routes: Routes = [

    {path:"Home", component:Home},
    {path:"Carrera", component:CarreraI},
    {path:"Tipo", component:TipoCarrera},
    {path:"Cal", component:CareerCal},
    {path:"vista", component:Guardados},
    {path:"history", component:HistoryEjes},
    {path:"tsu", component:GuardadoTsu},
    {path:"history-tsu", component:HistoryEjesTsu},


{ path: '', redirectTo: 'Home', pathMatch: 'full' },

];

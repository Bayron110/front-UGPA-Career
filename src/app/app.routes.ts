import { Routes } from '@angular/router';
import { CarreraI } from './components/carrera-i/carrera-i';
import { Home } from './pages/home/home';
import { TipoCarrera } from './components/tipo-carrera/tipo-carrera';
import { CareerCal } from './components/career-cal/career-cal';
import { Axles } from './components/axles/axles';
import { AxlesTsu } from './components/axles-tsu/axles-tsu';
import { Guardados } from './components/guardados/guardados';

export const routes: Routes = [

    {path:"Home", component:Home},
    {path:"Carrera", component:CarreraI},
    {path:"Tipo", component:TipoCarrera},
    {path:"Cal", component:CareerCal},
    {path:"superior", component:Axles},
    {path:"tsu", component:AxlesTsu},
    {path:"vista", component:Guardados},


];

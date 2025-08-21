import { Routes } from '@angular/router';
import { CarreraI } from './components/carrera-i/carrera-i';
import { Home } from './pages/home/home';
import { TipoCarrera } from './components/tipo-carrera/tipo-carrera';
import { CareerCal } from './components/career-cal/career-cal';

export const routes: Routes = [

    {path:"Home", component:Home},
    {path:"Carrera", component:CarreraI},
    {path:"Tipo", component:TipoCarrera},
    {path:"Cal", component:CareerCal}
];

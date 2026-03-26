import { Routes } from '@angular/router';
import { CarreraI } from './components/carrera-i/carrera-i';
import { Home } from './pages/home/home';
import { TipoCarrera } from './components/tipo-carrera/tipo-carrera';
import { CareerCal } from './components/career-cal/career-cal';

import { Guardados } from './components/guardados/guardados';
import { HistoryEjes } from './components/history-ejes/history-ejes';
import { GuardadoTsu } from './components/guardado-tsu/guardado-tsu';
import { HistoryEjesTsu } from './components/history-ejes-tsu/history-ejes-tsu';
import { AcuerdoPD } from './components/acuerdo-pd/acuerdo-pd';
import { Component } from '@angular/core';
import { ReporteResultados } from './components/reporte-resultados/reporte-resultados';
import { ReporteAnual } from './components/reporte-anual/reporte-anual';
import { EventosComponent } from './components/eventos/eventos';
import { ListadoCapacitaciones } from './components2/listado-capacitaciones/listado-capacitaciones';

export const routes: Routes = [

    {path:"Home", component:Home},
    {path:"Carrera", component:CarreraI},
    {path:"Tipo", component:TipoCarrera},
    {path:"Cal", component:CareerCal},
    {path:"vista", component:Guardados},
    {path:"history", component:HistoryEjes},
    {path:"tsu", component:GuardadoTsu},
    {path:"history-tsu", component:HistoryEjesTsu},
    {path:"generar", component:AcuerdoPD},
    {path: "ReporteR", component:ReporteResultados},
    {path:"reporteA", component:ReporteAnual},
    {path:"Agenda", component:EventosComponent},
    {path:"Control", component:ListadoCapacitaciones},
{ path: '', redirectTo: 'Home', pathMatch: 'full' },

];

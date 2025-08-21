import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TypeCareer } from '../Interface/TypeCareer';

@Injectable({
  providedIn: 'root'
})
export class TypeCareerServices {

private apiUrl = 'http://localhost:8080/api/type-career';
  constructor(private http: HttpClient) {}
  guardar(carrera: TypeCareer): Observable<TypeCareer> {
    return this.http.post<TypeCareer>(this.apiUrl, carrera);
  }
  obtenerTipo(): Observable<TypeCareer[]> {
    return this.http.get<TypeCareer[]>(this.apiUrl);
  }
}
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Career } from '../Interface/Career';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CaeerService {
  private apiUrl = 'http://localhost:8080/api/carreras';

  constructor(private http: HttpClient) {}

  guardarCarrera(career: Career): Observable<Career> {
    return this.http.post<Career>(this.apiUrl, career);
  }
  obtenerCarreras(): Observable<Career[]> {
  return this.http.get<Career[]>(this.apiUrl);
}
}

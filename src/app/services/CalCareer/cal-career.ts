import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CalCareer } from '../../Interface/CalCareer';

@Injectable({
  providedIn: 'root'
})
export class CalCareerService {
  private apiUrl = 'http://localhost:8080/api/cal-career';

  constructor(private http: HttpClient) {}

  getAll(): Observable<CalCareer[]> { return this.http.get<CalCareer[]>(this.apiUrl); }
  getById(id: string): Observable<CalCareer> { return this.http.get<CalCareer>(`${this.apiUrl}/${id}`); }
  create(calCareer: any): Observable<CalCareer> {
    return this.http.post<CalCareer>(this.apiUrl, calCareer, { headers: { 'Content-Type': 'application/json' } });
  }
  update(id: string, calCareer: CalCareer): Observable<CalCareer> {
    return this.http.put<CalCareer>(`${this.apiUrl}/${id}`, calCareer);
  }
  delete(id: string): Observable<void> { return this.http.delete<void>(`${this.apiUrl}/${id}`); }
}

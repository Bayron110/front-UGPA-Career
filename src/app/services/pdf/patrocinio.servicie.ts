import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PatrocinioService {

  private apiUrl = 'https://baken-ugpa-career.onrender.com/api/pdf/convertir'; // endpoint Spring Boot

  constructor(private http: HttpClient) {}

  convertirWord(formData: FormData): Observable<Blob> {
    return this.http.post(this.apiUrl, formData, { responseType: 'blob' }); // devuelve PDF como Blob
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Documento } from '../../Interface/documentos';

@Injectable({
  providedIn: 'root'
})
export class DocumentosService {
  private apiUrl = "https://baken-ugpa-career.onrender.com/api/documentos";

  constructor(private http: HttpClient) {}

  subirDocumento(file: File, nombre: string, descripcion: string): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('nombre', nombre);
    formData.append('descripcion', descripcion);

    // 👇 Aquí aplicamos la segunda opción: respuesta como texto
    return this.http.post(`${this.apiUrl}/upload`, formData, { responseType: 'text' });
  }

  listarDocumentos(): Observable<Documento[]> {
    return this.http.get<Documento[]>(`${this.apiUrl}/list`);
  }

  descargarDocumento(fileId: string): Observable<Blob> {
  return this.http.get(
    `https://baken-ugpa-career.onrender.com/api/documentos/download/${fileId}`,
    { responseType: 'blob' }
  );
}
}
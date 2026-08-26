import { Injectable } from '@angular/core';

export interface CamposGenerados {
  Descripcion: string;
  Objectivos: string;
  dirigido: string;
  Contenido1: string;
  Contenido2: string;
  Contenido3: string;
  Contenido4: string;
  Unidad1: string;
  Unidad2: string;
  Unidad3: string;
  Unidad4: string;
  LAprendizaje1: string;
  LAprendizaje2: string;
  LAprendizaje3: string;
  LAprendizaje4: string;
}

@Injectable({
  providedIn: 'root'
})
export class IaService {

  private readonly apiKey = 'AQ.Ab8RN6Ict0YBlIdYkvIOzWWKKX2PBRoBauv_2ZqnQ8lNQ3eoLA';
  private readonly modelo = 'gemini-3.6-flash';
  private readonly endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelo}:generateContent`;

  private readonly esquemaJson = {
    type: 'OBJECT',
    properties: {
      Descripcion: { type: 'STRING' },
      Objectivos: { type: 'STRING' },
      dirigido: { type: 'STRING' },
      Contenido1: { type: 'STRING' },
      Contenido2: { type: 'STRING' },
      Contenido3: { type: 'STRING' },
      Contenido4: { type: 'STRING' },
      Unidad1: { type: 'STRING' },
      Unidad2: { type: 'STRING' },
      Unidad3: { type: 'STRING' },
      Unidad4: { type: 'STRING' },
      LAprendizaje1: { type: 'STRING' },
      LAprendizaje2: { type: 'STRING' },
      LAprendizaje3: { type: 'STRING' },
      LAprendizaje4: { type: 'STRING' }
    },
    required: [
      'Descripcion', 'Objectivos', 'dirigido',
      'Contenido1', 'Contenido2', 'Contenido3', 'Contenido4',
      'Unidad1', 'Unidad2', 'Unidad3', 'Unidad4',
      'LAprendizaje1', 'LAprendizaje2', 'LAprendizaje3', 'LAprendizaje4'
    ]
  };

  async generarContenidoInforme(
    promptUsuario: string,
    capacitacion: string,
    carrera: string,
    intentos: number = 3
  ): Promise<CamposGenerados> {

    const systemPrompt = `
Eres un asistente que redacta contenido para un informe de planificación de capacitaciones.
Debes devolver ÚNICAMENTE un JSON válido con las claves solicitadas, sin texto adicional, sin markdown.
Contexto fijo:
- Capacitación: "${capacitacion}"
- Carrera/área: "${carrera || 'No aplica'}"
Reglas:
- Redacta en español formal, tono institucional/educativo.
- "Descripcion": texto EXTENSO de 4 a 6 párrafos (similar en longitud y profundidad al texto de ejemplo que se te proporciona como referencia de estilo), cubriendo: contexto/problema que resuelve la capacitación, metodología, herramientas y técnicas a usar, beneficios para el participante, y cierre.
- "Objectivos": 4-6 líneas, puede incluir varios objetivos específicos.
- "dirigido": una frase corta indicando el público objetivo.
- "Unidad1..Unidad4": nombres cortos de unidades temáticas.
- "Contenido1..Contenido4": contenido de cada unidad, 2-3 líneas.
- "LAprendizaje1..LAprendizaje4": logro de aprendizaje de cada unidad, 1-2 líneas.
- NO inventes horas, fechas, ni números — no se te piden aquí.
`.trim();

    const body = {
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n${promptUsuario}` }] }
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 3000,
        responseMimeType: 'application/json',
        responseSchema: this.esquemaJson
      }
    };

    for (let intento = 1; intento <= intentos; intento++) {
      const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if ((response.status === 429 || response.status === 503) && intento < intentos) {
        const espera = 1500 * intento; // 1.5s, 3s, 4.5s...
        console.warn(`Gemini saturado (${response.status}), reintentando en ${espera}ms... (intento ${intento}/${intentos})`);
        await new Promise(resolve => setTimeout(resolve, espera));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error de la IA (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const contenidoTexto = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!contenidoTexto) {
        throw new Error('La IA no devolvió contenido.');
      }

      try {
        return JSON.parse(contenidoTexto);
      } catch {
        throw new Error('La IA devolvió un formato inválido, intenta de nuevo.');
      }
    }

    throw new Error('El servicio de IA está saturado. Intenta nuevamente en unos minutos.');
  }
}
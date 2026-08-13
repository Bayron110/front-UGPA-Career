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

  // ⚠️ Mover a variables de entorno / backend antes de producción.
  private readonly apiKey = 'csk-frk8k2wwvkd6xy2vtj2ctntkfjepxdnrdkj2yxy5t46eejmc';
  private readonly endpoint = 'https://api.cerebras.ai/v1/chat/completions';
  private readonly modelo = 'gpt-oss-120b';

  private readonly esquemaJson = {
    type: 'object',
    properties: {
      Descripcion: { type: 'string' },
      Objectivos: { type: 'string' },
      dirigido: { type: 'string' },
      Contenido1: { type: 'string' },
      Contenido2: { type: 'string' },
      Contenido3: { type: 'string' },
      Contenido4: { type: 'string' },
      Unidad1: { type: 'string' },
      Unidad2: { type: 'string' },
      Unidad3: { type: 'string' },
      Unidad4: { type: 'string' },
      LAprendizaje1: { type: 'string' },
      LAprendizaje2: { type: 'string' },
      LAprendizaje3: { type: 'string' },
      LAprendizaje4: { type: 'string' }
    },
    required: [
      'Descripcion', 'Objectivos', 'dirigido',
      'Contenido1', 'Contenido2', 'Contenido3', 'Contenido4',
      'Unidad1', 'Unidad2', 'Unidad3', 'Unidad4',
      'LAprendizaje1', 'LAprendizaje2', 'LAprendizaje3', 'LAprendizaje4'
    ],
    additionalProperties: false
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
      model: this.modelo,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptUsuario }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'contenido_informe',
          strict: true,
          schema: this.esquemaJson
        }
      },
      temperature: 0.5,
      max_completion_tokens: 3000
    };

    for (let intento = 1; intento <= intentos; intento++) {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (response.status === 429 && intento < intentos) {
        const espera = 1500 * intento; // 1.5s, 3s, 4.5s...
        console.warn(`Cerebras saturado (429), reintentando en ${espera}ms... (intento ${intento}/${intentos})`);
        await new Promise(resolve => setTimeout(resolve, espera));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error de la IA (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const contenidoTexto = data.choices?.[0]?.message?.content;

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
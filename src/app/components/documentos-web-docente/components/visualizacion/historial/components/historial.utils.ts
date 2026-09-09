
export function formatoFecha(fechaISO: string): string {
  if (!fechaISO) return '';
  const p = String(fechaISO).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : fechaISO;
}

export function formatearFechaLarga(fechaISO: string): string {
  if (!fechaISO) return '';
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const partes = String(fechaISO).split('-');
  if (partes.length !== 3) return '';
  const anio = partes[0];
  const mes = meses[Number(partes[1]) - 1] || '';
  const dia = Number(partes[2]);
  if (!anio || !mes || !dia) return '';
  return `${dia} de ${mes} de ${anio}`;
}

export function construirRangoFechaTexto(fechaInicio: string, fechaFin: string): string {
  const inicio = formatearFechaLarga(fechaInicio);
  const fin = formatearFechaLarga(fechaFin);
  if (inicio && fin) return `desde el ${inicio} hasta el ${fin}`;
  if (inicio) return `desde el ${inicio}`;
  if (fin) return `hasta el ${fin}`;
  return '';
}

export function limpiarNombreArchivo(texto: string): string {
  return String(texto || '')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizarTexto(texto: string): string {
  return String(texto || '').trim().toLowerCase();
}

export function esperar(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


export function imagenPlaceholder1x1(): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
}
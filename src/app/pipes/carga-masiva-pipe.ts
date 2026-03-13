import { Pipe, PipeTransform } from '@angular/core';
import { CargaMasivaItem } from '../components/eventos/eventos';


@Pipe({ name: 'cargaValidos', standalone: true })
export class CargaValidosPipe implements PipeTransform {
  transform(items: CargaMasivaItem[]): number {
    return items.filter(i => i.valido).length;
  }
}

@Pipe({ name: 'cargaInvalidos', standalone: true })
export class CargaInvalidosPipe implements PipeTransform {
  transform(items: CargaMasivaItem[]): number {
    return items.filter(i => !i.valido).length;
  }
}
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'ejePipe',
  standalone: true
})
export class EjePipePipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '';

    const items = value
      .split('-')
      .map(item => item.trim())
      .filter(item => item.length > 0);

    if (items.length === 0) return value;

    return `<ul class="eje-list">
              ${items.map(item => `<li>${item}</li>`).join('')}
            </ul>`;
  }
}

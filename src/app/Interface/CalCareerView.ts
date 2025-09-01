import { Career } from './Career';
import { TypeCareer } from './TypeCareer';

export interface CalCareerView {
    id: number;
    career: Career;
    typeCareer: TypeCareer;
    fechaActual: Date;
    fechaFin: Date;
}

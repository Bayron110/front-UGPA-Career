import { Career } from './Career';
import { TypeCareer } from './TypeCareer';

export interface CalCareerView {
    id: string;
    career: Career;
    typeCareer: TypeCareer;
    fechaActual: Date;
    fechaFin: Date;
}

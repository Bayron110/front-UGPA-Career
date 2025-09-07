import { Career } from './Career';
import { TypeCareer } from './TypeCareer';

export interface CalCareer {
    id?: string;

    careerId?: string;
    typeCareerId?: string;

    career?: Career;
    typeCareer?: TypeCareer;

    fechaActual?: string;
    fechaFin?: string;
}
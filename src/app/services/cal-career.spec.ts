import { TestBed } from '@angular/core/testing';

import { CalCareer } from './cal-career';

describe('CalCareer', () => {
  let service: CalCareer;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CalCareer);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

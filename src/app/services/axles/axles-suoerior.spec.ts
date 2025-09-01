import { TestBed } from '@angular/core/testing';

import { AxlesSuoerior } from './axles-suoerior';

describe('AxlesSuoerior', () => {
  let service: AxlesSuoerior;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AxlesSuoerior);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

import { TestBed } from '@angular/core/testing';

import { TypeCareerServices } from './type-career-services';

describe('TypeCareerServices', () => {
  let service: TypeCareerServices;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TypeCareerServices);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

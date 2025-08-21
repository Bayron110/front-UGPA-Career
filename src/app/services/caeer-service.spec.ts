import { TestBed } from '@angular/core/testing';

import { CaeerService } from './caeer-service';

describe('CaeerService', () => {
  let service: CaeerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CaeerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

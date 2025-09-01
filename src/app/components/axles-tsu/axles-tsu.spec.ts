import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AxlesTsu } from './axles-tsu';

describe('AxlesTsu', () => {
  let component: AxlesTsu;
  let fixture: ComponentFixture<AxlesTsu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AxlesTsu]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AxlesTsu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

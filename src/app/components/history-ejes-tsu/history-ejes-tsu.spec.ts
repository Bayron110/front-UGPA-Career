import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoryEjesTsu } from './history-ejes-tsu';

describe('HistoryEjesTsu', () => {
  let component: HistoryEjesTsu;
  let fixture: ComponentFixture<HistoryEjesTsu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryEjesTsu]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoryEjesTsu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

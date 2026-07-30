import { describe, expect, it } from 'vitest';
import {
  addMonths,
  dateKey,
  dayOfMonth,
  daysInMonth,
  hourOfDay,
  monthBounds,
  monthKey,
  weekdayOf,
  zonedDate,
} from './timezone';

describe('monthKey', () => {
  it('mantem no mes certo uma compra da noite da virada', () => {
    // 31/07/2026 22h30 em Brasilia = 01/08 01h30 em UTC
    const compra = new Date('2026-08-01T01:30:00Z');
    expect(monthKey(compra)).toBe('2026-07');
    expect(dayOfMonth(compra)).toBe(31);
    expect(dateKey(compra)).toBe('2026-07-31');
  });

  it('vira o mes na hora certa de Brasilia', () => {
    // 01/08/2026 00h00 em Brasilia = 01/08 03h00 em UTC
    expect(monthKey(new Date('2026-08-01T03:00:00Z'))).toBe('2026-08');
    expect(monthKey(new Date('2026-08-01T02:59:00Z'))).toBe('2026-07');
  });
});

describe('hourOfDay e weekdayOf', () => {
  it('classifica como noturna a compra que em UTC ja e do dia seguinte', () => {
    // sabado 25/07/2026 23h em Brasilia = domingo 26/07 02h em UTC
    const d = new Date('2026-07-26T02:00:00Z');
    expect(hourOfDay(d)).toBe(23);
    expect(weekdayOf(d)).toBe(6); // sabado
  });
});

describe('addMonths', () => {
  it('anda para frente e para tras cruzando o ano', () => {
    expect(addMonths('2026-07', 1)).toBe('2026-08');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-07', -12)).toBe('2025-07');
    expect(addMonths('2026-03', -6)).toBe('2025-09');
  });
});

describe('daysInMonth e monthBounds', () => {
  it('conta os dias de meses curtos e bissextos', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-04')).toBe(30);
    expect(daysInMonth('2026-07')).toBe(31);
  });

  it('delimita o mes pela meia-noite de Brasilia', () => {
    const { from, to } = monthBounds('2026-07');
    expect(from.toISOString()).toBe('2026-07-01T03:00:00.000Z');
    expect(monthKey(from)).toBe('2026-07');
    expect(monthKey(to)).toBe('2026-07');
    expect(dayOfMonth(to)).toBe(31);
    // um segundo depois do fim ja e agosto
    expect(monthKey(new Date(to.getTime() + 1000))).toBe('2026-08');
  });
});

describe('zonedDate', () => {
  it('converte hora de parede de Brasilia para o instante correto', () => {
    expect(zonedDate(2026, 7, 15, 12, 0, 0).toISOString()).toBe(
      '2026-07-15T15:00:00.000Z',
    );
  });
});

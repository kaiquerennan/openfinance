/**
 * Datas ancoradas no fuso de Brasilia.
 *
 * O servidor roda em UTC, entao usar getMonth()/getDate() direto jogava as
 * compras do fim da noite para o dia (e as vezes o mes) seguinte: uma compra
 * em 31/07 as 22h em Brasilia e 01/08 01h em UTC. Todo fechamento de mes
 * vazava lancamentos para o mes errado.
 *
 * Tudo que decide "em que mes/dia/hora isso aconteceu" passa por aqui.
 */

export const TIMEZONE = 'America/Sao_Paulo';

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  weekday: 'short',
});

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
  weekday: number; // 0 = domingo
}

/** Quebra um instante nos componentes de calendario vistos em Brasilia. */
export function zoned(date: Date): ZonedParts {
  const parts = FORMATTER.formatToParts(date);
  const at = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '0';
  return {
    year: Number(at('year')),
    month: Number(at('month')),
    day: Number(at('day')),
    // hour12:false pode devolver "24" a meia-noite em alguns runtimes
    hour: Number(at('hour')) % 24,
    minute: Number(at('minute')),
    second: Number(at('second')),
    weekday: WEEKDAY_INDEX[at('weekday')] ?? 0,
  };
}

/**
 * Instante correspondente a uma hora de parede em Brasilia.
 * Monta o palpite como se fosse UTC, mede o desvio real naquele momento e
 * corrige — assim funciona mesmo em datas com horario de verao no historico.
 */
export function zonedDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const p = zoned(new Date(guess));
  const roundTrip = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return new Date(guess - (roundTrip - guess));
}

/** 'YYYY-MM' do instante, no calendario de Brasilia. */
export function monthKey(date: Date): string {
  const { year, month } = zoned(date);
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Dia do mes (1-31) em Brasilia. */
export function dayOfMonth(date: Date): number {
  return zoned(date).day;
}

/** Hora do dia (0-23) em Brasilia. */
export function hourOfDay(date: Date): number {
  return zoned(date).hour;
}

/** Dia da semana (0 = domingo) em Brasilia. */
export function weekdayOf(date: Date): number {
  return zoned(date).weekday;
}

/** Soma meses a 'YYYY-MM' por aritmetica de calendario, sem passar por Date. */
export function addMonths(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const total = year * 12 + (m - 1) + delta;
  const y = Math.floor(total / 12);
  const mm = total - y * 12 + 1;
  return `${y}-${String(mm).padStart(2, '0')}`;
}

/** Quantidade de dias do mes 'YYYY-MM'. */
export function daysInMonth(month: string): number {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

/** Primeiro e ultimo instante do mes 'YYYY-MM', em Brasilia. */
export function monthBounds(month: string): { from: Date; to: Date } {
  const [year, m] = month.split('-').map(Number);
  return {
    from: zonedDate(year, m, 1, 0, 0, 0),
    to: zonedDate(year, m, daysInMonth(month), 23, 59, 59),
  };
}

/** 'YYYY-MM-DD' do instante, no calendario de Brasilia. */
export function dateKey(date: Date): string {
  const { year, month, day } = zoned(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

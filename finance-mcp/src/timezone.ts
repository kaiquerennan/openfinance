/**
 * Limites de mes ancorados no fuso de Brasilia.
 *
 * Versao minima do `finance-app/src/analytics/timezone.ts` — repetida aqui
 * porque os dois pacotes sao independentes (cada um com seu package.json).
 * Sem isto, "julho" viraria 01/07 00h UTC e as compras do fim da noite do dia
 * 30/06 entrariam no mes errado, divergindo do relatorio do proprio app.
 */

export const TIMEZONE = 'America/Sao_Paulo';

const FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function parts(date: Date) {
  const found = FORMATTER.formatToParts(date);
  const at = (type: Intl.DateTimeFormatPartTypes) =>
    Number(found.find((p) => p.type === type)?.value ?? '0');
  return {
    year: at('year'),
    month: at('month'),
    day: at('day'),
    hour: at('hour') % 24, // alguns runtimes devolvem 24 a meia-noite
    minute: at('minute'),
    second: at('second'),
  };
}

/** Instante correspondente a uma hora de parede em Brasilia. */
function zonedDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const p = parts(new Date(guess));
  const roundTrip = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return new Date(guess - (roundTrip - guess));
}

/** Primeiro e ultimo instante do mes 'YYYY-MM', em Brasilia (ISO). */
export function monthBounds(month: string): { from: string; to: string } {
  const [year, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return {
    from: zonedDate(year, m, 1, 0, 0, 0).toISOString(),
    to: zonedDate(year, m, lastDay, 23, 59, 59).toISOString(),
  };
}

/** 'YYYY-MM-DD HH:mm' do instante, no calendario de Brasilia. */
export function localDateTime(value: string | Date): string {
  const p = parts(new Date(value));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

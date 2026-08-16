/**
 * Compras parceladas: o que ja foi gasto mas ainda vai ser cobrado.
 *
 * O extrato so mostra a parcela do mes. Quem parcelou uma compra em 10x ve
 * um gasto pequeno hoje e nao ve as nove cobrancas que ja estao contratadas —
 * e e exatamente esse valor invisivel que decide se cabe parcelar mais alguma
 * coisa. Aqui reconstruimos o plano inteiro a partir das parcelas ja cobradas.
 */

import { addMonths, monthKey } from '../analytics/timezone';

/** Acima disto quase certamente nao e parcelamento (e data, codigo, etc). */
const MAX_INSTALLMENTS = 48;

/**
 * Quantos meses sem nenhuma cobranca nova antes de considerar o plano parado.
 *
 * Uma parcela cai todo mes; se a ultima vista e antiga, ou a compra acabou de
 * outro jeito (quitada, estornada) ou o cartao parou de sincronizar. Nos dois
 * casos, projetar cobranca futura a partir dela seria inventar divida.
 */
const STALE_AFTER_MONTHS = 2;

export interface ParsedInstallment {
  number: number;
  total: number;
  /** Descricao sem o marcador de parcela ("MERCADO 03/10" -> "MERCADO"). */
  description: string;
}

/**
 * Formatos de parcela que aparecem na descricao: "PARC 3/10", "3/10",
 * "3 DE 10". Muitos emissores nao preenchem o `creditCardMetadata` da Pluggy
 * e so escrevem isto no texto — sem ler a descricao, metade dos
 * parcelamentos ficaria de fora.
 */
const PATTERNS: RegExp[] = [
  /\bparc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|\s+de\s+)\s*(\d{1,2})/i,
  /(\d{1,2})\s*\/\s*(\d{1,2})\s*$/,
  /(\d{1,2})\s+de\s+(\d{1,2})\s*$/i,
];

function plausible(number: number, total: number): boolean {
  return total >= 2 && total <= MAX_INSTALLMENTS && number >= 1 && number <= total;
}

/** Le o marcador de parcela na descricao, ou null se nao houver. */
export function parseInstallment(description: string): ParsedInstallment | null {
  const text = description.trim();
  for (const pattern of PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;

    const number = Number(match[1]);
    const total = Number(match[2]);
    if (!plausible(number, total)) continue;

    const clean = (text.slice(0, match.index) + text.slice(match.index + match[0].length))
      .replace(/\s{2,}/g, ' ')
      .replace(/[\s\-–—.]+$/, '')
      .trim();
    return { number, total, description: clean || text };
  }
  return null;
}

/** Uma parcela ja cobrada, vinda do extrato. */
export interface InstallmentCharge {
  id: string;
  accountId: string;
  accountName: string;
  date: Date;
  description: string;
  /** Valor da parcela, sempre positivo. */
  amount: number;
  number: number;
  total: number;
  /** Valor total da compra, quando a instituicao informa. */
  totalAmount: number | null;
}

/** Uma compra parcelada reconstruida a partir das parcelas vistas. */
export interface InstallmentPlan {
  key: string;
  description: string;
  accountId: string;
  accountName: string;
  installmentAmount: number;
  totalInstallments: number;
  /** Maior parcela ja vista no extrato. */
  paidInstallments: number;
  remaining: number;
  /** Quanto ainda vai ser cobrado (parcelas que faltam). */
  remainingAmount: number;
  totalAmount: number;
  /** Mes da ultima parcela cobrada (YYYY-MM). */
  lastMonth: string;
  /** Mes da proxima cobranca, ou null se acabou. */
  nextMonth: string | null;
  /** Mes da ultima parcela do plano. */
  endsOn: string;
}

/** Chave que junta as parcelas da mesma compra. */
function planKey(charge: InstallmentCharge): string {
  const desc = charge.description.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return [charge.accountId, desc, charge.total, Math.round(charge.amount)].join('|');
}

/**
 * Agrupa as parcelas por compra e projeta o que falta.
 *
 * `currentMonth` serve de referencia para descartar plano parado: sem isso,
 * uma compra antiga mal interpretada viraria divida futura no relatorio.
 */
export function buildPlans(
  charges: InstallmentCharge[],
  currentMonth: string,
): InstallmentPlan[] {
  const groups = new Map<string, InstallmentCharge[]>();
  for (const charge of charges) {
    const key = planKey(charge);
    const list = groups.get(key);
    if (list) list.push(charge);
    else groups.set(key, [charge]);
  }

  const staleBefore = addMonths(currentMonth, -STALE_AFTER_MONTHS);
  const plans: InstallmentPlan[] = [];

  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => a.number - b.number);
    const last = sorted[sorted.length - 1];
    const remaining = last.total - last.number;
    if (remaining <= 0) continue;

    const lastMonth = monthKey(last.date);
    if (lastMonth < staleBefore) continue;

    const installmentAmount = last.amount;
    const totalAmount = last.totalAmount ?? installmentAmount * last.total;

    plans.push({
      key,
      description: last.description,
      accountId: last.accountId,
      accountName: last.accountName,
      installmentAmount,
      totalInstallments: last.total,
      paidInstallments: last.number,
      remaining,
      remainingAmount: installmentAmount * remaining,
      totalAmount,
      lastMonth,
      nextMonth: addMonths(lastMonth, 1),
      endsOn: addMonths(lastMonth, remaining),
    });
  }

  return plans.sort((a, b) => b.remainingAmount - a.remainingAmount);
}

export interface MonthCommitment {
  month: string;
  amount: number;
  count: number;
}

/**
 * Quanto de parcela cai em cada um dos proximos meses.
 *
 * Meses ja passados ficam de fora: a pergunta e "quanto do meu futuro ja esta
 * comprometido", nao o historico — esse o extrato ja conta.
 */
export function monthlySchedule(
  plans: InstallmentPlan[],
  from: string,
  months: number,
): MonthCommitment[] {
  const byMonth = new Map<string, MonthCommitment>();
  for (let i = 0; i < months; i++) {
    const month = addMonths(from, i);
    byMonth.set(month, { month, amount: 0, count: 0 });
  }

  for (const plan of plans) {
    for (let i = 1; i <= plan.remaining; i++) {
      const month = addMonths(plan.lastMonth, i);
      const slot = byMonth.get(month);
      if (!slot) continue;
      slot.amount += plan.installmentAmount;
      slot.count += 1;
    }
  }

  return [...byMonth.values()];
}

/**
 * Total que ainda vai ser cobrado a partir de `from` (inclusive).
 *
 * Nao e a soma simples do que falta em cada plano: uma parcela cuja cobranca
 * era do mes passado e ainda nao apareceu no extrato ja saiu do futuro, e
 * conta-la de novo inflaria o compromisso.
 */
export function committedFrom(plans: InstallmentPlan[], from: string): number {
  let total = 0;
  for (const plan of plans) {
    for (let i = 1; i <= plan.remaining; i++) {
      if (addMonths(plan.lastMonth, i) >= from) total += plan.installmentAmount;
    }
  }
  return total;
}

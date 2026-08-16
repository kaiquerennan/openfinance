/**
 * Ciclos de fatura do cartao.
 *
 * O saldo da conta responde "quanto devo agora" e nada mais. Quem quer saber
 * por que a fatura veio maior, quanto foi de juros, ou quanto ja esta correndo
 * para o mes que vem, precisa do ciclo — e o ciclo so existe quando as faturas
 * fechadas ficam lado a lado.
 */

/** Fatura como esta no banco. */
export interface StoredBill {
  id: string;
  dueDate: Date;
  closingDate: Date | null;
  totalAmount: number;
  minimumPayment: number | null;
  financeCharges: number;
  /** Pagamentos lancados no ciclo — quitam a fatura anterior. */
  paymentsAmount: number;
}

/**
 * Situacao de pagamento de uma fatura.
 *
 * 'parcial' e o sinal de rotativo: pagou uma parte e o resto virou divida com
 * juros, que e a forma mais cara de credito que existe no cartao.
 */
export type BillStatus = 'a vencer' | 'paga' | 'parcial' | 'em aberto';

export interface BillView {
  id: string;
  dueDate: string;
  closingDate: string | null;
  total: number;
  minimumPayment: number | null;
  /** Juros, IOF, multa e afins cobrados nesta fatura. */
  charges: number;
  status: BillStatus;
  /** Variacao % sobre a fatura anterior (null na mais antiga). */
  changePct: number | null;
}

/** O que ja esta correndo para a proxima fatura, ainda sem fechar. */
export interface OpenBill {
  /** Primeiro dia do ciclo aberto (dia seguinte ao ultimo fechamento). */
  since: string;
  total: number;
  count: number;
  /** Fechamento e vencimento estimados, repetindo o intervalo dos ciclos. */
  closesOn: string | null;
  dueDate: string | null;
}

/** Uma compra do cartao, para somar o ciclo aberto. */
export interface CardPurchase {
  date: Date;
  /** Valor positivo da compra. */
  amount: number;
}

/** Diferenca considerada quitacao total (centavos de arredondamento). */
const PAYMENT_TOLERANCE = 1;

const iso = (date: Date) => date.toISOString().slice(0, 10);

function pct(value: number, base: number): number | null {
  if (base <= 0) return null;
  return Math.round(((value - base) / base) * 1000) / 10;
}

/**
 * Descobre se a fatura foi paga pelo que foi pago depois que ela fechou.
 *
 * Para as faturas antigas isso vem do ciclo seguinte: a Pluggy registra o
 * pagamento na fatura em que ele apareceu, nao na que ele quitou. A mais
 * recente ainda nao tem ciclo seguinte, entao quem responde e o extrato do
 * proprio cartao — sem isso, a fatura que a pessoa acabou de pagar apareceria
 * como em aberto.
 */
function statusOf(
  bill: StoredBill,
  next: StoredBill | undefined,
  today: Date,
  paidAfterClose: number,
): BillStatus {
  const paid = next ? next.paymentsAmount : paidAfterClose;
  if (paid >= bill.totalAmount - PAYMENT_TOLERANCE) return 'paga';
  if (paid > PAYMENT_TOLERANCE) return 'parcial';
  return bill.dueDate >= today ? 'a vencer' : 'em aberto';
}

/**
 * Faturas da mais recente para a mais antiga, com variacao e situacao.
 *
 * `paidAfterClose` e quanto o extrato registra de pagamento depois do ultimo
 * fechamento — usado so pela fatura mais recente.
 */
export function summarizeBills(
  bills: StoredBill[],
  today: Date,
  paidAfterClose = 0,
): BillView[] {
  const desc = [...bills].sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());

  return desc.map((bill, i) => ({
    id: bill.id,
    dueDate: iso(bill.dueDate),
    closingDate: bill.closingDate ? iso(bill.closingDate) : null,
    total: bill.totalAmount,
    minimumPayment: bill.minimumPayment,
    charges: bill.financeCharges,
    status: statusOf(bill, desc[i - 1], today, paidAfterClose),
    changePct: desc[i + 1] ? pct(bill.totalAmount, desc[i + 1].totalAmount) : null,
  }));
}

/**
 * Soma o que foi comprado depois do ultimo fechamento.
 *
 * A Pluggy so lista a fatura depois que ela fecha; ate la, a unica forma de
 * saber quanto ja esta comprometido no proximo mes e somar as compras do
 * ciclo em aberto.
 */
export function openBillOf(
  bills: StoredBill[],
  purchases: CardPurchase[],
): OpenBill | null {
  const desc = [...bills].sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
  const last = desc[0];
  if (!last) return null;

  const lastClose = last.closingDate ?? last.dueDate;
  const doCiclo = purchases.filter((p) => p.date > lastClose);

  // Repete o intervalo entre os dois ultimos ciclos para estimar o proximo.
  const previous = desc[1];
  const stepDays =
    previous && previous.closingDate && last.closingDate
      ? Math.round(
          (last.closingDate.getTime() - previous.closingDate.getTime()) / 86_400_000,
        )
      : 30;
  const shift = (date: Date) => new Date(date.getTime() + stepDays * 86_400_000);

  return {
    since: iso(new Date(lastClose.getTime() + 86_400_000)),
    total: Math.round(doCiclo.reduce((sum, p) => sum + p.amount, 0) * 100) / 100,
    count: doCiclo.length,
    closesOn: last.closingDate ? iso(shift(last.closingDate)) : null,
    dueDate: iso(shift(last.dueDate)),
  };
}

/** Media das faturas fechadas mais recentes (base de comparacao). */
export function averageBill(bills: BillView[], take = 3): number {
  const recent = bills.slice(0, take);
  if (!recent.length) return 0;
  const total = recent.reduce((sum, b) => sum + b.total, 0);
  return Math.round((total / recent.length) * 100) / 100;
}

import {
  AnalyticsData,
  CategoryStat,
  HealthScore,
  MonthPoint,
  Subscription,
  TrendPoint,
  Tx,
} from './analytics.types';
import { consumptionKindOf, WASTE_CATEGORIES } from './category-groups';
import {
  addMonths,
  dateKey,
  dayOfMonth,
  daysInMonth,
  hourOfDay,
  monthBounds,
  monthKey,
  weekdayOf,
} from './timezone';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const pct = (part: number, whole: number) =>
  whole > 0 ? round2((part / whole) * 100) : 0;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export { monthKey } from './timezone';

const inMonth = (t: Tx, month: string) => monthKey(t.date) === month;
const consumptionOut = (t: Tx) => t.group === 'consumption' && t.amount < 0;
const incomeIn = (t: Tx) => t.group === 'income' && t.amount > 0;

function normalizeDesc(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/\d+/g, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrai a contraparte de "Transferencia enviada|Empresa X" -> "empresa x". */
function counterpartyKey(desc: string): string {
  const idx = desc.indexOf('|');
  return normalizeDesc(idx >= 0 ? desc.slice(idx + 1) : desc);
}

function gamblingCounterpartiesOf(all: Tx[]): Set<string> {
  return new Set(
    all
      .filter((t) => t.category.toLowerCase() === 'gambling')
      .map((t) => counterpartyKey(t.description)),
  );
}

/** Resultado liquido de apostas no periodo: recuperado - apostado (positivo = ganhou, negativo = perdeu). Null se nao houve apostas. */
function computeGamblingNet(monthTx: Tx[], gamblingCounterparties: Set<string>): number | null {
  if (!gamblingCounterparties.size) return null;
  const bet = sum(
    monthTx
      .filter((t) => t.category.toLowerCase() === 'gambling' && t.amount < 0)
      .map((t) => Math.abs(t.amount)),
  );
  if (bet === 0) return null;
  const recovered = sum(
    monthTx
      .filter((t) => t.amount > 0 && t.category.toLowerCase() !== 'gambling')
      .filter((t) => gamblingCounterparties.has(counterpartyKey(t.description)))
      .map((t) => t.amount),
  );
  return round2(recovered - bet);
}

/**
 * A Pluggy categoriza a aposta (saida) como "Gambling", mas o saque/retorno
 * da mesma casa costuma voltar como uma transferencia generica -- sem tratar
 * isso, a analise conta 100% do valor apostado como perda e ignora o que
 * voltou. Aqui detectamos entradas vindas da mesma contraparte de uma aposta
 * e abatemos esse valor direto das transacoes de aposta do mes, na fonte --
 * assim categorias, tendencias e indice de saude ja saem com o valor liquido
 * sem precisar mexer em mais nada.
 */
function netGamblingCashouts(all: Tx[]): Tx[] {
  const gamblingCounterparties = gamblingCounterpartiesOf(all);
  if (!gamblingCounterparties.size) return all;

  const adjusted = all.map((t) => ({ ...t }));
  const byMonth = new Map<string, Tx[]>();
  for (const t of adjusted) {
    const m = monthKey(t.date);
    const arr = byMonth.get(m) ?? [];
    arr.push(t);
    byMonth.set(m, arr);
  }

  for (const monthTxs of byMonth.values()) {
    const bets = monthTxs.filter((t) => t.category.toLowerCase() === 'gambling' && t.amount < 0);
    if (!bets.length) continue;
    const recovered = round2(
      sum(
        monthTxs
          .filter((t) => t.amount > 0 && t.category.toLowerCase() !== 'gambling')
          .filter((t) => gamblingCounterparties.has(counterpartyKey(t.description)))
          .map((t) => t.amount),
      ),
    );
    if (recovered <= 0) continue;

    const totalBet = sum(bets.map((t) => Math.abs(t.amount)));
    let remaining = Math.min(recovered, totalBet);
    for (const bet of bets.sort((a, b) => a.amount - b.amount)) {
      if (remaining <= 0) break;
      const cut = Math.min(Math.abs(bet.amount), remaining);
      bet.amount = round2(bet.amount + cut); // amount e negativo; +cut aproxima de 0
      remaining = round2(remaining - cut);
    }
  }

  return adjusted;
}

// ---------------------------------------------------------------------------
// Calculo principal
// ---------------------------------------------------------------------------

/**
 * Serie mensal agregada (renda, consumo e categorias por mes).
 *
 * Existe para que o cliente nunca precise reclassificar transacao por conta
 * propria: a mesma regra de grupo economico e o mesmo abatimento de apostas
 * do relatorio valem aqui. Antes o frontend refazia essa conta e chegava a
 * numeros diferentes dos do relatorio para o mesmo mes.
 */
export function computeMonthlySeries(rawAll: Tx[], months: string[]): MonthPoint[] {
  const all = netGamblingCashouts(rawAll);
  return months.map((month) => {
    const inM = all.filter((t) => inMonth(t, month));
    const income = round2(sum(inM.filter(incomeIn).map((t) => t.amount)));
    const byCat = new Map<string, number>();
    let consumption = 0;
    for (const t of inM.filter(consumptionOut)) {
      const value = Math.abs(t.amount);
      consumption += value;
      byCat.set(t.category, (byCat.get(t.category) ?? 0) + value);
    }
    return {
      month,
      income,
      consumption: round2(consumption),
      savings: round2(income - consumption),
      categories: [...byCat.entries()]
        .map(([category, total]) => ({ category, total: round2(total) }))
        .sort((a, b) => b.total - a.total),
    };
  });
}

/**
 * Separa o consumo do mes entre o que e custo de viver e o que e escolha.
 * Os percentuais so fazem sentido com uma renda confiavel — sem isso, ficam
 * nulos e a tela mostra apenas os valores absolutos.
 */
function computeLifestyle(
  thisM: Tx[],
  income: number,
  incomeReliable: boolean,
): AnalyticsData['lifestyle'] {
  let essential = 0;
  let lifestyle = 0;
  const byCat = new Map<string, number>();

  for (const t of thisM.filter(consumptionOut)) {
    const value = Math.abs(t.amount);
    if (consumptionKindOf(t.category) === 'essencial') {
      essential += value;
    } else {
      lifestyle += value;
      byCat.set(t.category, (byCat.get(t.category) ?? 0) + value);
    }
  }

  const usable = incomeReliable && income > 0;
  return {
    essential: round2(essential),
    lifestyle: round2(lifestyle),
    essentialPct: usable ? pct(essential, income) : null,
    lifestylePct: usable ? pct(lifestyle, income) : null,
    savedPct: usable ? pct(income - essential - lifestyle, income) : null,
    topLifestyle: [...byCat.entries()]
      .map(([category, total]) => ({ category, total: round2(total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
  };
}

/** Meses de custo de vida considerados uma reserva de emergencia completa. */
const RESERVE_TARGET_MONTHS = 6;

/**
 * Custo de vida mensal tipico: mediana do consumo dos meses fechados
 * recentes. Mediana (e nao media) para um mes atipico — uma viagem, uma
 * compra grande — nao inflar a estimativa. O mes-alvo fica de fora quando
 * ainda esta em curso, senao um mes pela metade faria a reserva parecer
 * maior do que e.
 */
function typicalMonthlyCost(all: Tx[], targetMonth: string): number {
  const isCurrent = monthKey(new Date()) === targetMonth;
  const values: number[] = [];
  for (let i = isCurrent ? 1 : 0; i <= 6; i++) {
    const month = addMonths(targetMonth, -i);
    const spent = sum(
      all
        .filter((t) => consumptionOut(t) && monthKey(t.date) === month)
        .map((t) => Math.abs(t.amount)),
    );
    if (spent > 0) values.push(spent);
  }
  if (!values.length) return 0;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return round2(
    values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2,
  );
}

function computeReserve(
  all: Tx[],
  targetMonth: string,
  liquidAssets: number,
): AnalyticsData['reserve'] {
  const monthlyCost = typicalMonthlyCost(all, targetMonth);
  const assets = round2(Math.max(liquidAssets, 0));

  if (monthlyCost <= 0) {
    return {
      liquidAssets: assets,
      monthlyCost: 0,
      months: null,
      targetMonths: RESERVE_TARGET_MONTHS,
      missing: 0,
      status: 'indefinido',
    };
  }

  const months = round2(assets / monthlyCost);
  const status: AnalyticsData['reserve']['status'] =
    months >= RESERVE_TARGET_MONTHS
      ? 'completa'
      : months >= 3
        ? 'boa'
        : months >= 1
          ? 'iniciando'
          : 'sem-reserva';

  return {
    liquidAssets: assets,
    monthlyCost,
    months,
    targetMonths: RESERVE_TARGET_MONTHS,
    missing: round2(Math.max(monthlyCost * RESERVE_TARGET_MONTHS - assets, 0)),
    status,
  };
}

export function computeAnalytics(
  rawAll: Tx[],
  targetMonth: string,
  liquidAssets = 0,
): AnalyticsData {
  const all = netGamblingCashouts(rawAll);
  const gamblingNet = computeGamblingNet(
    rawAll.filter((t) => inMonth(t, targetMonth)),
    gamblingCounterpartiesOf(rawAll),
  );
  const prevMonth = addMonths(targetMonth, -1);
  const bounds = monthBounds(targetMonth);
  const thisM = all.filter((t) => inMonth(t, targetMonth));
  const prevM = all.filter((t) => inMonth(t, prevMonth));

  // --- Resumo geral ---
  const income = round2(sum(thisM.filter(incomeIn).map((t) => t.amount)));
  const consumption = round2(
    sum(thisM.filter(consumptionOut).map((t) => Math.abs(t.amount))),
  );
  const feesOut = round2(
    sum(thisM.filter((t) => t.group === 'fee' && t.amount < 0).map((t) => Math.abs(t.amount))),
  );
  const debtOut = round2(
    sum(thisM.filter((t) => t.group === 'debt' && t.amount < 0).map((t) => Math.abs(t.amount))),
  );
  const savings = round2(income - consumption - feesOut - debtOut);
  const commitmentPct = pct(consumption + feesOut + debtOut, income);

  const prevConsumption = round2(
    sum(prevM.filter(consumptionOut).map((t) => Math.abs(t.amount))),
  );
  const changeVsPrevPct =
    prevConsumption > 0 ? pct(consumption - prevConsumption, prevConsumption) : null;

  const classification: AnalyticsData['summary']['classification'] =
    commitmentPct > 100
      ? 'Crítico'
      : commitmentPct > 85
        ? 'Atenção'
        : commitmentPct > 65
          ? 'Estável'
          : 'Saudável';

  // --- Categorias ---
  const categories = computeCategories(thisM, prevM, all, targetMonth, consumption);

  // --- Mapa de destino do dinheiro ---
  const moneyDestination = computeDestination(thisM, income, consumption);

  // --- Comportamento ---
  const behavior = computeBehavior(thisM, prevM, bounds);

  // --- Tendencias ---
  const trends = computeTrends(all, targetMonth);

  // --- Assinaturas / recorrencias ---
  const subscriptions = computeSubscriptions(all, targetMonth);

  // --- Desperdicios ---
  const waste = computeWaste(thisM, feesOut);

  // --- Movimentacoes (reportadas, fora do consumo) ---
  const movements = {
    transfers: round2(
      sum(thisM.filter((t) => t.group === 'transfer' && t.amount < 0).map((t) => Math.abs(t.amount))),
    ),
    investmentsNet: round2(
      -sum(thisM.filter((t) => t.group === 'investment').map((t) => t.amount)),
    ), // saidas - entradas (positivo = aplicou liquido)
    debt: debtOut,
    fees: feesOut,
    gamblingNet,
  };

  // --- Gasto acumulado dia a dia (ritmo do mes) ---
  const dailyConsumption = computeDailyConsumption(thisM, targetMonth);

  // --- Indice de saude ---
  const health = computeHealth(trends, all, targetMonth, income, debtOut, feesOut);

  // --- Qualidade dos dados ---
  const uncertainShare = pct(
    thisM.filter((t) => t.uncertain).length,
    Math.max(thisM.length, 1),
  );
  // Salario precisa ser material: recorrente E >= consumo mensal tipico.
  const medMonthlyConsumption = medianMonthlyConsumption(all);
  const salaryDetected = detectSalary(all, medMonthlyConsumption);

  // Confiabilidade da renda: sinal robusto baseado na COMPOSICAO das entradas.
  // Numa conta com renda real, o grupo "income" e fatia dominante das entradas.
  // Se as entradas sao dominadas por transferencias/emprestimos/investimentos,
  // a "renda" mensal nao e confiavel e percentuais sobre ela enganam.
  const totalInflows = sum(all.filter((t) => t.amount > 0).map((t) => t.amount));
  const totalIncomeIn = sum(all.filter(incomeIn).map((t) => t.amount));
  const incomeShare = pct(totalIncomeIn, totalInflows);
  const incomeReliable = incomeShare >= 40 && (salaryDetected || income >= consumption);
  const notes: string[] = [];
  if (!incomeReliable)
    notes.push(
      `Apenas ${incomeShare}% das suas entradas são renda de fato — o resto é transferência/empréstimo/investimento. Sem uma renda confiável, percentuais "sobre a renda" e a classificação do mês não refletem sua realidade, então a análise foca no consumo (que é mensurável).`,
    );
  if (uncertainShare > 25)
    notes.push(
      `${uncertainShare}% das transações têm categoria desconhecida e foram classificadas por heurística.`,
    );

  return {
    period: {
      month: targetMonth,
      from: dateKey(bounds.from),
      to: dateKey(bounds.to),
    },
    dataQuality: { uncertainCategoryShare: uncertainShare, salaryDetected, incomeReliable, notes },
    summary: { income, consumption, savings, commitmentPct, classification, changeVsPrevPct },
    categories,
    moneyDestination,
    behavior,
    trends,
    subscriptions,
    waste,
    health,
    movements,
    dailyConsumption,
    reserve: computeReserve(all, targetMonth, liquidAssets),
    lifestyle: computeLifestyle(thisM, income, incomeReliable),
  };
}

/**
 * Consumo acumulado do dia 1 ate hoje (ou ate o fim do mes, se ja passou).
 * E o mesmo numero do summary, so que quebrado por dia — o cliente desenha o
 * ritmo de gasto sem precisar das transacoes cruas.
 */
function computeDailyConsumption(thisM: Tx[], targetMonth: string): number[] {
  const now = new Date();
  const lastDay =
    monthKey(now) === targetMonth ? dayOfMonth(now) : daysInMonth(targetMonth);

  const perDay = new Array<number>(lastDay + 1).fill(0);
  for (const t of thisM.filter(consumptionOut)) {
    const day = dayOfMonth(t.date);
    if (day <= lastDay) perDay[day] += Math.abs(t.amount);
  }

  const cumulative: number[] = [];
  let acc = 0;
  for (let day = 1; day <= lastDay; day++) {
    acc += perDay[day];
    cumulative.push(round2(acc));
  }
  return cumulative;
}

// ---------------------------------------------------------------------------
// Secoes
// ---------------------------------------------------------------------------

function computeCategories(
  thisM: Tx[],
  prevM: Tx[],
  all: Tx[],
  targetMonth: string,
  consumption: number,
): CategoryStat[] {
  const byCat = new Map<string, Tx[]>();
  for (const t of thisM.filter(consumptionOut)) {
    const arr = byCat.get(t.category) ?? [];
    arr.push(t);
    byCat.set(t.category, arr);
  }

  // media historica mensal por categoria (meses com a categoria presente)
  const histByCat = new Map<string, number[]>();
  const monthsSet = new Set(all.map((t) => monthKey(t.date)));
  for (const m of monthsSet) {
    const monthTx = all.filter((t) => consumptionOut(t) && monthKey(t.date) === m);
    const perCat = new Map<string, number>();
    for (const t of monthTx)
      perCat.set(t.category, (perCat.get(t.category) ?? 0) + Math.abs(t.amount));
    for (const [c, v] of perCat) {
      const arr = histByCat.get(c) ?? [];
      arr.push(v);
      histByCat.set(c, arr);
    }
  }

  const stats: CategoryStat[] = [];
  for (const [category, txs] of byCat) {
    const total = round2(sum(txs.map((t) => Math.abs(t.amount))));
    const prevTotal = round2(
      sum(
        prevM
          .filter((t) => consumptionOut(t) && t.category === category)
          .map((t) => Math.abs(t.amount)),
      ),
    );
    const hist = histByCat.get(category) ?? [];
    const histAvg = hist.length ? sum(hist) / hist.length : 0;
    stats.push({
      category,
      total,
      share: pct(total, consumption),
      count: txs.length,
      growthPct: prevTotal > 0 ? pct(total - prevTotal, prevTotal) : null,
      vsHistAvgPct: histAvg > 0 ? pct(total - histAvg, histAvg) : null,
    });
  }
  return stats.sort((a, b) => b.total - a.total);
}

function computeDestination(thisM: Tx[], income: number, consumption: number) {
  const byCat = new Map<string, number>();
  for (const t of thisM.filter(consumptionOut))
    byCat.set(t.category, (byCat.get(t.category) ?? 0) + Math.abs(t.amount));

  const slices = [...byCat.entries()]
    .map(([label, amount]) => ({
      label,
      amount: round2(amount),
      share: pct(amount, income),
    }))
    .sort((a, b) => b.amount - a.amount);

  const feesDebtInvest = sum(
    thisM
      .filter((t) => ['fee', 'debt', 'investment'].includes(t.group) && t.amount < 0)
      .map((t) => Math.abs(t.amount)),
  );
  const leftover = round2(income - consumption - feesDebtInvest);
  return { income, slices, leftover, leftoverShare: pct(leftover, income) };
}

function computeBehavior(thisM: Tx[], prevM: Tx[], bounds: { from: Date; to: Date }) {
  const cons = thisM.filter(consumptionOut);
  const weekend = cons.filter((t) => [0, 6].includes(weekdayOf(t.date)));
  const night = cons.filter((t) => hourOfDay(t.date) >= 22 || hourOfDay(t.date) < 6);
  const deliveryThis = cons.filter((t) => t.category.toLowerCase().includes('delivery'));
  const deliveryPrev = prevM.filter(
    (t) => consumptionOut(t) && t.category.toLowerCase().includes('delivery'),
  );
  const days = Math.max(
    1,
    Math.round((bounds.to.getTime() - bounds.from.getTime()) / 86400000),
  );
  return {
    weekendSharePct: pct(weekend.length, Math.max(cons.length, 1)),
    nightSharePct: pct(night.length, Math.max(cons.length, 1)),
    deliveryCountThisMonth: deliveryThis.length,
    deliveryCountPrevMonth: deliveryPrev.length,
    avgTransactionsPerDay: round2(cons.length / days),
  };
}

function windowMetrics(all: Tx[], targetMonth: string, months: number): TrendPoint {
  const startMonth = addMonths(targetMonth, -(months - 1));
  const start = monthBounds(startMonth).from;
  const end = monthBounds(targetMonth).to;
  const inWin = all.filter((t) => t.date >= start && t.date <= end);
  const income = round2(sum(inWin.filter(incomeIn).map((t) => t.amount)));
  const consumption = round2(
    sum(inWin.filter(consumptionOut).map((t) => Math.abs(t.amount))),
  );
  const savings = round2(income - consumption);
  const label = (`${months}m` as TrendPoint['window']);
  return { window: label, income, consumption, savings, savingsRatePct: pct(savings, income) };
}

function computeTrends(all: Tx[], targetMonth: string): TrendPoint[] {
  return [1, 3, 6, 12].map((m) => windowMetrics(all, targetMonth, m));
}

function computeSubscriptions(all: Tx[], targetMonth: string) {
  const groups = new Map<string, Tx[]>();
  for (const t of all.filter((t) => t.amount < 0 && t.group !== 'transfer')) {
    const key = normalizeDesc(t.description);
    if (key.length < 3) continue;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  // Uma assinatura so conta como despesa fixa se ainda esta sendo cobrada.
  // Sem esta janela, um servico cancelado ha meses seguia entrando no total
  // mensal/anual e nas recomendacoes de economia para sempre.
  const activeMonths = new Set([targetMonth, addMonths(targetMonth, -1)]);

  const items: Subscription[] = [];
  for (const [key, txs] of groups) {
    const months = new Set(txs.map((t) => monthKey(t.date)));
    if (months.size < 3) continue; // recorrente = ao menos 3 meses distintos
    const last = txs.reduce((a, b) => (a.date > b.date ? a : b));
    if (!activeMonths.has(monthKey(last.date))) continue; // cancelada
    const amounts = txs.map((t) => Math.abs(t.amount));
    const mean = sum(amounts) / amounts.length;
    const variance = sum(amounts.map((a) => (a - mean) ** 2)) / amounts.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    if (cv > 0.35) continue; // valor instavel -> provavelmente nao e assinatura
    items.push({
      description: key,
      monthlyAmount: round2(mean),
      monthsSeen: months.size,
      annualEstimate: round2(mean * 12),
      lastDate: dateKey(last.date),
      currentAmount: round2(Math.abs(last.amount)),
      increasePct: increaseOverHistory(txs, last),
    });
  }
  items.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
  const monthlyTotal = round2(sum(items.map((i) => i.monthlyAmount)));
  return { items, monthlyTotal, annualTotal: round2(monthlyTotal * 12) };
}

/**
 * Quanto a cobranca atual subiu sobre a mediana das anteriores.
 *
 * Reajuste de assinatura passa despercebido porque o valor novo vira o
 * "normal" na media. Comparando so a ultima cobranca contra a mediana do
 * historico, o aumento aparece. Abaixo de 5% e ruido (centavos, cambio).
 */
function increaseOverHistory(txs: Tx[], last: Tx): number | null {
  const previous = txs
    .filter((t) => t !== last)
    .map((t) => Math.abs(t.amount))
    .sort((a, b) => a - b);
  if (previous.length < 2) return null;

  const mid = Math.floor(previous.length / 2);
  const median =
    previous.length % 2 ? previous[mid] : (previous[mid - 1] + previous[mid]) / 2;
  if (median <= 0) return null;

  const growth = pct(Math.abs(last.amount) - median, median);
  return growth >= 5 ? growth : null;
}

function computeWaste(thisM: Tx[], feesOut: number) {
  const out: { label: string; total: number; count: number; note: string }[] = [];
  const wasteTx = thisM.filter(
    (t) => consumptionOut(t) && WASTE_CATEGORIES.has(t.category.toLowerCase()),
  );
  const byCat = new Map<string, Tx[]>();
  for (const t of wasteTx) {
    const arr = byCat.get(t.category) ?? [];
    arr.push(t);
    byCat.set(t.category, arr);
  }
  for (const [cat, txs] of byCat) {
    const total = round2(sum(txs.map((t) => Math.abs(t.amount))));
    out.push({
      label: cat,
      total,
      count: txs.length,
      note: `${txs.length}x em ${cat} no mês, somando R$ ${total.toFixed(2)}.`,
    });
  }
  if (feesOut > 0)
    out.push({
      label: 'Taxas e juros',
      total: feesOut,
      count: 0,
      note: `R$ ${feesOut.toFixed(2)} em taxas/juros/multas no mês — valor evitável.`,
    });
  return out.sort((a, b) => b.total - a.total);
}

function medianMonthlyConsumption(all: Tx[]): number {
  const byMonth = new Map<string, number>();
  for (const t of all.filter(consumptionOut))
    byMonth.set(monthKey(t.date), (byMonth.get(monthKey(t.date)) ?? 0) + Math.abs(t.amount));
  const vals = [...byMonth.values()].sort((a, b) => a - b);
  if (!vals.length) return 0;
  return vals[Math.floor(vals.length / 2)];
}

function detectSalary(all: Tx[], minMean: number): boolean {
  // salario = entrada recorrente (>=3 meses), valor estavel E material
  // (ao menos comparavel ao consumo mensal tipico). Evita confundir uma
  // pequena entrada recorrente (ex.: R$ 7) com salario.
  const groups = new Map<string, Tx[]>();
  for (const t of all.filter(incomeIn)) {
    const key = normalizeDesc(t.description);
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }
  for (const [, txs] of groups) {
    const months = new Set(txs.map((t) => monthKey(t.date)));
    if (months.size < 3) continue;
    const amts = txs.map((t) => t.amount);
    const mean = sum(amts) / amts.length;
    const cv =
      mean > 0
        ? Math.sqrt(sum(amts.map((a) => (a - mean) ** 2)) / amts.length) / mean
        : 1;
    if (cv < 0.2 && mean >= Math.max(minMean, 1)) return true;
  }
  return false;
}

function computeHealth(
  trends: TrendPoint[],
  all: Tx[],
  targetMonth: string,
  income: number,
  debtOut: number,
  feesOut: number,
): HealthScore {
  const t3 = trends.find((t) => t.window === '3m')!;
  const t6 = trends.find((t) => t.window === '6m')!;
  const components: HealthScore['components'] = [];

  // 1) Capacidade de poupanca (30)
  const sr = t3.savingsRatePct;
  const savePts = Math.max(0, Math.min(30, Math.round((sr / 20) * 30)));
  components.push({
    label: 'Capacidade de poupança',
    points: savePts,
    max: 30,
    note: `Taxa de poupança (3m): ${sr}%`,
  });

  // 2) Regularidade dos gastos (15) — menor volatilidade mensal = melhor
  const monthsConsumption: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = addMonths(targetMonth, -i);
    monthsConsumption.push(
      sum(
        all
          .filter((t) => consumptionOut(t) && monthKey(t.date) === m)
          .map((t) => Math.abs(t.amount)),
      ),
    );
  }
  const meanC = sum(monthsConsumption) / Math.max(monthsConsumption.length, 1);
  const cvC =
    meanC > 0
      ? Math.sqrt(sum(monthsConsumption.map((c) => (c - meanC) ** 2)) / monthsConsumption.length) /
        meanC
      : 1;
  const regPts = Math.max(0, Math.min(15, Math.round((1 - Math.min(cvC, 1)) * 15)));
  components.push({
    label: 'Regularidade dos gastos',
    points: regPts,
    max: 15,
    note: `Volatilidade do consumo (6m): ${round2(cvC * 100)}%`,
  });

  // 3) Crescimento financeiro (15) — poupanca 3m vs 6m
  const growthPts = t3.savingsRatePct >= t6.savingsRatePct ? 15 : 7;
  components.push({
    label: 'Crescimento financeiro',
    points: growthPts,
    max: 15,
    note: `Poupança 3m (${t3.savingsRatePct}%) vs 6m (${t6.savingsRatePct}%)`,
  });

  // 4) Dependencia de credito/divida (15) — menor comprometimento = melhor
  const debtShare = pct(debtOut + feesOut, Math.max(income, 1));
  const debtPts = Math.max(0, Math.min(15, Math.round(15 - (debtShare / 50) * 15)));
  components.push({
    label: 'Dependência de dívida',
    points: debtPts,
    max: 15,
    note: `Dívida+taxas sobre renda: ${debtShare}%`,
  });

  // 5) Reserva financeira (15) — investimentos liquidos acumulados positivos
  const investedNet = -sum(all.filter((t) => t.group === 'investment').map((t) => t.amount));
  const reservePts = investedNet > 0 ? 15 : 0;
  components.push({
    label: 'Reserva financeira',
    points: reservePts,
    max: 15,
    note: investedNet > 0 ? `Investido líquido acumulado: R$ ${round2(investedNet).toFixed(2)}` : 'Sem reserva/investimento líquido positivo',
  });

  // 6) Controle orcamentario (10) — consumo do mes vs media 6m
  const lastC = monthsConsumption[monthsConsumption.length - 1] ?? 0;
  const ctrlPts = meanC > 0 && lastC <= meanC ? 10 : 4;
  components.push({
    label: 'Controle orçamentário',
    points: ctrlPts,
    max: 10,
    note: `Consumo do mês vs média 6m (R$ ${round2(meanC).toFixed(2)})`,
  });

  const score = components.reduce((a, c) => a + c.points, 0);
  const rating: HealthScore['rating'] =
    score >= 80 ? 'Excelente' : score >= 60 ? 'Bom' : score >= 40 ? 'Atenção' : 'Crítico';
  return { score, rating, components };
}

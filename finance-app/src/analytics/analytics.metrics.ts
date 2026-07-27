import {
  AnalyticsData,
  CategoryStat,
  HealthScore,
  Subscription,
  TrendPoint,
  Tx,
} from './analytics.types';
import { WASTE_CATEGORIES } from './category-groups';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const pct = (part: number, whole: number) =>
  whole > 0 ? round2((part / whole) * 100) : 0;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** 'YYYY-MM' em horario local (relevante p/ transacoes de fim de mes). */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

function monthBounds(month: string): { from: Date; to: Date } {
  const [y, m] = month.split('-').map(Number);
  return { from: new Date(y, m - 1, 1, 0, 0, 0), to: new Date(y, m, 0, 23, 59, 59) };
}

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

// ---------------------------------------------------------------------------
// Calculo principal
// ---------------------------------------------------------------------------

export function computeAnalytics(all: Tx[], targetMonth: string): AnalyticsData {
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
  const subscriptions = computeSubscriptions(all);

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
  };

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
      from: bounds.from.toISOString().slice(0, 10),
      to: bounds.to.toISOString().slice(0, 10),
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
  };
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
  const weekend = cons.filter((t) => [0, 6].includes(t.date.getDay()));
  const night = cons.filter((t) => t.date.getHours() >= 22 || t.date.getHours() < 6);
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

function computeSubscriptions(all: Tx[]) {
  const groups = new Map<string, Tx[]>();
  for (const t of all.filter((t) => t.amount < 0 && t.group !== 'transfer')) {
    const key = normalizeDesc(t.description);
    if (key.length < 3) continue;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  const items: Subscription[] = [];
  for (const [key, txs] of groups) {
    const months = new Set(txs.map((t) => monthKey(t.date)));
    if (months.size < 3) continue; // recorrente = ao menos 3 meses distintos
    const amounts = txs.map((t) => Math.abs(t.amount));
    const mean = sum(amounts) / amounts.length;
    const variance = sum(amounts.map((a) => (a - mean) ** 2)) / amounts.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    if (cv > 0.35) continue; // valor instavel -> provavelmente nao e assinatura
    const last = txs.reduce((a, b) => (a.date > b.date ? a : b));
    items.push({
      description: key,
      monthlyAmount: round2(mean),
      monthsSeen: months.size,
      annualEstimate: round2(mean * 12),
      lastDate: last.date.toISOString().slice(0, 10),
    });
  }
  items.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
  const monthlyTotal = round2(sum(items.map((i) => i.monthlyAmount)));
  return { items, monthlyTotal, annualTotal: round2(monthlyTotal * 12) };
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

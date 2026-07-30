import { describe, expect, it } from 'vitest';
import { RuleBasedNarrator } from './narrator';
import { AnalyticsData, Subscription } from './analytics.types';

const narrator = new RuleBasedNarrator();

/** AnalyticsData minimo e valido, para exercitar uma secao por vez. */
function data(patch: Partial<AnalyticsData> = {}): AnalyticsData {
  const trend = (window: '1m' | '3m' | '6m' | '12m') => ({
    window,
    income: 3000,
    consumption: 1000,
    savings: 2000,
    savingsRatePct: 66,
  });
  return {
    period: { month: '2026-07', from: '2026-07-01', to: '2026-07-31' },
    dataQuality: {
      uncertainCategoryShare: 0,
      salaryDetected: true,
      incomeReliable: true,
      notes: [],
    },
    summary: {
      income: 3000,
      consumption: 1000,
      savings: 2000,
      commitmentPct: 33,
      classification: 'Saudável',
      changeVsPrevPct: null,
    },
    categories: [],
    moneyDestination: { income: 3000, slices: [], leftover: 2000, leftoverShare: 66 },
    behavior: {
      weekendSharePct: 0,
      nightSharePct: 0,
      deliveryCountThisMonth: 0,
      deliveryCountPrevMonth: 0,
      avgTransactionsPerDay: 1,
    },
    trends: [trend('1m'), trend('3m'), trend('6m'), trend('12m')],
    subscriptions: { items: [], monthlyTotal: 0, annualTotal: 0 },
    waste: [],
    health: { score: 70, rating: 'Bom', components: [] },
    movements: { transfers: 0, investmentsNet: 0, debt: 0, fees: 0, gamblingNet: null },
    dailyConsumption: [],
    reserve: {
      liquidAssets: 6000,
      monthlyCost: 1000,
      months: 6,
      targetMonths: 6,
      missing: 0,
      status: 'completa',
    },
    lifestyle: {
      essential: 600,
      lifestyle: 400,
      essentialPct: 20,
      lifestylePct: 13,
      savedPct: 67,
      topLifestyle: [],
    },
    habits: [],
    ...patch,
  };
}

function sub(description: string, monthlyAmount: number, monthsSeen: number): Subscription {
  return {
    description,
    monthlyAmount,
    monthsSeen,
    annualEstimate: monthlyAmount * 12,
    lastDate: '2026-07-08',
    currentAmount: monthlyAmount,
    increasePct: null,
  };
}

describe('oportunidades — assinaturas menos usadas', () => {
  it('escolhe pelas menos vistas, nao pelas mais baratas', () => {
    const items = [
      sub('academia', 120, 12), // cara, mas usada todo mes
      sub('curso online', 90, 3), // pouco usada
      sub('revista', 15, 2), // pouco usada
      sub('streaming', 40, 12),
    ];
    const d = data({
      subscriptions: { items, monthlyTotal: 265, annualTotal: 3180 },
    });

    const frase = narrator
      .narrate(d)
      .oportunidades.find((o) => o.includes('assinaturas menos usadas'))!;

    expect(frase).toContain('revista');
    expect(frase).toContain('curso online');
    expect(frase).not.toContain('academia');
    // 15 + 90 = 105/mes
    expect(frase).toContain('105,00');
  });

  it('nao sugere revisao com menos de duas assinaturas', () => {
    const d = data({
      subscriptions: { items: [sub('streaming', 40, 12)], monthlyTotal: 40, annualTotal: 480 },
    });
    const frases = narrator.narrate(d).oportunidades;
    expect(frases.some((o) => o.includes('assinaturas menos usadas'))).toBe(false);
  });
});

describe('reserva de emergencia', () => {
  it('diz quanto falta e em quanto tempo, no ritmo atual', () => {
    const d = data({
      reserve: {
        liquidAssets: 3000,
        monthlyCost: 1000,
        months: 3,
        targetMonths: 6,
        missing: 3000,
        status: 'boa',
      },
    });

    const frases = narrator.narrate(d).reserva.join(' ');

    expect(frases).toContain('3,0 meses de reserva');
    expect(frases).toContain('faltam R$ 3.000,00');
    // poupanca de 3m e 2000 no fixture -> ~666,67/mes -> 5 meses
    expect(frases).toContain('leva 5 meses');
  });

  it('avisa quem nao tem nem um mes guardado', () => {
    const d = data({
      reserve: {
        liquidAssets: 200,
        monthlyCost: 1000,
        months: 0.2,
        targetMonths: 6,
        missing: 5800,
        status: 'sem-reserva',
      },
    });
    expect(narrator.narrate(d).reserva.join(' ')).toContain('Antes de investir');
  });

  it('nao inventa numero quando nao da pra estimar o custo', () => {
    const d = data({
      reserve: {
        liquidAssets: 0,
        monthlyCost: 0,
        months: null,
        targetMonths: 6,
        missing: 0,
        status: 'indefinido',
      },
    });
    expect(narrator.narrate(d).reserva[0]).toContain('Ainda não dá pra estimar');
  });
});

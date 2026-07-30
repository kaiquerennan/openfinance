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

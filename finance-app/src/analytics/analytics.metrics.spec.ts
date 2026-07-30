import { describe, expect, it } from 'vitest';
import { computeAnalytics } from './analytics.metrics';
import { groupOf } from './category-groups';
import { Tx } from './analytics.types';

/**
 * Fabrica uma transacao ja normalizada (o grupo sai do proprio mapa de
 * categorias, como acontece no AnalyticsService ao carregar do banco).
 */
let seq = 0;
function tx(
  date: string,
  amount: number,
  category: string,
  description = 'lancamento',
): Tx {
  const [y, m, d, hh = '12'] = date.split(/[-T:]/);
  const when = new Date(Number(y), Number(m) - 1, Number(d), Number(hh));
  const { group, uncertain } = groupOf(category, amount);
  return {
    id: `tx-${seq++}`,
    accountId: 'acc-1',
    date: when,
    amount,
    category,
    description,
    type: amount < 0 ? 'DEBIT' : 'CREDIT',
    group,
    uncertain,
  };
}

/** Salario recorrente e material — necessario pra incomeReliable ficar true. */
function salaryHistory(months: string[], amount = 3000): Tx[] {
  return months.map((m) => tx(`${m}-05`, amount, 'salary', 'Salario ACME'));
}

describe('computeAnalytics — resumo do mes', () => {
  it('separa consumo de taxas, dividas e transferencias', () => {
    const all = [
      ...salaryHistory(['2026-04', '2026-05', '2026-06', '2026-07']),
      tx('2026-07-10', -500, 'groceries'),
      tx('2026-07-11', -100, 'bank fees'),
      tx('2026-07-12', -200, 'loans'),
      tx('2026-07-13', -700, 'transfers'),
      tx('2026-07-14', -300, 'investments'),
    ];

    const d = computeAnalytics(all, '2026-07');

    expect(d.summary.income).toBe(3000);
    // so groceries e consumo: tarifa, emprestimo, transferencia e aporte ficam fora
    expect(d.summary.consumption).toBe(500);
    // sobra = renda - consumo - taxas - dividas
    expect(d.summary.savings).toBe(3000 - 500 - 100 - 200);
    expect(d.movements.fees).toBe(100);
    expect(d.movements.debt).toBe(200);
    expect(d.movements.transfers).toBe(700);
    expect(d.movements.investmentsNet).toBe(300);
  });

  it('classifica o mes pelo percentual comprometido da renda', () => {
    const base = salaryHistory(['2026-04', '2026-05', '2026-06', '2026-07'], 1000);
    const saudavel = computeAnalytics([...base, tx('2026-07-10', -500, 'groceries')], '2026-07');
    expect(saudavel.summary.commitmentPct).toBe(50);
    expect(saudavel.summary.classification).toBe('Saudável');

    const critico = computeAnalytics([...base, tx('2026-07-10', -1500, 'groceries')], '2026-07');
    expect(critico.summary.classification).toBe('Crítico');
  });

  it('compara o consumo com o mes anterior', () => {
    const all = [
      ...salaryHistory(['2026-05', '2026-06', '2026-07']),
      tx('2026-06-10', -400, 'groceries'),
      tx('2026-07-10', -500, 'groceries'),
    ];
    const d = computeAnalytics(all, '2026-07');
    expect(d.summary.changeVsPrevPct).toBe(25);
  });
});

describe('computeAnalytics — apostas', () => {
  it('abate o que voltou da mesma casa do valor apostado', () => {
    const all = [
      ...salaryHistory(['2026-05', '2026-06', '2026-07']),
      tx('2026-07-10', -300, 'gambling', 'Aposta|Casa X'),
      tx('2026-07-15', 200, 'transfers', 'Transferencia recebida|Casa X'),
    ];

    const d = computeAnalytics(all, '2026-07');

    // apostou 300, recuperou 200 -> perda liquida de 100
    expect(d.movements.gamblingNet).toBe(-100);
    // e o consumo do mes reflete o valor liquido, nao os 300 brutos
    expect(d.summary.consumption).toBe(100);
  });

  it('reporta ganho liquido quando recuperou mais do que apostou', () => {
    const all = [
      ...salaryHistory(['2026-05', '2026-06', '2026-07']),
      tx('2026-07-10', -100, 'gambling', 'Aposta|Casa X'),
      tx('2026-07-15', 250, 'transfers', 'Transferencia recebida|Casa X'),
    ];
    const d = computeAnalytics(all, '2026-07');
    expect(d.movements.gamblingNet).toBe(150);
    expect(d.summary.consumption).toBe(0);
  });

  it('deixa gamblingNet nulo quando nao houve aposta no mes', () => {
    const all = salaryHistory(['2026-05', '2026-06', '2026-07']);
    expect(computeAnalytics(all, '2026-07').movements.gamblingNet).toBeNull();
  });
});

describe('computeAnalytics — categorias', () => {
  it('ordena por total e calcula participacao no consumo', () => {
    const all = [
      ...salaryHistory(['2026-05', '2026-06', '2026-07']),
      tx('2026-07-10', -600, 'groceries'),
      tx('2026-07-11', -300, 'restaurants'),
      tx('2026-07-12', -100, 'restaurants'),
    ];

    const d = computeAnalytics(all, '2026-07');

    expect(d.categories.map((c) => c.category)).toEqual(['groceries', 'restaurants']);
    expect(d.categories[0].share).toBe(60);
    expect(d.categories[1].count).toBe(2);
  });

  it('calcula o crescimento vs o mes anterior por categoria', () => {
    const all = [
      ...salaryHistory(['2026-05', '2026-06', '2026-07']),
      tx('2026-06-10', -200, 'groceries'),
      tx('2026-07-10', -300, 'groceries'),
    ];
    const groceries = computeAnalytics(all, '2026-07').categories[0];
    expect(groceries.growthPct).toBe(50);
  });
});

describe('computeAnalytics — assinaturas', () => {
  it('detecta cobranca recorrente de valor estavel', () => {
    const all = [
      ...salaryHistory(['2026-05', '2026-06', '2026-07']),
      tx('2026-05-08', -39.9, 'streaming', 'Netflix'),
      tx('2026-06-08', -39.9, 'streaming', 'Netflix'),
      tx('2026-07-08', -39.9, 'streaming', 'Netflix'),
    ];

    const d = computeAnalytics(all, '2026-07');

    expect(d.subscriptions.items).toHaveLength(1);
    expect(d.subscriptions.items[0].monthsSeen).toBe(3);
    expect(d.subscriptions.monthlyTotal).toBe(39.9);
    expect(d.subscriptions.annualTotal).toBe(478.8);
  });

  it('ignora cobranca vista em menos de 3 meses', () => {
    const all = [
      ...salaryHistory(['2026-05', '2026-06', '2026-07']),
      tx('2026-06-08', -39.9, 'streaming', 'Netflix'),
      tx('2026-07-08', -39.9, 'streaming', 'Netflix'),
    ];
    expect(computeAnalytics(all, '2026-07').subscriptions.items).toHaveLength(0);
  });

  it('ignora cobranca de valor instavel', () => {
    const all = [
      ...salaryHistory(['2026-05', '2026-06', '2026-07']),
      tx('2026-05-08', -10, 'groceries', 'Mercado'),
      tx('2026-06-08', -90, 'groceries', 'Mercado'),
      tx('2026-07-08', -300, 'groceries', 'Mercado'),
    ];
    expect(computeAnalytics(all, '2026-07').subscriptions.items).toHaveLength(0);
  });
});

describe('computeAnalytics — qualidade dos dados', () => {
  it('marca a renda como confiavel quando ha salario recorrente e material', () => {
    const all = [
      ...salaryHistory(['2026-04', '2026-05', '2026-06', '2026-07']),
      tx('2026-07-10', -500, 'groceries'),
    ];
    const d = computeAnalytics(all, '2026-07');
    expect(d.dataQuality.salaryDetected).toBe(true);
    expect(d.dataQuality.incomeReliable).toBe(true);
  });

  it('marca a renda como nao confiavel quando as entradas sao quase so transferencia', () => {
    const all = [
      tx('2026-07-01', 5000, 'transfers', 'Pix recebido'),
      tx('2026-07-05', 100, 'income', 'Reembolso'),
      tx('2026-07-10', -500, 'groceries'),
    ];
    const d = computeAnalytics(all, '2026-07');
    expect(d.dataQuality.incomeReliable).toBe(false);
    expect(d.dataQuality.notes.join(' ')).toContain('entradas são renda de fato');
  });

  it('avisa quando muitas transacoes caem em categoria desconhecida', () => {
    const all = [
      ...salaryHistory(['2026-05', '2026-06', '2026-07']),
      tx('2026-07-10', -100, 'algo estranho'),
      tx('2026-07-11', -100, 'outra coisa'),
    ];
    const d = computeAnalytics(all, '2026-07');
    expect(d.dataQuality.uncertainCategoryShare).toBeGreaterThan(25);
    expect(d.dataQuality.notes.join(' ')).toContain('categoria desconhecida');
  });
});

describe('computeAnalytics — tendencias e desperdicio', () => {
  it('acumula as janelas de 1, 3, 6 e 12 meses', () => {
    const all = [
      ...salaryHistory(['2026-05', '2026-06', '2026-07'], 1000),
      tx('2026-05-10', -100, 'groceries'),
      tx('2026-06-10', -100, 'groceries'),
      tx('2026-07-10', -100, 'groceries'),
    ];

    const trends = computeAnalytics(all, '2026-07').trends;
    const win = (w: string) => trends.find((t) => t.window === w)!;

    expect(win('1m').consumption).toBe(100);
    expect(win('3m').consumption).toBe(300);
    expect(win('3m').income).toBe(3000);
    expect(win('3m').savingsRatePct).toBe(90);
    // sem dados antes de maio, 6m e 12m batem com a janela de 3m
    expect(win('12m').consumption).toBe(300);
  });

  it('lista categorias de desperdicio e taxas do mes', () => {
    const all = [
      ...salaryHistory(['2026-05', '2026-06', '2026-07']),
      tx('2026-07-10', -80, 'food delivery'),
      tx('2026-07-11', -20, 'bank fees'),
    ];

    const waste = computeAnalytics(all, '2026-07').waste;

    expect(waste.map((w) => w.label)).toContain('food delivery');
    expect(waste.find((w) => w.label === 'Taxas e juros')?.total).toBe(20);
  });
});

describe('groupOf', () => {
  it('classifica categorias conhecidas sem marcar incerteza', () => {
    expect(groupOf('transfers', -10)).toEqual({ group: 'transfer', uncertain: false });
    expect(groupOf('bank fees', -10)).toEqual({ group: 'fee', uncertain: false });
    expect(groupOf('loans', -10)).toEqual({ group: 'debt', uncertain: false });
    expect(groupOf('salary', 10)).toEqual({ group: 'income', uncertain: false });
  });

  it('cai em consumo ou renda pelo sinal quando a categoria e desconhecida', () => {
    expect(groupOf('categoria nova', -10)).toEqual({ group: 'consumption', uncertain: true });
    expect(groupOf(null, 10)).toEqual({ group: 'income', uncertain: true });
  });
});

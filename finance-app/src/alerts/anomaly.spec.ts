import { describe, expect, it } from 'vitest';
import { Tx } from '../analytics/analytics.types';
import { findAnomalies } from './anomaly';

const HOJE = new Date('2026-08-16T12:00:00Z');

function tx(over: Partial<Tx> & { amount: number; date: Date }): Tx {
  return {
    id: Math.random().toString(36).slice(2),
    accountId: 'acc',
    description: 'Padaria Chua',
    category: 'groceries',
    type: 'DEBIT',
    group: 'consumption',
    uncertain: false,
    ...over,
  } as Tx;
}

/** Historico banal: um lugar barato, cobrado varias vezes. */
function rotina(valor = 10, dias = [40, 35, 30, 25, 20]) {
  return dias.map((d) =>
    tx({
      amount: -valor,
      date: new Date(HOJE.getTime() - d * 86_400_000),
    }),
  );
}

describe('findAnomalies', () => {
  it('avisa quando o lugar de sempre cobra muito acima do normal', () => {
    const [alerta] = findAnomalies(
      [...rotina(), tx({ id: 'hoje', amount: -300, date: HOJE })],
      HOJE,
    );

    expect(alerta.transactionId).toBe('hoje');
    expect(alerta.reason).toBe('merchant');
    expect(alerta.typical).toBe(10);
    expect(alerta.times).toBe(30);
  });

  it('nao avisa por uma variacao normal da mesma cobranca', () => {
    const anomalias = findAnomalies(
      [...rotina(), tx({ id: 'hoje', amount: -22, date: HOJE })],
      HOJE,
    );
    expect(anomalias).toHaveLength(0);
  });

  it('ignora valor pequeno, mesmo sendo muitas vezes o de sempre', () => {
    const anomalias = findAnomalies(
      [...rotina(2), tx({ id: 'hoje', amount: -60, date: HOJE })],
      HOJE,
    );
    expect(anomalias).toHaveLength(0);
  });

  it('compara lugar novo com o tamanho habitual das compras', () => {
    const [alerta] = findAnomalies(
      [
        ...rotina(),
        tx({ id: 'hoje', description: 'Loja Nova', amount: -900, date: HOJE }),
      ],
      HOJE,
    );
    expect(alerta.transactionId).toBe('hoje');
    expect(alerta.reason).toBe('unusual');
  });

  it('nao olha movimentacao nem gasto antigo', () => {
    const anomalias = findAnomalies(
      [
        ...rotina(),
        tx({
          id: 'aplicacao',
          description: 'Aplicação CDB',
          amount: -5000,
          date: HOJE,
          group: 'investment',
        }),
        tx({
          id: 'antigo',
          description: 'Loja Nova',
          amount: -900,
          date: new Date(HOJE.getTime() - 10 * 86_400_000),
        }),
      ],
      HOJE,
    );
    expect(anomalias).toHaveLength(0);
  });
});

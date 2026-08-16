import { describe, expect, it } from 'vitest';
import {
  InstallmentCharge,
  buildPlans,
  committedFrom,
  monthlySchedule,
  parseInstallment,
} from './installments';

describe('parseInstallment', () => {
  it('le os formatos que aparecem na fatura', () => {
    expect(parseInstallment('MERCADO LIVRE 03/10')).toEqual({
      number: 3,
      total: 10,
      description: 'MERCADO LIVRE',
    });
    expect(parseInstallment('PARC 2/6 LOJA X')?.number).toBe(2);
    expect(parseInstallment('GELADEIRA 1 DE 12')?.total).toBe(12);
  });

  it('ignora o que so parece parcela', () => {
    expect(parseInstallment('UBER TRIP')).toBeNull();
    // 0/5 e 7/5 nao existem; 03/99 estoura o limite de parcelas.
    expect(parseInstallment('LOJA 0/5')).toBeNull();
    expect(parseInstallment('LOJA 7/5')).toBeNull();
    expect(parseInstallment('LOJA 03/99')).toBeNull();
  });
});

function charge(over: Partial<InstallmentCharge> = {}): InstallmentCharge {
  return {
    id: 'tx',
    accountId: 'card',
    accountName: 'Nubank',
    date: new Date('2026-08-10T12:00:00Z'),
    description: 'GELADEIRA',
    amount: 200,
    number: 3,
    total: 10,
    totalAmount: null,
    ...over,
  };
}

describe('buildPlans', () => {
  it('projeta o que falta a partir da ultima parcela vista', () => {
    const [plan] = buildPlans(
      [
        charge({ id: 'a', number: 1, date: new Date('2026-06-10T12:00:00Z') }),
        charge({ id: 'b', number: 2, date: new Date('2026-07-10T12:00:00Z') }),
        charge({ id: 'c', number: 3, date: new Date('2026-08-10T12:00:00Z') }),
      ],
      '2026-08',
    );

    expect(plan.paidInstallments).toBe(3);
    expect(plan.remaining).toBe(7);
    expect(plan.remainingAmount).toBe(1400);
    expect(plan.totalAmount).toBe(2000);
    expect(plan.nextMonth).toBe('2026-09');
    expect(plan.endsOn).toBe('2027-03');
  });

  it('descarta o plano quitado e o que parou de ser cobrado', () => {
    const quitado = charge({ number: 10, total: 10 });
    const parado = charge({ date: new Date('2026-01-10T12:00:00Z') });
    expect(buildPlans([quitado, parado], '2026-08')).toHaveLength(0);
  });

  it('nao junta compras diferentes do mesmo cartao', () => {
    const plans = buildPlans(
      [
        charge({ id: 'a', description: 'GELADEIRA', amount: 200 }),
        charge({ id: 'b', description: 'NOTEBOOK', amount: 500 }),
      ],
      '2026-08',
    );
    expect(plans).toHaveLength(2);
    expect(plans[0].description).toBe('NOTEBOOK');
  });
});

describe('monthlySchedule', () => {
  it('distribui as parcelas restantes pelos meses seguintes', () => {
    const plans = buildPlans([charge()], '2026-08');
    const meses = monthlySchedule(plans, '2026-08', 3);

    // A parcela de agosto ja foi cobrada: o compromisso comeca em setembro.
    expect(meses.map((m) => m.amount)).toEqual([0, 200, 200]);
    expect(meses[1].count).toBe(1);
  });

  it('soma tudo que ainda vem, mesmo alem do horizonte mostrado', () => {
    const plans = buildPlans([charge()], '2026-08');
    expect(committedFrom(plans, '2026-08')).toBe(1400);
  });
});

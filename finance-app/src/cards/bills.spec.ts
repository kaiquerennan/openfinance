import { describe, expect, it } from 'vitest';
import {
  StoredBill,
  averageBill,
  openBillOf,
  summarizeBills,
} from './bills';

const HOJE = new Date('2026-07-30T12:00:00Z');

function bill(over: Partial<StoredBill> & { id: string; dueDate: string }): StoredBill {
  return {
    closingDate: null,
    totalAmount: 1000,
    minimumPayment: 150,
    financeCharges: 0,
    paymentsAmount: 0,
    ...over,
    dueDate: new Date(over.dueDate),
  };
}

/** Tres ciclos que fecham no dia 28 e vencem no dia 1: os dois primeiros
 *  quitados, o de agosto ainda a vencer. */
const CICLOS = [
  bill({ id: 'jun', dueDate: '2026-06-01', totalAmount: 600, closingDate: new Date('2026-05-28') }),
  bill({ id: 'jul', dueDate: '2026-07-01', totalAmount: 800, paymentsAmount: 600, closingDate: new Date('2026-06-28') }),
  bill({ id: 'ago', dueDate: '2026-08-01', totalAmount: 1000, paymentsAmount: 800, closingDate: new Date('2026-07-28') }),
];

describe('summarizeBills', () => {
  it('coloca a mais recente primeiro e mede a variacao', () => {
    const [atual, julho, junho] = summarizeBills(CICLOS, HOJE);

    expect([atual.id, julho.id, junho.id]).toEqual(['ago', 'jul', 'jun']);
    expect(atual.changePct).toBe(25); // 800 -> 1000
    expect(julho.changePct).toBeCloseTo(33.3, 1);
    expect(junho.changePct).toBeNull();
  });

  it('le o pagamento no ciclo seguinte para saber se a fatura foi quitada', () => {
    const [atual, julho, junho] = summarizeBills(CICLOS, HOJE);

    expect(atual.status).toBe('a vencer'); // vence 01/08 e o ciclo seguinte nem fechou
    expect(julho.status).toBe('paga'); // agosto registra 800 de pagamento
    expect(junho.status).toBe('paga'); // julho registra 600
  });

  it('usa o extrato para saber se a fatura mais recente ja foi paga', () => {
    const [atual] = summarizeBills(CICLOS, HOJE, 1000);
    expect(atual.status).toBe('paga');
  });

  it('aponta rotativo quando o pagamento cobre so parte da fatura', () => {
    const parcial = [
      bill({ id: 'jun', dueDate: '2026-06-01', totalAmount: 1000 }),
      bill({ id: 'jul', dueDate: '2026-07-01', totalAmount: 900, paymentsAmount: 300 }),
    ];
    const [, junho] = summarizeBills(parcial, HOJE);
    expect(junho.status).toBe('parcial');
  });
});

describe('openBillOf', () => {
  it('soma so as compras feitas depois do ultimo fechamento', () => {
    const aberta = openBillOf(CICLOS, [
      { date: new Date('2026-07-27'), amount: 50 }, // antes do fechamento
      { date: new Date('2026-07-29'), amount: 120 },
      { date: new Date('2026-08-02'), amount: 30 },
    ]);

    expect(aberta?.total).toBe(150);
    expect(aberta?.count).toBe(2);
    expect(aberta?.since).toBe('2026-07-29');
    expect(aberta?.closesOn).toBe('2026-08-27'); // repete o intervalo de 30 dias
  });

  it('sem fatura nenhuma nao inventa ciclo', () => {
    expect(openBillOf([], [{ date: HOJE, amount: 10 }])).toBeNull();
  });
});

describe('averageBill', () => {
  it('usa as ultimas faturas fechadas como referencia', () => {
    expect(averageBill(summarizeBills(CICLOS, HOJE))).toBe(800);
  });
});

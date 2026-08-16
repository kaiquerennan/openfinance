import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BillView,
  OpenBill,
  averageBill,
  openBillOf,
  summarizeBills,
} from './bills';

export interface CardBills {
  accountId: string;
  accountName: string;
  /** Fatura atual segundo a instituicao (saldo da conta de credito). */
  currentBalance: number;
  creditLimit: number | null;
  availableCreditLimit: number | null;
  bills: BillView[];
  open: OpenBill | null;
  /** Media das ultimas faturas fechadas. */
  average: number;
  /** Juros e encargos somados nas faturas recentes. */
  chargesRecent: number;
}

/** Quantas faturas fechadas devolver por cartao. */
const BILLS_PER_CARD = 12;

@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Ciclos de fatura de cada cartao de credito conectado. */
  async bills(): Promise<CardBills[]> {
    const accounts = await this.prisma.account.findMany({
      where: { type: 'CREDIT' },
      include: {
        bills: { orderBy: { dueDate: 'desc' }, take: BILLS_PER_CARD },
      },
      orderBy: { createdAt: 'asc' },
    });

    const today = new Date();
    const out: CardBills[] = [];

    for (const account of accounts) {
      const stored = account.bills.map((b) => ({
        id: b.id,
        dueDate: b.dueDate,
        closingDate: b.closingDate,
        totalAmount: Number(b.totalAmount),
        minimumPayment: b.minimumPayment != null ? Number(b.minimumPayment) : null,
        financeCharges: Number(b.financeCharges ?? 0),
        paymentsAmount: Number(b.paymentsAmount ?? 0),
      }));

      // Compras do ciclo aberto: so saidas (DEBIT). Pagamento de fatura e
      // estorno chegam como CREDIT e nao sao gasto novo.
      const [purchases, payments] = await Promise.all([
        this.prisma.transaction.findMany({
          where: { accountId: account.id, type: 'DEBIT' },
          select: { date: true, amount: true },
          orderBy: { date: 'desc' },
          take: 500,
        }),
        this.prisma.transaction.findMany({
          where: { accountId: account.id, type: 'CREDIT' },
          select: { date: true, amount: true },
          orderBy: { date: 'desc' },
          take: 50,
        }),
      ]);

      const lastClose = stored.length
        ? (stored[0].closingDate ?? stored[0].dueDate)
        : null;
      const paidAfterClose = lastClose
        ? payments
            .filter((p) => p.date > lastClose)
            .reduce((sum, p) => sum + Math.abs(Number(p.amount)), 0)
        : 0;

      const bills = summarizeBills(stored, today, paidAfterClose);
      out.push({
        accountId: account.id,
        accountName: account.marketingName ?? account.name ?? 'cartão',
        currentBalance: Math.abs(Number(account.balance ?? 0)),
        creditLimit: account.creditLimit != null ? Number(account.creditLimit) : null,
        availableCreditLimit:
          account.availableCreditLimit != null
            ? Number(account.availableCreditLimit)
            : null,
        bills,
        open: openBillOf(
          stored,
          purchases.map((p) => ({ date: p.date, amount: Math.abs(Number(p.amount)) })),
        ),
        average: averageBill(bills),
        chargesRecent:
          Math.round(bills.slice(0, 3).reduce((sum, b) => sum + b.charges, 0) * 100) /
          100,
      });
    }

    this.logger.log(`Faturas de ${out.length} cartao(oes).`);
    return out;
  }
}

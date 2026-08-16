import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { addMonths, monthKey } from '../analytics/timezone';
import {
  InstallmentCharge,
  InstallmentPlan,
  MonthCommitment,
  buildPlans,
  committedFrom,
  monthlySchedule,
  parseInstallment,
} from './installments';

/** Janela de extrato lida para remontar os planos. */
const LOOKBACK_MONTHS = 24;

/** Horizonte padrao do cronograma. */
const DEFAULT_HORIZON = 6;

export interface InstallmentsOverview {
  /** Mes de referencia (o corrente). */
  month: string;
  plans: InstallmentPlan[];
  monthly: MonthCommitment[];
  /** Tudo que ainda vai ser cobrado, do mes corrente em diante. */
  committedTotal: number;
  /** Compromisso do proximo mes. */
  nextMonth: MonthCommitment | null;
  /**
   * Renda mensal tipica usada nas porcentagens. Null quando o extrato nao
   * permite identificar renda com confianca — melhor nao mostrar um percentual
   * do que mostrar um percentual errado.
   */
  monthlyIncome: number | null;
  /** Quanto da renda o mes corrente ja tem comprometido em parcela. */
  currentSharePct: number | null;
  /** Mes em que a ultima parcela em aberto termina. */
  freeFrom: string | null;
}

/**
 * Reconstroi os parcelamentos em aberto a partir do extrato dos cartoes.
 *
 * A leitura e sempre derivada: nao guardamos "plano" nenhum no banco, entao
 * um estorno ou uma renegociacao aparece sozinho no proximo sync, sem alguem
 * precisar lembrar de corrigir cadastro.
 */
@Injectable()
export class InstallmentsService {
  private readonly logger = new Logger(InstallmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  async overview(horizon = DEFAULT_HORIZON): Promise<InstallmentsOverview> {
    const month = monthKey(new Date());
    const charges = await this.charges(month);
    const plans = buildPlans(charges, month);

    const monthly = monthlySchedule(plans, month, horizon);
    const committedTotal = committedFrom(plans, month);
    const monthlyIncome = await this.typicalIncome(month);

    const current = monthly[0] ?? null;
    const endings = plans.map((p) => p.endsOn).sort();

    this.logger.log(
      `${plans.length} parcelamento(s) em aberto, ${committedTotal.toFixed(2)} comprometido.`,
    );

    return {
      month,
      plans,
      monthly,
      committedTotal,
      nextMonth: monthly[1] ?? null,
      monthlyIncome,
      currentSharePct:
        monthlyIncome && monthlyIncome > 0 && current
          ? Math.round((current.amount / monthlyIncome) * 1000) / 10
          : null,
      freeFrom: endings.length ? addMonths(endings[endings.length - 1], 1) : null,
    };
  }

  // ---------------------------------------------------------------------------

  /** Parcelas ja cobradas nos cartoes, dentro da janela de leitura. */
  private async charges(month: string): Promise<InstallmentCharge[]> {
    const [year, m] = addMonths(month, -LOOKBACK_MONTHS).split('-').map(Number);
    const rows = await this.prisma.transaction.findMany({
      where: {
        date: { gte: new Date(Date.UTC(year, m - 1, 1)) },
        account: { type: 'CREDIT' },
      },
      include: {
        account: { select: { name: true, marketingName: true } },
      },
      orderBy: { date: 'asc' },
    });

    const out: InstallmentCharge[] = [];
    for (const row of rows) {
      // Estornos e pagamentos entram como CREDIT: nao sao parcela de compra.
      if (row.type === 'CREDIT') continue;

      const description = row.description ?? row.descriptionRaw ?? '';
      const parsed = parseInstallment(description);

      // O metadata da Pluggy manda quando existe; a descricao e o plano B.
      const number = row.installmentNumber ?? parsed?.number ?? null;
      const total = row.totalInstallments ?? parsed?.total ?? null;
      if (number == null || total == null || total < 2 || number > total) continue;

      out.push({
        id: row.id,
        accountId: row.accountId,
        accountName:
          row.account.marketingName ?? row.account.name ?? 'cartão',
        date: row.date,
        description: parsed?.description ?? description,
        amount: Math.abs(Number(row.amount)),
        number,
        total,
        totalAmount:
          row.installmentTotalAmount != null
            ? Number(row.installmentTotalAmount)
            : null,
      });
    }
    return out;
  }

  /**
   * Renda mensal de referencia: mediana dos meses recentes com entrada.
   *
   * So responde quando a analise considera a renda confiavel. Em extrato onde
   * o salario cai como transferencia, a "renda" detectada e um troco — e
   * dividir a parcela por ela produziria "180% da sua renda", que assusta sem
   * informar. O mes corrente tambem fica de fora: no dia 5 ele ainda esta
   * incompleto.
   */
  private async typicalIncome(month: string): Promise<number | null> {
    const previous = addMonths(month, -1);
    const report = await this.analytics.report(previous).catch(() => null);
    if (!report?.data.dataQuality.incomeReliable) return null;

    const series = await this.analytics.series(6).catch(() => []);
    const incomes = series
      .slice(0, -1)
      .map((p) => p.income)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    if (!incomes.length) return null;
    return incomes[Math.floor(incomes.length / 2)];
  }
}

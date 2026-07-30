import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { groupOf } from './category-groups';
import {
  Balances,
  computeAnalytics,
  computeMonthlySeries,
  monthKey,
} from './analytics.metrics';
import { RuleBasedNarrator, InsightNarrator } from './narrator';
import { AnalyticsReport, MonthPoint, Tx } from './analytics.types';

/**
 * Tudo que foi calculado sobre uma mesma foto do banco.
 *
 * Carregar e normalizar o extrato inteiro e a parte cara da analise, e o
 * resultado so muda quando chega transacao nova. Guardamos por "impressao
 * digital" da tabela (quantidade + ultima alteracao): enquanto ela nao muda,
 * o cache vale; qualquer sync ou lancamento manual a altera e invalida tudo
 * sozinho, sem o servico de sync precisar avisar ninguem.
 */
interface Snapshot {
  fingerprint: string;
  tx: Tx[];
  months: string[];
  reports: Map<string, AnalyticsReport>;
  series: Map<number, MonthPoint[]>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  // Trocar por um AiNarrator (Claude) no futuro — mesma interface.
  private readonly narrator: InsightNarrator = new RuleBasedNarrator();
  private snapshot: Snapshot | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gera o relatorio completo de um mes (default: ultimo mes com dados).
   * accountId opcional restringe a uma conta.
   */
  async report(month?: string, accountId?: string): Promise<AnalyticsReport> {
    const snap = await this.snapshotFor(accountId);
    if (!snap.tx.length)
      throw new NotFoundException(
        'Nenhuma transacao encontrada. Rode o sync de um item antes de analisar.',
      );

    const targetMonth = month ?? snap.months[snap.months.length - 1];

    const cached = snap.reports.get(targetMonth);
    if (cached) return cached;

    this.logger.log(
      `Analise do mes ${targetMonth} sobre ${snap.tx.length} transacoes${accountId ? ` (conta ${accountId})` : ''}.`,
    );
    const data = computeAnalytics(snap.tx, targetMonth, await this.balances(accountId));
    const report = { data, narrative: this.narrator.narrate(data) };
    snap.reports.set(targetMonth, report);
    return report;
  }

  /** Lista os meses disponiveis (para o cliente escolher). */
  async availableMonths(accountId?: string): Promise<string[]> {
    return (await this.snapshotFor(accountId)).months;
  }

  /**
   * Serie dos ultimos N meses com renda, consumo e categorias ja agregados.
   * Os graficos do cliente consomem isto em vez de baixar as transacoes e
   * refazer a classificacao — e a mesma regra do relatorio, entao os numeros
   * batem em todas as telas.
   */
  async series(months = 12, accountId?: string): Promise<MonthPoint[]> {
    const snap = await this.snapshotFor(accountId);
    if (!snap.tx.length) return [];

    const cached = snap.series.get(months);
    if (cached) return cached;

    const computed = computeMonthlySeries(snap.tx, snap.months.slice(-months));
    snap.series.set(months, computed);
    return computed;
  }

  // ---------------------------------------------------------------------------

  /**
   * Saldos que a analise usa. Fatura de cartao (type CREDIT) fica de fora dos
   * dois: e divida, nao dinheiro disponivel.
   *
   * `bank` e so a conta corrente — e o que paga as contas do mes. `liquid`
   * soma os investimentos ativos, que servem de reserva mas nao entram na
   * projecao do dia a dia.
   */
  private async balances(accountId?: string): Promise<Balances> {
    const [accounts, investments] = await Promise.all([
      this.prisma.account.findMany({
        where: { type: 'BANK', id: accountId || undefined },
        select: { balance: true },
      }),
      accountId
        ? Promise.resolve([])
        : this.prisma.investment.findMany({
            where: { status: { not: 'TOTAL_WITHDRAWAL' } },
            select: { balance: true },
          }),
    ]);
    const total = (rows: { balance: unknown }[]) =>
      rows.reduce((sum, row) => sum + Number(row.balance ?? 0), 0);

    const bank = total(accounts);
    return { bank, liquid: bank + total(investments) };
  }

  /** Foto atual do extrato, reaproveitada enquanto o banco nao mudar. */
  private async snapshotFor(accountId?: string): Promise<Snapshot> {
    const fingerprint = await this.fingerprint(accountId);
    if (this.snapshot?.fingerprint === fingerprint) return this.snapshot;

    const tx = await this.loadTransactions(accountId);
    this.snapshot = {
      fingerprint,
      tx,
      months: [...new Set(tx.map((t) => monthKey(t.date)))].sort(),
      reports: new Map(),
      series: new Map(),
    };
    this.logger.log(`Extrato recarregado: ${tx.length} transacoes.`);
    return this.snapshot;
  }

  /**
   * Identifica o estado da tabela com uma unica agregacao. Qualquer insercao,
   * edicao ou remocao muda a contagem ou a data de atualizacao mais recente.
   */
  private async fingerprint(accountId?: string): Promise<string> {
    const agg = await this.prisma.transaction.aggregate({
      where: { accountId: accountId || undefined },
      _count: { _all: true },
      _max: { updatedAt: true },
    });
    return [
      accountId ?? 'all',
      agg._count._all,
      agg._max.updatedAt?.getTime() ?? 0,
    ].join(':');
  }

  private async loadTransactions(accountId?: string): Promise<Tx[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { accountId: accountId || undefined },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => {
      // Normaliza o sinal pelo tipo: em cartao de credito as compras chegam
      // como DEBIT positivo; saida de dinheiro e sempre negativa na analise.
      const raw = Number(r.amount);
      const amount =
        r.type === 'DEBIT'
          ? -Math.abs(raw)
          : r.type === 'CREDIT'
            ? Math.abs(raw)
            : raw;
      const { group, uncertain } = groupOf(r.category, amount);
      return {
        id: r.id,
        accountId: r.accountId,
        date: r.date,
        amount,
        category: r.category ?? '(sem categoria)',
        description: r.description ?? r.descriptionRaw ?? '',
        type: r.type,
        group,
        uncertain,
      };
    });
  }
}

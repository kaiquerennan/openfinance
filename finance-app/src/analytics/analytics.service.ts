import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { groupOf } from './category-groups';
import { computeAnalytics, computeMonthlySeries, monthKey } from './analytics.metrics';
import { RuleBasedNarrator, InsightNarrator } from './narrator';
import { AnalyticsReport, MonthPoint, Tx } from './analytics.types';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  // Trocar por um AiNarrator (Claude) no futuro — mesma interface.
  private readonly narrator: InsightNarrator = new RuleBasedNarrator();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gera o relatorio completo de um mes (default: ultimo mes com dados).
   * accountId opcional restringe a uma conta.
   */
  async report(month?: string, accountId?: string): Promise<AnalyticsReport> {
    const tx = await this.loadTransactions(accountId);
    if (!tx.length)
      throw new NotFoundException(
        'Nenhuma transacao encontrada. Rode o sync de um item antes de analisar.',
      );

    const targetMonth = month ?? this.latestMonth(tx);
    this.logger.log(
      `Analise do mes ${targetMonth} sobre ${tx.length} transacoes${accountId ? ` (conta ${accountId})` : ''}.`,
    );

    const data = computeAnalytics(tx, targetMonth);
    const narrative = this.narrator.narrate(data);
    return { data, narrative };
  }

  /** Lista os meses disponiveis (para o cliente escolher). */
  async availableMonths(accountId?: string): Promise<string[]> {
    const tx = await this.loadTransactions(accountId);
    return [...new Set(tx.map((t) => monthKey(t.date)))].sort();
  }

  /**
   * Serie dos ultimos N meses com renda, consumo e categorias ja agregados.
   * Os graficos do cliente consomem isto em vez de baixar as transacoes e
   * refazer a classificacao — e a mesma regra do relatorio, entao os numeros
   * batem em todas as telas.
   */
  async series(months = 12, accountId?: string): Promise<MonthPoint[]> {
    const tx = await this.loadTransactions(accountId);
    if (!tx.length) return [];
    const available = [...new Set(tx.map((t) => monthKey(t.date)))].sort();
    return computeMonthlySeries(tx, available.slice(-months));
  }

  // ---------------------------------------------------------------------------

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

  private latestMonth(tx: Tx[]): string {
    return tx.map((t) => monthKey(t.date)).sort().slice(-1)[0];
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CategoryRule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Correcao de categoria.
 *
 * A categoria que vem do Open Finance erra com frequencia, e ela alimenta
 * orcamento, analise, divisao essencial/estilo de vida e indice de saude —
 * um mercado classificado como "compras" nao e um detalhe visual, e um numero
 * errado em todas as telas.
 *
 * A correcao e materializada em `Transaction.categoryOverride` em vez de ser
 * resolvida na leitura: assim filtro por categoria, paginacao e agregacao
 * continuam sendo uma consulta so, e a categoria corrigida e a mesma em todo
 * lugar que le o extrato.
 */
@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  rules(): Promise<CategoryRule[]> {
    return this.prisma.categoryRule.findMany({ orderBy: { createdAt: 'asc' } });
  }

  /** Cria (ou atualiza) uma regra e ja corrige o que esta no banco. */
  async createRule(pattern: string, category: string): Promise<CategoryRule> {
    const key = pattern.trim().toLowerCase();
    const rule = await this.prisma.categoryRule.upsert({
      where: { pattern: key },
      create: { pattern: key, category },
      update: { category },
    });
    const affected = await this.applyRule(rule);
    this.logger.log(
      `Regra "${key}" -> ${category}: ${affected} transacao(oes) recategorizada(s).`,
    );
    return rule;
  }

  /** Remove a regra e devolve as transacoes dela a categoria original. */
  async deleteRule(id: string): Promise<{ deleted: string; restored: number }> {
    const rule = await this.prisma.categoryRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Regra nao encontrada');

    const { count } = await this.prisma.transaction.updateMany({
      where: { categoryRuleId: id },
      data: { categoryOverride: null, categoryRuleId: null },
    });
    await this.prisma.categoryRule.delete({ where: { id } });

    // Outra regra pode cobrir as mesmas transacoes; reaplicar evita deixar na
    // categoria errada algo que continua tendo regra.
    await this.applyRules();
    return { deleted: id, restored: count };
  }

  /**
   * Corrige a categoria de uma transacao especifica. `category` nulo desfaz a
   * correcao e devolve o que a Pluggy tinha classificado.
   */
  async setCategory(transactionId: string, category: string | null) {
    const exists = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Transacao nao encontrada');

    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        categoryOverride: category?.trim().toLowerCase() ?? null,
        categoryRuleId: null,
      },
    });
  }

  /**
   * Corrige a categoria de uma transacao e, com `applyToAll`, transforma a
   * descricao dela em regra — quem corrigiu "Padaria X" uma vez nao quer
   * corrigir a mesma padaria de novo no mes que vem.
   */
  async correct(
    transactionId: string,
    category: string | null,
    applyToAll = false,
  ) {
    if (!applyToAll || !category) {
      return this.setCategory(transactionId, category);
    }

    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { description: true, descriptionRaw: true },
    });
    if (!tx) throw new NotFoundException('Transacao nao encontrada');

    const pattern = (tx.description ?? tx.descriptionRaw ?? '').trim();
    if (pattern.length < 2) return this.setCategory(transactionId, category);

    // Limpa a correcao manual antes: ela e justamente o que a regra nao
    // sobrescreve, e sem isto a transacao de origem ficaria de fora da propria
    // regra que ela criou.
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { categoryOverride: null, categoryRuleId: null },
    });
    await this.createRule(pattern, category);

    return this.prisma.transaction.findUnique({ where: { id: transactionId } });
  }

  /**
   * Reaplica todas as regras. Roda depois de cada sync, senao a transacao que
   * chegou hoje voltaria com a categoria errada da instituicao.
   *
   * Ordem de criacao: a regra mais nova ganha quando duas casam com a mesma
   * descricao.
   */
  async applyRules(): Promise<number> {
    const rules = await this.rules();
    let total = 0;
    for (const rule of rules) total += await this.applyRule(rule);
    if (total) this.logger.log(`Regras aplicadas: ${total} transacao(oes).`);
    return total;
  }

  // ---------------------------------------------------------------------------

  /**
   * Aplica uma regra ao extrato inteiro.
   *
   * Nao toca em correcao feita a mao (override sem regra): quem corrigiu uma
   * transacao especifica decidiu sobre ela, e uma regra generica nao deve
   * desfazer essa decisao.
   */
  private async applyRule(rule: CategoryRule): Promise<number> {
    const contains = { contains: rule.pattern, mode: 'insensitive' as const };
    const { count } = await this.prisma.transaction.updateMany({
      where: {
        AND: [
          { OR: [{ description: contains }, { descriptionRaw: contains }] },
          { OR: [{ categoryOverride: null }, { categoryRuleId: { not: null } }] },
        ],
      },
      data: { categoryOverride: rule.category, categoryRuleId: rule.id },
    });
    return count;
  }
}

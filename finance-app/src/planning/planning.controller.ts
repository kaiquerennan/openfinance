import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { groupOf } from '../analytics/category-groups';
import { monthKey } from '../analytics/timezone';
import {
  AddGoalEntryDto,
  CreateGoalDto,
  UpdateGoalDto,
  DecideSuggestionDto,
  UpsertBudgetDto,
} from './planning.dto';

/** Janela de dias em que uma aplicacao ainda vale como sugestao de aporte. */
const SUGGESTION_WINDOW_DAYS = 60;

/**
 * Sinal economico do valor. Compras de cartao chegam como DEBIT positivo,
 * entao o sinal vem do tipo, nao do numero (mesma regra do AnalyticsService).
 */
function signedAmount(amount: unknown, type: string | null): number {
  const raw = Number(amount);
  if (type === 'DEBIT') return -Math.abs(raw);
  if (type === 'CREDIT') return Math.abs(raw);
  return raw;
}

@Controller()
export class PlanningController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /budgets — todos os limites (o geral vem em category "_global"). */
  @Get('budgets')
  budgets() {
    return this.prisma.budget.findMany({ orderBy: { category: 'asc' } });
  }

  /** PUT /budgets — cria/atualiza um limite; amount 0 remove. */
  @Put('budgets')
  async upsertBudget(@Body() dto: UpsertBudgetDto) {
    const category = dto.category.trim().toLowerCase();
    if (dto.amount === 0) {
      await this.prisma.budget.deleteMany({ where: { category } });
      return { category, amount: 0 };
    }
    return this.prisma.budget.upsert({
      where: { category },
      create: { category, amount: dto.amount },
      update: { amount: dto.amount },
    });
  }

  /** GET /goals — metas com aportes e total poupado. */
  @Get('goals')
  async goals() {
    const goals = await this.prisma.goal.findMany({
      include: { entries: { orderBy: { month: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    return goals.map((g) => ({
      ...g,
      saved:
        Number(g.initialAmount) +
        g.entries.reduce((s, e) => s + Number(e.amount), 0),
    }));
  }

  /** POST /goals — cria uma meta. */
  @Post('goals')
  createGoal(@Body() dto: CreateGoalDto) {
    return this.prisma.goal.create({
      data: {
        name: dto.name,
        icon: dto.icon ?? '🎯',
        targetAmount: dto.targetAmount,
        initialAmount: dto.initialAmount ?? 0,
        monthlyContribution: dto.monthlyContribution ?? null,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
      },
      include: { entries: true },
    });
  }

  /** PATCH /goals/:id — edita campos da meta. */
  @Patch('goals/:id')
  async updateGoal(@Param('id') id: string, @Body() dto: UpdateGoalDto) {
    const exists = await this.prisma.goal.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Meta nao encontrada');
    return this.prisma.goal.update({
      where: { id },
      data: {
        name: dto.name,
        icon: dto.icon,
        targetAmount: dto.targetAmount,
        initialAmount: dto.initialAmount,
        monthlyContribution: dto.monthlyContribution,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        status: dto.status,
      },
      include: { entries: true },
    });
  }

  /** DELETE /goals/:id — remove meta e aportes. */
  @Delete('goals/:id')
  async deleteGoal(@Param('id') id: string) {
    await this.prisma.goal.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Meta nao encontrada');
    });
    return { deleted: id };
  }

  /**
   * GET /goals/suggestions — saidas para investimento ainda nao contabilizadas
   * em nenhuma meta. E o que permite registrar um aporte com um toque em vez
   * de depender de o usuario lembrar de digitar o valor.
   */
  @Get('goals/suggestions')
  async goalSuggestions() {
    const since = new Date();
    since.setDate(since.getDate() - SUGGESTION_WINDOW_DAYS);

    const [candidates, decided] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { date: { gte: since } },
        orderBy: { date: 'desc' },
        select: {
          id: true,
          date: true,
          description: true,
          descriptionRaw: true,
          amount: true,
          type: true,
          category: true,
        },
      }),
      this.prisma.goalSuggestion.findMany({ select: { transactionId: true } }),
    ]);

    const alreadyDecided = new Set(decided.map((d) => d.transactionId));

    return candidates
      .filter((t) => !alreadyDecided.has(t.id))
      .map((t) => ({ ...t, signed: signedAmount(t.amount, t.type) }))
      .filter((t) => groupOf(t.category, t.signed).group === 'investment' && t.signed < 0)
      .map((t) => ({
        transactionId: t.id,
        date: t.date,
        description: t.description ?? t.descriptionRaw ?? 'Aplicação',
        amount: Math.abs(t.signed),
        month: monthKey(t.date),
      }));
  }

  /**
   * POST /goals/suggestions/:transactionId — decide uma sugestao.
   * Com goalId, soma o valor como aporte da meta naquele mes; sem goalId,
   * apenas marca como dispensada para nao aparecer de novo.
   */
  @Post('goals/suggestions/:transactionId')
  async decideSuggestion(
    @Param('transactionId') transactionId: string,
    @Body() dto: DecideSuggestionDto,
  ) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx) throw new NotFoundException('Transacao nao encontrada');

    if (!dto.goalId) {
      await this.prisma.goalSuggestion.upsert({
        where: { transactionId },
        create: { transactionId, goalId: null },
        update: { goalId: null },
      });
      return { dismissed: transactionId };
    }

    const goal = await this.prisma.goal.findUnique({ where: { id: dto.goalId } });
    if (!goal) throw new NotFoundException('Meta nao encontrada');

    const month = monthKey(tx.date);
    const value = Math.abs(signedAmount(tx.amount, tx.type));
    const existing = await this.prisma.goalEntry.findUnique({
      where: { goalId_month: { goalId: dto.goalId, month } },
    });
    const amount = Number(existing?.amount ?? 0) + value;

    // O aporte e a marca de "ja tratado" precisam ir juntos: se so um deles
    // fosse gravado, a mesma transacao poderia ser somada duas vezes.
    const [entry] = await this.prisma.$transaction([
      this.prisma.goalEntry.upsert({
        where: { goalId_month: { goalId: dto.goalId, month } },
        create: { goalId: dto.goalId, month, amount },
        update: { amount },
      }),
      this.prisma.goalSuggestion.upsert({
        where: { transactionId },
        create: { transactionId, goalId: dto.goalId },
        update: { goalId: dto.goalId },
      }),
    ]);
    return entry;
  }

  /** POST /goals/:id/entries — soma um aporte ao mes informado. */
  @Post('goals/:id/entries')
  async addEntry(@Param('id') id: string, @Body() dto: AddGoalEntryDto) {
    const goal = await this.prisma.goal.findUnique({ where: { id } });
    if (!goal) throw new NotFoundException('Meta nao encontrada');
    const existing = await this.prisma.goalEntry.findUnique({
      where: { goalId_month: { goalId: id, month: dto.month } },
    });
    const amount = Number(existing?.amount ?? 0) + dto.amount;
    return this.prisma.goalEntry.upsert({
      where: { goalId_month: { goalId: id, month: dto.month } },
      create: { goalId: id, month: dto.month, amount },
      update: { amount },
    });
  }
}

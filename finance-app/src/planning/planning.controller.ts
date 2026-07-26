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
import {
  AddGoalEntryDto,
  CreateGoalDto,
  UpdateGoalDto,
  UpsertBudgetDto,
} from './planning.dto';

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

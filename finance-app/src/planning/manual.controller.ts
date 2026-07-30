import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

const MANUAL_ITEM_ID = 'manual-item';
const MANUAL_ACCOUNT_ID = 'manual-wallet';

export class CreateManualTxDto {
  @IsString()
  @MaxLength(120)
  description: string;

  /** Valor positivo. O sinal e derivado de kind. */
  @IsNumber()
  amount: number;

  @IsIn(['expense', 'income'])
  kind: 'expense' | 'income';

  /** Data ISO YYYY-MM-DD. */
  @IsString()
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;
}

/** Lancamentos manuais na conta "Carteira" (fora do Open Finance). */
@Controller('manual')
export class ManualController {
  constructor(private readonly prisma: PrismaService) {}

  /** Garante que o Item/Account da Carteira existam. */
  private async ensureWallet() {
    await this.prisma.item.upsert({
      where: { id: MANUAL_ITEM_ID },
      create: {
        id: MANUAL_ITEM_ID,
        connectorId: 0,
        connectorName: 'Carteira',
        status: 'MANUAL',
      },
      update: {},
    });
    return this.prisma.account.upsert({
      where: { id: MANUAL_ACCOUNT_ID },
      create: {
        id: MANUAL_ACCOUNT_ID,
        itemId: MANUAL_ITEM_ID,
        type: 'BANK',
        subtype: 'MANUAL',
        name: 'Carteira',
        marketingName: 'Conta manual',
        balance: 0,
        currencyCode: 'BRL',
      },
      update: {},
    });
  }

  /** GET /manual/account — a conta Carteira (cria se nao existir). */
  @Get('account')
  account() {
    return this.ensureWallet();
  }

  /**
   * POST /manual/transactions — registra despesa/receita manual.
   *
   * O lancamento e o ajuste de saldo vao na mesma transacao de banco: se um
   * dos dois falhar, nenhum e aplicado. Separados, uma falha no meio deixaria
   * o saldo da Carteira errado de forma permanente, sem como reconciliar.
   */
  @Post('transactions')
  async create(@Body() dto: CreateManualTxDto) {
    await this.ensureWallet();
    const signed =
      dto.kind === 'expense' ? -Math.abs(dto.amount) : Math.abs(dto.amount);

    const [tx] = await this.prisma.$transaction([
      this.prisma.transaction.create({
        data: {
          id: randomUUID(),
          accountId: MANUAL_ACCOUNT_ID,
          // meio-dia em Brasilia: a data escolhida nao escorrega de dia
          // ao ser lida em qualquer fuso
          date: new Date(`${dto.date}T15:00:00Z`),
          description: dto.description,
          amount: signed,
          currencyCode: 'BRL',
          type: signed < 0 ? 'DEBIT' : 'CREDIT',
          category: dto.category ?? null,
          status: 'POSTED',
        },
      }),
      this.prisma.account.update({
        where: { id: MANUAL_ACCOUNT_ID },
        data: { balance: { increment: signed } },
      }),
    ]);
    return tx;
  }

  /** DELETE /manual/transactions/:id — remove lancamento manual. */
  @Delete('transactions/:id')
  async remove(@Param('id') id: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException('Transacao nao encontrada');
    if (tx.accountId !== MANUAL_ACCOUNT_ID)
      throw new ForbiddenException('Apenas lancamentos manuais podem ser removidos');
    await this.prisma.$transaction([
      this.prisma.transaction.delete({ where: { id } }),
      this.prisma.account.update({
        where: { id: MANUAL_ACCOUNT_ID },
        data: { balance: { decrement: Number(tx.amount) } },
      }),
    ]);
    return { deleted: id };
  }
}

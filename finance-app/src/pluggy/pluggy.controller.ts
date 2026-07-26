import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PluggyService } from './pluggy.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('pluggy')
export class PluggyController {
  constructor(
    private readonly pluggy: PluggyService,
    private readonly prisma: PrismaService,
  ) {}

  /** GET /pluggy/connectors — lista conectores (confirma MeuPluggy id 200). */
  @Get('connectors')
  getConnectors() {
    return this.pluggy.getConnectors();
  }

  /** POST /pluggy/connect-token — token de curta duracao para o widget. */
  @Post('connect-token')
  createConnectToken() {
    return this.pluggy.createConnectToken();
  }

  /**
   * GET /pluggy/items — lista os Items que JA sincronizamos (do nosso banco).
   * A Pluggy nao oferece "listar items"; semeie um novo via sync de um itemId.
   */
  @Get('items')
  getItems() {
    return this.prisma.item.findMany({
      include: { _count: { select: { accounts: true } } },
      orderBy: { lastSyncedAt: 'desc' },
    });
  }

  /** GET /pluggy/items/:itemId — detalhes ao vivo de um Item na Pluggy. */
  @Get('items/:itemId')
  getItemLive(@Param('itemId') itemId: string) {
    return this.pluggy.getItem(itemId);
  }

  /** GET /pluggy/items/:itemId/accounts — contas de um Item. */
  @Get('items/:itemId/accounts')
  getAccounts(@Param('itemId') itemId: string) {
    return this.pluggy.getAccounts(itemId);
  }

  /**
   * GET /pluggy/items/:itemId/transactions — transacoes de todas as contas
   * do Item. Aceita ?from=YYYY-MM-DD e ?to=YYYY-MM-DD opcionais.
   */
  @Get('items/:itemId/transactions')
  getTransactions(
    @Param('itemId') itemId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.pluggy.getTransactionsByItem(itemId, from, to);
  }
}

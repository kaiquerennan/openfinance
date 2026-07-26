import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncService } from './sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { PluggyWebhookPayload } from '../pluggy/pluggy.types';

/** Eventos de webhook que devem disparar uma sincronizacao do item. */
const WEBHOOK_EVENTS_TO_SYNC = new Set([
  'item/created',
  'item/updated',
  'item/login_succeeded',
  'transactions/created',
  'transactions/updated',
  'transactions/deleted',
]);

@Controller('pluggy')
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(
    private readonly sync: SyncService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** POST /pluggy/items/:itemId/sync — puxa item+contas+transacoes pro Postgres. */
  @Post('items/:itemId/sync')
  syncItem(
    @Param('itemId') itemId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.sync.syncItem(itemId, from, to);
  }

  /** POST /pluggy/sync — sincroniza todos os Items de uma vez. */
  @Post('sync')
  syncAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.sync.syncAll(from, to);
  }

  /**
   * POST /pluggy/webhook — recebe eventos da Pluggy (item/created,
   * transactions/created, etc). Responde 200 de imediato e sincroniza o
   * item em segundo plano, sem bloquear (a Pluggy exige 2XX em <5s e
   * reenvia em caso de falha/timeout).
   *
   * Se PLUGGY_WEBHOOK_SECRET estiver definido no .env, exige o mesmo valor
   * no header X-Webhook-Secret (configurável como header customizado ao
   * registrar o webhook no dashboard da Pluggy).
   */
  @Post('webhook')
  @HttpCode(200)
  handleWebhook(
    @Body() payload: PluggyWebhookPayload,
    @Headers('x-webhook-secret') secretHeader?: string,
  ) {
    const expectedSecret = this.config.get<string>('PLUGGY_WEBHOOK_SECRET');
    if (expectedSecret && secretHeader !== expectedSecret) {
      throw new UnauthorizedException('Webhook secret invalido');
    }

    this.logger.log(
      `Webhook recebido: ${payload.event} (item ${payload.itemId ?? '-'})`,
    );

    if (WEBHOOK_EVENTS_TO_SYNC.has(payload.event) && payload.itemId) {
      const itemId = payload.itemId;
      this.sync.syncItem(itemId).catch((err) => {
        this.logger.error(
          `Falha ao sincronizar item ${itemId} via webhook (${payload.event}): ${(err as Error).message}`,
        );
      });
    }

    return { received: true };
  }

  /** GET /pluggy/db/accounts — contas persistidas com saldo e banco de origem. */
  @Get('db/accounts')
  dbAccounts() {
    return this.prisma.account.findMany({
      include: {
        item: { select: { connectorName: true, lastSyncedAt: true } },
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** GET /pluggy/db/transactions — transacoes persistidas, com filtros opcionais. */
  @Get('db/transactions')
  async dbTransactions(
    @Query('accountId') accountId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const where = {
      accountId: accountId || undefined,
      category: category ? { equals: category, mode: 'insensitive' as const } : undefined,
      description: search ? { contains: search, mode: 'insensitive' as const } : undefined,
      date: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    };
    const [total, transactions] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        include: {
          account: {
            select: {
              name: true,
              marketingName: true,
              type: true,
              item: { select: { connectorName: true } },
            },
          },
        },
        orderBy: { date: 'desc' },
        take: Math.min(Number(take) || 200, 1000),
        skip: Number(skip) || 0,
      }),
    ]);
    return { total, transactions };
  }
}

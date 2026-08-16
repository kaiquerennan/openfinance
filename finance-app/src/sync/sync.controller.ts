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
import { Public } from '../auth/public.decorator';
import { AlertsService } from '../alerts/alerts.service';
import {
  isYieldAccount,
  yieldAccountAsInvestment,
} from '../shared/yield-accounts';
import { resolvedCategory } from '../shared/category';

/** Teto de itens por pagina em GET /pluggy/db/transactions. */
const MAX_PAGE_SIZE = 1000;

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
    private readonly alerts: AlertsService,
  ) {}

  /**
   * Roda a sincronizacao e, no fim, avalia os alertas. E o unico momento em
   * que os dados acabaram de mudar — avisar aqui e o que faz o app procurar o
   * usuario em vez de esperar que ele abra a tela.
   */
  private syncThenAlert(label: string, from?: string, to?: string): void {
    this.sync
      .syncAll(from, to)
      .then(() => this.alerts.run())
      .catch((err) => {
        this.logger.error(`Falha no sync (${label}): ${(err as Error).message}`);
      });
  }

  /**
   * POST /pluggy/items/:itemId/sync — puxa item+contas+transacoes+investimentos
   * pro Postgres. Responde na hora e roda em segundo plano: um sync completo
   * pode levar bem mais que o timeout do proxy da Vercel, entao nao da pra
   * esperar o resultado na mesma requisicao.
   */
  @Post('items/:itemId/sync')
  @HttpCode(202)
  syncItem(
    @Param('itemId') itemId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.sync.syncItem(itemId, from, to).catch((err) => {
      this.logger.error(
        `Falha ao sincronizar item ${itemId}: ${(err as Error).message}`,
      );
    });
    return { started: true, itemId };
  }

  /**
   * POST /pluggy/sync — sincroniza todos os Items de uma vez, em segundo
   * plano (mesma razao do endpoint acima).
   */
  @Post('sync')
  @HttpCode(202)
  syncAll(@Query('from') from?: string, @Query('to') to?: string) {
    this.syncThenAlert('sync geral', from, to);
    return { started: true };
  }

  /**
   * POST /pluggy/sync/trigger — mesma coisa que POST /pluggy/sync, mas
   * publica (sem cookie de sessao) e protegida por um segredo proprio
   * (SYNC_TRIGGER_SECRET, header X-Sync-Secret). Feita pra ser chamada por
   * um agendador externo (ex.: GitHub Actions), ja que no plano free do
   * Render o processo dorme e o @Cron interno para de disparar.
   */
  @Public()
  @Post('sync/trigger')
  @HttpCode(202)
  syncTrigger(@Headers('x-sync-secret') secretHeader?: string) {
    const expectedSecret = this.config.get<string>('SYNC_TRIGGER_SECRET');
    if (!expectedSecret) {
      throw new UnauthorizedException('SYNC_TRIGGER_SECRET nao configurado no servidor');
    }
    if (secretHeader !== expectedSecret) {
      throw new UnauthorizedException('Segredo invalido');
    }
    this.logger.log('Sync disparado via /pluggy/sync/trigger (agendador externo)');
    this.syncThenAlert('trigger externo');
    return { started: true };
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
  @Public()
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

  /**
   * GET /pluggy/db/investments — posicoes de investimento persistidas
   * (saldo real reportado pela instituicao, com rendimento ja embutido).
   * Considera "ativa" toda posicao cujo status nao seja de resgate total.
   *
   * Junto vem o saldo das contas remuneradas (ver `isYieldAccount`), que a
   * Pluggy entrega como conta corrente mas rende feito investimento.
   */
  @Get('db/investments')
  async dbInvestments() {
    const withItem = {
      item: { select: { connectorName: true, lastSyncedAt: true } },
    };
    const [investments, accounts] = await Promise.all([
      this.prisma.investment.findMany({ include: withItem }),
      this.prisma.account.findMany({
        where: { type: 'BANK' },
        include: withItem,
      }),
    ]);
    const active = [
      ...investments.filter((i) => i.status !== 'TOTAL_WITHDRAWAL'),
      ...accounts.filter(isYieldAccount).map(yieldAccountAsInvestment),
    ].sort((a, b) => Number(b.balance ?? 0) - Number(a.balance ?? 0));
    const total = active.reduce((sum, i) => sum + Number(i.balance ?? 0), 0);
    return { total, investments: active };
  }

  /**
   * GET /pluggy/db/transactions — transacoes persistidas, com filtros opcionais.
   *
   * A resposta traz `total` (quantas existem no filtro) e `hasMore`, para o
   * cliente saber que a pagina foi cortada em vez de assumir que recebeu tudo
   * e exibir um total menor que o real sem nenhum aviso.
   */
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
    // Filtrar por categoria tem que enxergar a correcao do usuario: a
    // transacao corrigida sai da categoria antiga e entra na nova, senao a
    // lista contradiz o total que a analise mostra.
    const insensitive = (value: string) => ({
      equals: value,
      mode: 'insensitive' as const,
    });
    const where = {
      accountId: accountId || undefined,
      description: search ? { contains: search, mode: 'insensitive' as const } : undefined,
      date: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
      ...(category
        ? {
            OR: [
              { categoryOverride: insensitive(category) },
              {
                AND: [
                  { categoryOverride: null },
                  { category: insensitive(category) },
                ],
              },
            ],
          }
        : {}),
    };
    const limit = Math.min(Number(take) || 200, MAX_PAGE_SIZE);
    const offset = Number(skip) || 0;
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
        take: limit,
        skip: offset,
      }),
    ]);
    const resolved = transactions.map((t) => ({
      ...t,
      category: resolvedCategory(t),
    }));
    const hasMore = offset + transactions.length < total;
    if (hasMore) {
      this.logger.warn(
        `Consulta de transacoes truncada: ${transactions.length} de ${total} (take=${limit}, skip=${offset}).`,
      );
    }
    return { total, transactions: resolved, hasMore };
  }
}

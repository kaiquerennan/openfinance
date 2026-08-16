import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PluggyService, PluggyAccount } from '../pluggy/pluggy.service';
import { CategoriesService } from '../categories/categories.service';
import {
  PluggyAccountFull,
  PluggyBill,
  PluggyInvestment,
  PluggyItem,
  PluggyTransaction,
} from '../pluggy/pluggy.types';

/** Quantas transacoes processar por lote (evita $transaction gigante). */
const TX_CHUNK = 100;

/**
 * Dados de parcelamento da transacao.
 *
 * Guardamos o que a Pluggy manda em `creditCardMetadata`; quando o emissor nao
 * preenche, quem le a parcela e a analise, a partir da descricao. Persistir
 * aqui o que veio pronto evita reinterpretar texto quando a informacao ja
 * chegou estruturada.
 */
function installmentOf(t: PluggyTransaction) {
  const meta = t.creditCardMetadata;
  const number = meta?.installmentNumber ?? null;
  const total = meta?.totalInstallments ?? null;
  return {
    installmentNumber: number,
    totalInstallments: total,
    installmentTotalAmount:
      meta?.totalAmount != null ? new Prisma.Decimal(meta.totalAmount) : null,
    billId: meta?.billId ?? null,
  };
}

export interface AccountSyncResult {
  accountId: string;
  name?: string;
  transactionsSynced: number;
}

export interface ItemSyncResult {
  itemId: string;
  connector: string;
  status: string;
  accounts: AccountSyncResult[];
  totalTransactions: number;
  investmentsSynced: number;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly pluggy: PluggyService,
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

  /** Sincroniza um Item: dados do item, contas e todas as transacoes. */
  async syncItem(
    itemId: string,
    from?: string,
    to?: string,
  ): Promise<ItemSyncResult> {
    this.logger.log(`Iniciando sync do item ${itemId}`);

    const item = await this.pluggy.getItem(itemId);
    await this.upsertItem(item);

    const accountsResp = await this.pluggy.getAccounts(itemId);
    const accounts = (accountsResp.results ?? []) as PluggyAccount[];

    const accountResults: AccountSyncResult[] = [];
    for (const acc of accounts) {
      const account = acc as unknown as PluggyAccountFull;
      await this.upsertAccount(itemId, account);

      const txs = await this.pluggy.getAllTransactionsByAccount(
        account.id,
        from,
        to,
      );
      await this.upsertTransactions(account.id, txs);

      if (account.type === 'CREDIT') await this.syncBills(account.id);

      accountResults.push({
        accountId: account.id,
        name: account.name,
        transactionsSynced: txs.length,
      });
      this.logger.log(
        `Conta ${account.id} (${account.name ?? '-'}): ${txs.length} transacoes`,
      );
    }

    const totalTransactions = accountResults.reduce(
      (sum, a) => sum + a.transactionsSynced,
      0,
    );

    let investmentsSynced = 0;
    try {
      const investmentsResp = await this.pluggy.getInvestments(itemId);
      const investments = investmentsResp.results ?? [];
      await this.upsertInvestments(itemId, investments);
      investmentsSynced = investments.length;
    } catch (err) {
      // Nem todo conector expoe investimentos; nao deve derrubar o sync do item.
      this.logger.warn(
        `Sem investimentos para o item ${itemId}: ${(err as Error).message}`,
      );
    }

    // Transacao nova chega com a categoria da instituicao; sem reaplicar as
    // regras aqui, o mercado que o usuario ja corrigiu voltaria errado todo mes.
    await this.categories.applyRules().catch((err) => {
      this.logger.warn(
        `Falha ao reaplicar regras de categoria: ${(err as Error).message}`,
      );
    });

    this.logger.log(
      `Sync do item ${itemId} concluido: ${accounts.length} contas, ${totalTransactions} transacoes, ${investmentsSynced} investimentos.`,
    );

    return {
      itemId,
      connector: item.connector?.name ?? 'desconhecido',
      status: item.status,
      accounts: accountResults,
      totalTransactions,
      investmentsSynced,
    };
  }

  /**
   * Re-sincroniza todos os Items que JA conhecemos (estao no nosso Postgres).
   * A Pluggy nao tem "listar items"; o primeiro item de cada conexao precisa
   * ser semeado uma vez via syncItem(itemId) com um id conhecido.
   */
  async syncAll(from?: string, to?: string): Promise<ItemSyncResult[]> {
    const known = await this.prisma.item.findMany({ select: { id: true } });
    this.logger.log(
      `Sync geral: ${known.length} item(ns) conhecido(s) no banco.`,
    );

    const results: ItemSyncResult[] = [];
    for (const it of known) {
      try {
        results.push(await this.syncItem(it.id, from, to));
      } catch (err) {
        this.logger.error(
          `Falha ao sincronizar item ${it.id}: ${(err as Error).message}`,
        );
      }
    }
    return results;
  }

  /** Sync automatico: roda syncAll() a cada 3 horas. */
  @Cron(CronExpression.EVERY_3_HOURS)
  async autoSyncAll(): Promise<void> {
    this.logger.log('Sync automatico (a cada 3h) iniciado.');
    await this.syncAll();
    this.logger.log('Sync automatico (a cada 3h) concluido.');
  }

  // ---------------------------------------------------------------------------
  // Upserts
  // ---------------------------------------------------------------------------

  private async upsertItem(item: PluggyItem): Promise<void> {
    const data = {
      connectorId: item.connector?.id ?? 0,
      connectorName: item.connector?.name ?? 'desconhecido',
      status: item.status,
      executionStatus: item.executionStatus ?? null,
      pluggyCreatedAt: item.createdAt ? new Date(item.createdAt) : null,
      pluggyUpdatedAt: item.updatedAt ? new Date(item.updatedAt) : null,
      lastSyncedAt: new Date(),
    };
    await this.prisma.item.upsert({
      where: { id: item.id },
      create: { id: item.id, ...data },
      update: data,
    });
  }

  private async upsertAccount(
    itemId: string,
    acc: PluggyAccountFull,
  ): Promise<void> {
    const credit = acc.creditData ?? null;
    const decimal = (v: number | undefined) =>
      v != null ? new Prisma.Decimal(v) : null;
    const date = (v: string | undefined) => (v ? new Date(v) : null);

    const data = {
      itemId,
      type: acc.type ?? null,
      subtype: acc.subtype ?? null,
      name: acc.name ?? null,
      marketingName: acc.marketingName ?? null,
      number: acc.number ?? null,
      balance:
        acc.balance != null ? new Prisma.Decimal(acc.balance) : null,
      currencyCode: acc.currencyCode ?? null,
      creditLimit: decimal(credit?.creditLimit),
      availableCreditLimit: decimal(credit?.availableCreditLimit),
      minimumPayment: decimal(credit?.minimumPayment),
      balanceCloseDate: date(credit?.balanceCloseDate),
      balanceDueDate: date(credit?.balanceDueDate),
      cardBrand: credit?.brand ?? null,
      cardLevel: credit?.level ?? null,
    };
    await this.prisma.account.upsert({
      where: { id: acc.id },
      create: { id: acc.id, ...data },
      update: data,
    });
  }

  /**
   * Faturas do cartao. Nem toda instituicao expoe /bills; a ausencia nao pode
   * derrubar o sync da conta, que ja trouxe saldo e transacoes.
   */
  private async syncBills(accountId: string): Promise<void> {
    try {
      const { results } = await this.pluggy.getBills(accountId);
      await this.upsertBills(accountId, results ?? []);
      this.logger.log(`Conta ${accountId}: ${results?.length ?? 0} fatura(s).`);
    } catch (err) {
      this.logger.warn(
        `Sem faturas para a conta ${accountId}: ${(err as Error).message}`,
      );
    }
  }

  private async upsertBills(
    accountId: string,
    bills: PluggyBill[],
  ): Promise<void> {
    const sum = (values: (number | undefined)[]) =>
      values.reduce<number>((total, v) => total + (v ?? 0), 0);

    for (const bill of bills) {
      const charges = sum((bill.financeCharges ?? []).map((c) => c.amount));
      const payments = sum((bill.payments ?? []).map((p) => p.amount));
      const data = {
        accountId,
        dueDate: new Date(bill.dueDate),
        closingDate: bill.billClosingDate ? new Date(bill.billClosingDate) : null,
        totalAmount: new Prisma.Decimal(bill.totalAmount ?? 0),
        minimumPayment:
          bill.minimumPaymentAmount != null
            ? new Prisma.Decimal(bill.minimumPaymentAmount)
            : null,
        currencyCode: bill.totalAmountCurrencyCode ?? null,
        financeCharges: new Prisma.Decimal(charges),
        paymentsAmount: new Prisma.Decimal(payments),
      };
      await this.prisma.bill.upsert({
        where: { id: bill.id },
        create: { id: bill.id, ...data },
        update: data,
      });
    }
  }

  private async upsertInvestments(
    itemId: string,
    investments: PluggyInvestment[],
  ): Promise<void> {
    for (const inv of investments) {
      const data = {
        itemId,
        type: inv.type ?? null,
        subtype: inv.subtype ?? null,
        name: inv.name ?? null,
        balance: inv.balance != null ? new Prisma.Decimal(inv.balance) : null,
        amount: inv.amount != null ? new Prisma.Decimal(inv.amount) : null,
        currencyCode: inv.currencyCode ?? null,
        status: inv.status ?? null,
        date: inv.date ? new Date(inv.date) : null,
      };
      await this.prisma.investment.upsert({
        where: { id: inv.id },
        create: { id: inv.id, ...data },
        update: data,
      });
    }
  }

  private async upsertTransactions(
    accountId: string,
    txs: PluggyTransaction[],
  ): Promise<void> {
    for (let i = 0; i < txs.length; i += TX_CHUNK) {
      const chunk = txs.slice(i, i + TX_CHUNK);
      await this.prisma.$transaction(
        chunk.map((t) => {
          const data = {
            accountId,
            date: new Date(t.date),
            description: t.description ?? null,
            descriptionRaw: t.descriptionRaw ?? null,
            amount: new Prisma.Decimal(t.amount),
            balance: t.balance != null ? new Prisma.Decimal(t.balance) : null,
            currencyCode: t.currencyCode ?? null,
            type: t.type ?? null,
            category: t.category ?? null,
            categoryId: t.categoryId ?? null,
            providerCode: t.providerCode ?? null,
            status: t.status ?? null,
            ...installmentOf(t),
          };
          return this.prisma.transaction.upsert({
            where: { id: t.id },
            create: { id: t.id, ...data },
            update: data,
          });
        }),
      );
    }
  }
}

import { Prisma } from '@prisma/client';

/**
 * Contas cujo saldo rende sozinho. A 99Pay remunera o saldo parado em CDI,
 * entao o dinheiro que fica la e investimento — mesmo a Pluggy classificando
 * a conta como corrente, que e o unico rotulo que ela tem para dar.
 *
 * Ela continua sendo a conta do dia a dia, entao o saldo segue valendo como
 * saldo em conta na projecao do mes. O total liquido da analise ja soma as
 * contas BANK: nada aqui e contado duas vezes.
 */
const YIELD_ACCOUNT_PATTERNS = [/\b99\s*pay\b/i];

type AccountLabels = { name: string | null; marketingName: string | null };

export function isYieldAccount(account: AccountLabels): boolean {
  const label = `${account.name ?? ''} ${account.marketingName ?? ''}`;
  return YIELD_ACCOUNT_PATTERNS.some((re) => re.test(label));
}

type YieldAccount = AccountLabels & {
  id: string;
  itemId: string;
  balance: Prisma.Decimal | null;
  currencyCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  item: { connectorName: string; lastSyncedAt: Date };
};

/**
 * A conta remunerada no mesmo formato de uma posicao de investimento, para
 * quem consome /pluggy/db/investments nao precisar saber da excecao.
 */
export function yieldAccountAsInvestment(account: YieldAccount) {
  return {
    id: account.id,
    itemId: account.itemId,
    type: 'FIXED_INCOME',
    subtype: 'CONTA_REMUNERADA',
    name: account.marketingName ?? account.name,
    balance: account.balance,
    // Sem aporte identificavel: o saldo entra e sai como conta corrente.
    amount: null,
    currencyCode: account.currencyCode,
    status: 'ACTIVE',
    date: null,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    item: account.item,
  };
}

/** Formatos (parciais) das respostas da Pluggy que usamos na persistencia. */

export interface PluggyConnectorRef {
  id: number;
  name: string;
}

export interface PluggyItem {
  id: string;
  connector: PluggyConnectorRef;
  status: string;
  executionStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Bloco `creditData`, presente apenas em contas do tipo CREDIT. */
export interface PluggyCreditData {
  level?: string;
  brand?: string;
  balanceCloseDate?: string;
  balanceDueDate?: string;
  availableCreditLimit?: number;
  creditLimit?: number;
  minimumPayment?: number;
}

export interface PluggyAccountFull {
  id: string;
  itemId: string;
  type?: string;
  subtype?: string;
  name?: string;
  marketingName?: string;
  number?: string;
  balance?: number;
  currencyCode?: string;
  creditData?: PluggyCreditData | null;
}

export interface PluggyInvestment {
  id: string;
  itemId: string;
  type?: string;
  subtype?: string;
  name?: string;
  balance?: number;
  amount?: number;
  currencyCode?: string;
  status?: string;
  date?: string;
}

/**
 * Bloco `creditCardMetadata` de uma transacao de cartao. So vem preenchido em
 * parte dos emissores — quando falta, a parcela costuma estar escrita na
 * propria descricao ("MERCADO 03/10").
 */
export interface PluggyCreditCardMetadata {
  installmentNumber?: number;
  totalInstallments?: number;
  /** Valor cheio da compra parcelada. */
  totalAmount?: number;
  purchaseDate?: string;
  payeeMCC?: number;
  cardNumber?: string;
  billId?: string;
}

export interface PluggyTransaction {
  id: string;
  accountId: string;
  date: string;
  description?: string;
  descriptionRaw?: string;
  amount: number;
  balance?: number;
  currencyCode?: string;
  type?: string;
  category?: string;
  categoryId?: string;
  providerCode?: string;
  status?: string;
  creditCardMetadata?: PluggyCreditCardMetadata | null;
}

/** Encargo cobrado numa fatura (juros, IOF, multa, saldo em atraso). */
export interface PluggyFinanceCharge {
  id?: string;
  type?: string;
  amount?: number;
  currencyCode?: string;
  additionalInfo?: string;
}

/** Pagamento lancado sobre uma fatura. */
export interface PluggyBillPayment {
  id?: string;
  valueType?: string;
  paymentDate?: string;
  paymentMode?: string;
  amount?: number;
  currencyCode?: string;
}

/** Fatura de cartao de credito (GET /bills). */
export interface PluggyBill {
  id: string;
  dueDate: string;
  billClosingDate?: string;
  totalAmount?: number;
  totalAmountCurrencyCode?: string;
  minimumPaymentAmount?: number;
  allowsInstallments?: boolean;
  financeCharges?: PluggyFinanceCharge[];
  payments?: PluggyBillPayment[];
}

/** Envelope paginado (offset) — usado por endpoints legados como /accounts. */
export interface PluggyPage<T> {
  results: T[];
  total?: number;
  totalPages?: number;
  page?: number;
}

/**
 * Envelope do /v2/transactions: paginacao por cursor.
 * `next` e um link (URL absoluta ou caminho) para a proxima pagina, ou null.
 */
export interface PluggyV2Page<T> {
  results: T[];
  next: string | null;
}

/** Payload (parcial) enviado pela Pluggy nos webhooks configurados no dashboard. */
export interface PluggyWebhookPayload {
  event: string;
  eventId: string;
  clientUserId?: string;
  triggeredBy?: 'USER' | 'CLIENT' | 'SYNC' | 'INTERNAL';
  itemId?: string;
  accountId?: string;
  transactionIds?: string[];
}

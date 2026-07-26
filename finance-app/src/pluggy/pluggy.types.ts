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

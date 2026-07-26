// Cliente da API do finance-app (NestJS) + tipos espelhando o backend.

// Por padrão a API é acessada via proxy same-origin do Next ("/api/backend",
// ver rewrites em next.config.ts) — funciona em localhost e pelo IP da rede
// (celular) sem depender de CORS nem da porta 3334 estar acessível.
const BASE = process.env.NEXT_PUBLIC_API_URL || '/api/backend';

export interface CategoryStat {
  category: string;
  total: number;
  share: number;
  count: number;
  growthPct: number | null;
  vsHistAvgPct: number | null;
}

export interface TrendPoint {
  window: '1m' | '3m' | '6m' | '12m';
  income: number;
  consumption: number;
  savings: number;
  savingsRatePct: number;
}

export interface Subscription {
  description: string;
  monthlyAmount: number;
  monthsSeen: number;
  annualEstimate: number;
  lastDate: string;
}

export interface HealthScore {
  score: number;
  rating: 'Critico' | 'Atencao' | 'Bom' | 'Excelente';
  components: { label: string; points: number; max: number; note: string }[];
}

export interface AnalyticsData {
  period: { month: string; from: string; to: string };
  dataQuality: {
    uncertainCategoryShare: number;
    salaryDetected: boolean;
    incomeReliable: boolean;
    notes: string[];
  };
  summary: {
    income: number;
    consumption: number;
    savings: number;
    commitmentPct: number;
    classification: string;
    changeVsPrevPct: number | null;
  };
  categories: CategoryStat[];
  moneyDestination: {
    income: number;
    slices: { label: string; amount: number; share: number }[];
    leftover: number;
    leftoverShare: number;
  };
  behavior: {
    weekendSharePct: number;
    nightSharePct: number;
    deliveryCountThisMonth: number;
    deliveryCountPrevMonth: number;
    avgTransactionsPerDay: number;
  };
  trends: TrendPoint[];
  subscriptions: { items: Subscription[]; monthlyTotal: number; annualTotal: number };
  waste: { label: string; total: number; count: number; note: string }[];
  health: HealthScore;
  movements: { transfers: number; investmentsNet: number; debt: number; fees: number };
}

export interface AnalyticsNarrative {
  avisos: string[];
  resumoGeral: string[];
  analiseCategorias: string[];
  mapaDestino: string[];
  mudancasComportamento: string[];
  tendencia: string[];
  assinaturas: string[];
  desperdicios: string[];
  alertas: string[];
  oportunidades: string[];
  previsoes: string[];
  indiceSaude: string[];
  insightsAutomaticos: string[];
  comportamentosPositivos: string[];
  recomendacoes: string[];
}

export interface AnalyticsReport {
  data: AnalyticsData;
  narrative: AnalyticsNarrative;
}

export interface DbItem {
  id: string;
  connectorName: string;
  status: string;
  lastSyncedAt: string;
  _count?: { accounts: number };
}

export interface DbAccount {
  id: string;
  itemId: string;
  type: string | null; // BANK | CREDIT
  subtype: string | null;
  name: string | null;
  marketingName: string | null;
  number: string | null;
  balance: string | null; // Decimal serializado
  currencyCode: string | null;
  item: { connectorName: string; lastSyncedAt: string };
  _count: { transactions: number };
}

export interface DbTransaction {
  id: string;
  accountId: string;
  date: string;
  description: string | null;
  descriptionRaw: string | null;
  amount: string; // Decimal serializado
  type: string | null; // DEBIT | CREDIT
  category: string | null;
  status: string | null;
  account?: {
    name: string | null;
    marketingName: string | null;
    type: string | null;
    item: { connectorName: string };
  };
}

/**
 * Valor com sinal econômico: saída de dinheiro negativa, entrada positiva.
 * Necessário porque compras de cartão de crédito chegam como DEBIT positivo.
 */
export function signedAmount(t: Pick<DbTransaction, 'amount' | 'type'>) {
  const raw = Number(t.amount);
  if (t.type === 'DEBIT') return -Math.abs(raw);
  if (t.type === 'CREDIT') return Math.abs(raw);
  return raw;
}

export function accountTitle(a: DbAccount) {
  if (a.subtype === 'MANUAL') return a.name ?? 'Carteira';
  return a.marketingName ?? a.name ?? a.item.connectorName;
}

export function accountKindLabel(a: DbAccount) {
  if (a.subtype === 'MANUAL') return 'Conta manual';
  if (a.type === 'CREDIT') return 'Cartão de crédito';
  return 'Conta corrente';
}

/** Carteira primeiro, como no app de referência. */
export function sortAccounts(list: DbAccount[]) {
  return [...list].sort(
    (a, b) => Number(b.subtype === 'MANUAL') - Number(a.subtype === 'MANUAL'),
  );
}

export interface TransactionsPage {
  total: number;
  transactions: DbTransaction[];
}

export interface SyncResult {
  itemId: string;
  connector: string;
  status: string;
  accounts: { accountId: string; name?: string; transactionsSynced: number }[];
  totalTransactions: number;
}

export interface Budget {
  category: string; // "_global" = limite geral do mês
  amount: string; // Decimal serializado
}

export interface GoalEntry {
  id: string;
  goalId: string;
  month: string; // YYYY-MM
  amount: string;
}

export interface Goal {
  id: string;
  name: string;
  icon: string;
  targetAmount: string;
  initialAmount: string;
  monthlyContribution: string | null;
  deadline: string | null;
  status: 'ACTIVE' | 'READY' | 'DONE';
  entries: GoalEntry[];
  saved: number;
  createdAt: string;
}

export interface ManualTxInput {
  description: string;
  amount: number;
  kind: 'expense' | 'income';
  date: string; // YYYY-MM-DD
  category?: string;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Erro ${res.status} em ${path}`);
  }
  return res.json();
}

async function send<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Erro ${res.status} em ${path}`);
  }
  return res.json();
}

const post = <T,>(path: string, body?: unknown) => send<T>('POST', path, body);

export interface TxQuery {
  accountId?: string;
  from?: string;
  to?: string;
  category?: string;
  search?: string;
  take?: number;
  skip?: number;
}

function qs(params: Record<string, string | number | undefined>) {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return p.length
    ? `?${p.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`
    : '';
}

export const api = {
  months: () => get<string[]>('/analytics/months'),
  report: (month?: string) =>
    get<AnalyticsReport>(`/analytics/report${month ? `?month=${month}` : ''}`),
  items: () => get<DbItem[]>('/pluggy/items'),
  accounts: () => get<DbAccount[]>('/pluggy/db/accounts'),
  transactions: (q: TxQuery = {}) =>
    get<TransactionsPage>(`/pluggy/db/transactions${qs(q as Record<string, string | number | undefined>)}`),
  syncItem: (id: string) => post<SyncResult>(`/pluggy/items/${id}/sync`),
  syncAll: () => post<SyncResult[]>('/pluggy/sync'),
  createConnectToken: () =>
    post<{ accessToken: string }>('/pluggy/connect-token'),

  budgets: () => get<Budget[]>('/budgets'),
  setBudget: (category: string, amount: number) =>
    send<Budget>('PUT', '/budgets', { category, amount }),

  goals: () => get<Goal[]>('/goals'),
  createGoal: (g: {
    name: string;
    icon?: string;
    targetAmount: number;
    initialAmount?: number;
    monthlyContribution?: number;
    deadline?: string;
  }) => post<Goal>('/goals', g),
  updateGoal: (id: string, g: Partial<{
    name: string;
    icon: string;
    targetAmount: number;
    monthlyContribution: number;
    status: 'ACTIVE' | 'READY' | 'DONE';
  }>) => send<Goal>('PATCH', `/goals/${id}`, g),
  deleteGoal: (id: string) => send<{ deleted: string }>('DELETE', `/goals/${id}`),
  addGoalEntry: (id: string, month: string, amount: number) =>
    post<GoalEntry>(`/goals/${id}/entries`, { month, amount }),

  manualTx: (t: ManualTxInput) => post<DbTransaction>('/manual/transactions', t),
  deleteManualTx: (id: string) =>
    send<{ deleted: string }>('DELETE', `/manual/transactions/${id}`),
};

export const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** BRL compacto, sem centavos, para chips e eixos. */
export const brl0 = (n: number) =>
  n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });

/** Limites de um mês YYYY-MM em ISO (from = dia 1, to = último dia). */
export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
    daysInMonth: last,
  };
}

/** Mês anterior a YYYY-MM. */
export function prevMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_LABELS[m - 1]} ${y}`;
}

/** Soma n meses a YYYY-MM. */
export function addMonths(month: string, n: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Mês corrente em YYYY-MM. */
export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

/** Cabeçalho de grupo por dia: "SEG, 13 DE JULHO". */
export function dayGroupLabel(dateIso: string) {
  const d = new Date(dateIso);
  const wd = WEEKDAYS[d.getUTCDay()];
  return `${wd}, ${d.getUTCDate()} DE ${MONTH_LABELS[d.getUTCMonth()].toUpperCase()}`;
}

/** "R$ 1.234" sem símbolo p/ eixos: 1,2K etc. */
export function compactBRL(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sign}${k >= 10 ? Math.round(k) : (Math.round(k * 10) / 10).toLocaleString('pt-BR')}K`;
  }
  return `${sign}${Math.round(abs)}`;
}

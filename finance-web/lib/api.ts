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
  currentAmount: number;
  /** % de aumento da última cobrança sobre o histórico (null se estável). */
  increasePct: number | null;
}

export interface HealthScore {
  score: number;
  rating: 'Crítico' | 'Atenção' | 'Bom' | 'Excelente';
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
  movements: {
    transfers: number;
    investmentsNet: number;
    debt: number;
    fees: number;
    gamblingNet: number | null;
  };
  /** Consumo acumulado por dia do mês (índice 0 = dia 1), até hoje. */
  dailyConsumption: number[];
  reserve: ReserveStatus;
}

/** Reserva de emergência medida em meses de custo de vida. */
export interface ReserveStatus {
  liquidAssets: number;
  monthlyCost: number;
  months: number | null;
  targetMonths: number;
  missing: number;
  status: 'sem-reserva' | 'iniciando' | 'boa' | 'completa' | 'indefinido';
}

/** Agregado mensal já classificado pelo backend (fonte única dos gráficos). */
export interface MonthPoint {
  month: string; // YYYY-MM
  income: number;
  consumption: number;
  savings: number;
  categories: { category: string; total: number }[];
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
  reserva: string[];
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
  // Só em cartão de crédito (creditData da Pluggy)
  creditLimit: string | null;
  availableCreditLimit: string | null;
  minimumPayment: string | null;
  balanceCloseDate: string | null;
  balanceDueDate: string | null;
  cardBrand: string | null;
  cardLevel: string | null;
  item: { connectorName: string; lastSyncedAt: string };
  _count: { transactions: number };
}

/** Dias até o vencimento da fatura (negativo = já venceu). */
export function daysUntil(dateIso: string): number {
  const today = todayParts();
  const { year, month, day } = zonedParts(dateIso);
  const a = Date.UTC(today.year, today.month - 1, today.day);
  const b = Date.UTC(year, month - 1, day);
  return Math.round((b - a) / 86_400_000);
}

export interface DbInvestment {
  id: string;
  itemId: string;
  type: string | null; // FIXED_INCOME | MUTUAL_FUND | EQUITY | ...
  subtype: string | null;
  name: string | null;
  balance: string | null; // Decimal serializado — saldo real, com rendimento
  amount: string | null;
  currencyCode: string | null;
  status: string | null; // ACTIVE | TOTAL_WITHDRAWAL | ...
  date: string | null;
  item: { connectorName: string; lastSyncedAt: string };
}

export interface InvestmentsResponse {
  total: number;
  investments: DbInvestment[];
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
  /** true quando `total` é maior que o que coube na página pedida. */
  hasMore: boolean;
}

/** O sync agora roda em segundo plano no servidor; a resposta e so um ack. */
export interface SyncStarted {
  started: true;
  itemId?: string;
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

/** Em 401, a sessao caiu (ou nunca existiu) — manda pra tela de login. */
function redirectToLoginIfUnauthorized(status: number) {
  if (status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    redirectToLoginIfUnauthorized(res.status);
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
    redirectToLoginIfUnauthorized(res.status);
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
  series: (months = 12) => get<MonthPoint[]>(`/analytics/series?months=${months}`),
  askAssistant: (question: string, month?: string) =>
    post<{ answer: string }>('/assistant/ask', { question, month }),
  items: () => get<DbItem[]>('/pluggy/items'),
  accounts: () => get<DbAccount[]>('/pluggy/db/accounts'),
  investments: () => get<InvestmentsResponse>('/pluggy/db/investments'),
  transactions: (q: TxQuery = {}) =>
    get<TransactionsPage>(`/pluggy/db/transactions${qs(q as Record<string, string | number | undefined>)}`),
  syncItem: (id: string) => post<SyncStarted>(`/pluggy/items/${id}/sync`),
  syncAll: () => post<SyncStarted>('/pluggy/sync'),
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

  login: (password: string) => post<{ ok: true }>('/auth/login', { password }),
  logout: () => post<{ ok: true }>('/auth/logout'),
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

/**
 * Fuso de referência do app. Datas vêm do backend como instante UTC; ler o dia
 * com getUTCDate() jogava as compras da noite para o dia seguinte (22h em
 * Brasília já é o outro dia em UTC).
 */
export const TIMEZONE = 'America/Sao_Paulo';

const DATE_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** Componentes de calendário de um instante, vistos em Brasília. */
export function zonedParts(dateIso: string) {
  const parts = DATE_PARTS.formatToParts(new Date(dateIso));
  const at = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    year: Number(at('year')),
    month: Number(at('month')),
    day: Number(at('day')),
    weekday: WEEKDAY_INDEX[at('weekday')] ?? 0,
  };
}

/** Hoje em Brasília, como componentes de calendário. */
export function todayParts() {
  return zonedParts(new Date().toISOString());
}

/** 'YYYY-MM' de um instante, no calendário de Brasília. */
export function zonedMonth(dateIso: string) {
  const { year, month } = zonedParts(dateIso);
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Cabeçalho de grupo por dia: "SEG, 13 DE JULHO". */
export function dayGroupLabel(dateIso: string) {
  const { day, month, weekday } = zonedParts(dateIso);
  return `${WEEKDAYS[weekday]}, ${day} DE ${MONTH_LABELS[month - 1].toUpperCase()}`;
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

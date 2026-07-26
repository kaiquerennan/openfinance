// Tradução e iconografia das categorias da Pluggy (chaves em minúsculas).

interface CatMeta {
  label: string;
  icon: string;
}

const CATEGORIES: Record<string, CatMeta> = {
  // Renda
  income: { label: 'Renda', icon: '💵' },
  salary: { label: 'Salário', icon: '💼' },
  paycheck: { label: 'Salário', icon: '💼' },

  // Movimentações
  transfers: { label: 'Transferências', icon: '🔁' },
  'same person transfer': { label: 'Transf. própria', icon: '🔄' },
  'transfer - pix': { label: 'PIX', icon: '⚡' },
  'transfer - internal': { label: 'Transf. interna', icon: '🏦' },
  'wire transfer': { label: 'TED/DOC', icon: '🏦' },
  'credit card payment': { label: 'Pgto. de fatura', icon: '💳' },
  investments: { label: 'Investimentos', icon: '📈' },
  'loans and financing': { label: 'Financiamentos', icon: '🏠' },
  loans: { label: 'Empréstimos', icon: '🤝' },

  // Taxas
  'tax on financial operations': { label: 'IOF', icon: '🧾' },
  'late payment and overdraft costs': { label: 'Juros e multas', icon: '⚠️' },
  'bank fees': { label: 'Tarifas bancárias', icon: '🏛️' },
  'interest charges': { label: 'Juros', icon: '📉' },
  taxes: { label: 'Impostos', icon: '🧾' },

  // Consumo
  groceries: { label: 'Supermercado', icon: '🛒' },
  supermarket: { label: 'Supermercado', icon: '🛒' },
  restaurants: { label: 'Restaurantes', icon: '🍽️' },
  'eating out': { label: 'Restaurantes', icon: '🍔' },
  accomodation: { label: 'Hospedagem', icon: '🏨' },
  'cinema, theater and concerts': { label: 'Cinema e shows', icon: '🎬' },
  'proceeds interests and dividends': { label: 'Rendimentos', icon: '💹' },
  'food and drinks': { label: 'Alimentação', icon: '🍔' },
  'food delivery': { label: 'Delivery', icon: '🛵' },
  'fast food': { label: 'Fast food', icon: '🍟' },
  shopping: { label: 'Compras', icon: '🛍️' },
  clothing: { label: 'Vestuário', icon: '👕' },
  electronics: { label: 'Eletrônicos', icon: '🔌' },
  'sports goods': { label: 'Artigos esportivos', icon: '🏋️' },
  'digital services': { label: 'Serviços digitais', icon: '💻' },
  streaming: { label: 'Streaming', icon: '📺' },
  services: { label: 'Serviços', icon: '🧰' },
  entertainment: { label: 'Entretenimento', icon: '🎬' },
  gambling: { label: 'Apostas', icon: '🎰' },
  leisure: { label: 'Lazer', icon: '🎡' },
  travel: { label: 'Viagens', icon: '✈️' },
  accommodation: { label: 'Hospedagem', icon: '🏨' },
  airfare: { label: 'Passagens aéreas', icon: '🛫' },
  'taxi and ride-hailing': { label: 'Táxi e apps', icon: '🚕' },
  'public transportation': { label: 'Transporte público', icon: '🚌' },
  mobility: { label: 'Mobilidade', icon: '🚗' },
  'gas stations': { label: 'Combustível', icon: '⛽' },
  parking: { label: 'Estacionamento', icon: '🅿️' },
  tolls: { label: 'Pedágio', icon: '🛣️' },
  health: { label: 'Saúde', icon: '🩺' },
  pharmacy: { label: 'Farmácia', icon: '💊' },
  gyms: { label: 'Academia', icon: '🏋️' },
  education: { label: 'Educação', icon: '📚' },
  university: { label: 'Universidade', icon: '🎓' },
  telecommunications: { label: 'Telefonia/Internet', icon: '📡' },
  internet: { label: 'Internet', icon: '🌐' },
  utilities: { label: 'Contas de casa', icon: '🏡' },
  electricity: { label: 'Energia', icon: '💡' },
  rent: { label: 'Aluguel', icon: '🔑' },
  'pet supplies': { label: 'Pets', icon: '🐾' },
  gifts: { label: 'Presentes', icon: '🎁' },
};

export function catMeta(category: string | null | undefined): CatMeta {
  if (!category) return { label: 'Sem categoria', icon: '❔' };
  return (
    CATEGORIES[category.trim().toLowerCase()] ?? { label: category, icon: '🏷️' }
  );
}

/**
 * Grupo econômico da transação (espelha category-groups.ts do backend):
 * transferências/investimentos/pagamento de fatura não são consumo.
 */
const NEUTRAL = new Set([
  'transfers',
  'same person transfer',
  'transfer - pix',
  'transfer - internal',
  'wire transfer',
  'credit card payment',
  'investments',
  'loans and financing',
  'loans',
]);
const INCOME = new Set(['income', 'salary', 'paycheck']);

export type TxKind = 'income' | 'consumption' | 'neutral';

export function txKind(category: string | null | undefined, amount: number): TxKind {
  const key = (category ?? '').trim().toLowerCase();
  if (NEUTRAL.has(key)) return 'neutral';
  if (INCOME.has(key)) return 'income';
  return amount < 0 ? 'consumption' : 'income';
}

/** Paleta categórica p/ barras empilhadas (fundo claro), em ordem fixa. */
export const CHART_PALETTE = [
  '#8B5CF6', // violeta
  '#94A3B8', // cinza-azulado
  '#EF4444', // vermelho
  '#475569', // ardósia
  '#14B8A6', // teal
  '#C026D3', // magenta
  '#F59E0B', // âmbar
  '#3B82F6', // azul
  '#EC4899', // rosa
  '#65A30D', // oliva
];

/** Cor fixa por categoria (chips, triângulos e segmentos de barra). */
const CAT_COLORS: Record<string, string> = {
  restaurants: '#A855F7',
  'eating out': '#A855F7',
  accomodation: '#0EA5E9',
  'cinema, theater and concerts': '#F59E0B',
  'proceeds interests and dividends': '#22C55E',
  'food and drinks': '#8B5CF6',
  'fast food': '#C026D3',
  'food delivery': '#D946EF',
  groceries: '#B45DE0',
  supermarket: '#B45DE0',
  shopping: '#EF4444',
  clothing: '#F43F5E',
  electronics: '#6366F1',
  transfers: '#94A3B8',
  'same person transfer': '#94A3B8',
  'transfer - pix': '#64748B',
  'transfer - internal': '#94A3B8',
  'wire transfer': '#94A3B8',
  'credit card payment': '#475569',
  investments: '#0EA5E9',
  health: '#EF4444',
  pharmacy: '#F87171',
  gyms: '#FB923C',
  'taxi and ride-hailing': '#14B8A6',
  'public transportation': '#0D9488',
  mobility: '#0891B2',
  'gas stations': '#F59E0B',
  'digital services': '#6366F1',
  streaming: '#8B5CF6',
  entertainment: '#F59E0B',
  leisure: '#FBBF24',
  travel: '#0EA5E9',
  telecommunications: '#3B82F6',
  utilities: '#F97316',
  rent: '#A16207',
  education: '#2563EB',
  income: '#22C55E',
  salary: '#16A34A',
  paycheck: '#16A34A',
  'bank fees': '#78716C',
  taxes: '#78716C',
};

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Cor estável da categoria (mapa fixo; fallback determinístico na paleta). */
export function catColor(category: string | null | undefined): string {
  const key = (category ?? '').trim().toLowerCase();
  if (!key) return '#9CA3AF';
  return CAT_COLORS[key] ?? CHART_PALETTE[hashStr(key) % CHART_PALETTE.length];
}

/** Lista de categorias conhecidas para selects (chave + label + icon). */
export function allCategories() {
  const seen = new Set<string>();
  return Object.entries(CATEGORIES)
    .filter(([, m]) => (seen.has(m.label) ? false : (seen.add(m.label), true)))
    .map(([key, m]) => ({ key, ...m }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

/**
 * Classificacao de categorias da Pluggy em grupos economicos.
 *
 * Critico para uma analise honesta: num extrato, nem toda "saida" e consumo.
 * Transferencias entre contas proprias, pagamento de fatura, aplicacoes em
 * investimento e parcelas de emprestimo sao MOVIMENTACOES — nao gasto de
 * consumo. Somar tudo como "gasto" distorce completamente a analise.
 *
 * Edite este mapa conforme novas categorias aparecerem nos seus dados.
 */

export type CatGroup =
  | 'income' // renda de fato (salario, recebimentos)
  | 'consumption' // gasto de consumo (o que a analise foca)
  | 'transfer' // movimentacao entre contas / pagamento de fatura
  | 'investment' // aplicacao/resgate de investimento
  | 'debt' // emprestimos e financiamentos
  | 'fee'; // taxas, juros, multas

/** category (em minusculas) -> grupo. */
const GROUP_BY_CATEGORY: Record<string, CatGroup> = {
  // Movimentacoes (neutras — nem renda nem gasto)
  transfers: 'transfer',
  'same person transfer': 'transfer',
  'transfer - pix': 'transfer',
  'transfer - internal': 'transfer',
  'wire transfer': 'transfer',
  'credit card payment': 'transfer',

  // Investimentos
  investments: 'investment',

  // Dividas
  'loans and financing': 'debt',
  loans: 'debt',

  // Taxas / juros / multas
  'tax on financial operations': 'fee',
  'late payment and overdraft costs': 'fee',
  'bank fees': 'fee',
  'interest charges': 'fee',

  // Renda
  income: 'income',
  salary: 'income',
  paycheck: 'income',
};

/**
 * Dentro do consumo, o que e custo de viver e o que e escolha.
 *
 * A lista de 20 categorias da Pluggy nao responde "da pra cortar quanto?".
 * Esta divisao responde: essencial e o que continuaria existindo num mes
 * apertado; estilo de vida e o que da pra reduzir por decisao.
 */
export type ConsumptionKind = 'essencial' | 'estilo-de-vida';

const ESSENTIAL_CATEGORIES = new Set([
  'groceries',
  'supermarket',
  'rent',
  'utilities',
  'electricity',
  'telecommunications',
  'internet',
  'health',
  'pharmacy',
  'education',
  'university',
  'public transportation',
  'mobility',
  'gas stations',
  'tolls',
  'parking',
  'taxes',
  'pet supplies',
]);

/**
 * Categoria desconhecida cai em essencial: e mais honesto subestimar o quanto
 * da pra cortar do que prometer uma economia que talvez nao exista.
 */
export function consumptionKindOf(category: string | null): ConsumptionKind {
  const key = (category ?? '').trim().toLowerCase();
  if (ESSENTIAL_CATEGORIES.has(key)) return 'essencial';
  return LIFESTYLE_CATEGORIES.has(key) ? 'estilo-de-vida' : 'essencial';
}

const LIFESTYLE_CATEGORIES = new Set([
  'restaurants',
  'eating out',
  'food and drinks',
  'food delivery',
  'fast food',
  'shopping',
  'clothing',
  'electronics',
  'entertainment',
  'streaming',
  'digital services',
  'services',
  'leisure',
  'travel',
  'accommodation',
  'accomodation',
  'airfare',
  'cinema, theater and concerts',
  'gambling',
  'gyms',
  'sports goods',
  'gifts',
  'taxi and ride-hailing',
]);

/** Categorias de consumo que costumam indicar potencial desperdicio. */
export const WASTE_CATEGORIES = new Set([
  'food delivery',
  'gambling',
  'fast food',
]);

/** Palavras na descricao que indicam taxa/juros/multa mesmo sem categoria. */
export const FEE_KEYWORDS = ['juros', 'multa', 'tarifa', 'iof', 'anuidade', 'taxa'];

/**
 * Define o grupo de uma transacao. Categorias desconhecidas caem em consumo
 * (se saida) ou renda (se entrada) — e marcamos como incerto para o relatorio.
 */
export function groupOf(
  category: string | null,
  amount: number,
): { group: CatGroup; uncertain: boolean } {
  const key = (category ?? '').trim().toLowerCase();
  const mapped = GROUP_BY_CATEGORY[key];
  if (mapped) return { group: mapped, uncertain: false };
  return { group: amount < 0 ? 'consumption' : 'income', uncertain: true };
}

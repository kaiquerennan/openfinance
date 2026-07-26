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

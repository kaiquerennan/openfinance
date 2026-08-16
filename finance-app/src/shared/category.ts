/**
 * Categoria que vale numa leitura do extrato.
 *
 * A correcao do usuario (direta ou por regra) sempre vence a classificacao
 * que veio do Open Finance. Toda tela e todo calculo passam por aqui: se um
 * caminho lesse `category` cru, a mesma transacao apareceria em duas
 * categorias diferentes dependendo da tela.
 */
export function resolvedCategory(t: {
  category: string | null;
  categoryOverride: string | null;
}): string | null {
  return t.categoryOverride ?? t.category;
}

/**
 * Forma canonica da categoria para agrupar e exibir.
 *
 * A Pluggy escreve "Eating out" e a correcao do usuario chega em minusculas.
 * Sem uma forma unica, "groceries" e "Groceries" virariam duas linhas
 * diferentes no relatorio do mesmo mes.
 */
export function canonicalCategory(category: string | null): string | null {
  const value = category?.trim();
  if (!value) return null;
  return value[0].toUpperCase() + value.slice(1);
}

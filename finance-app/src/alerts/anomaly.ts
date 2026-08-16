/**
 * Gasto fora do padrao.
 *
 * O extrato so conta o que ja aconteceu; um valor muito acima do habitual e a
 * unica coisa que ainda da tempo de contestar, cancelar ou pelo menos
 * entender no mesmo dia. Por isso a comparacao e sempre com o historico da
 * propria pessoa: "R$ 300" nao quer dizer nada sozinho, mas "R$ 300 num lugar
 * onde voce gasta R$ 20" quer.
 */

import { Tx } from '../analytics/analytics.types';

/** Abaixo disto nao vale interromper ninguem, por mais atipico que seja. */
const MIN_AMOUNT = 100;

/** Cobrancas anteriores necessarias para existir um "de sempre" no lugar. */
const MERCHANT_MIN_HISTORY = 4;

/** Quantas vezes o valor de sempre para a cobranca virar aviso. */
const MERCHANT_FACTOR = 3;

/** Quantas vezes o teto habitual de gasto para uma compra nova virar aviso. */
const UNUSUAL_FACTOR = 2;

/** Janela de transacoes consideradas recentes. */
const RECENT_DAYS = 3;

/** Teto de avisos por rodada: tres ja e o limite do que alguem le. */
const MAX_ANOMALIES = 3;

export interface Anomaly {
  transactionId: string;
  description: string;
  amount: number;
  /** Valor de referencia que a comparacao usou. */
  typical: number;
  /** 'merchant' = caro para este lugar; 'unusual' = caro para o seu padrao. */
  reason: 'merchant' | 'unusual';
  /** Quantas vezes o valor de referencia. */
  times: number;
}

/**
 * Palavras que descrevem o meio de pagamento, nao quem recebeu. "pix qr
 * transfer" e a descricao de milhares de pagamentos diferentes: tratar isso
 * como um lugar so faria o "valor de sempre" comparar padaria com aluguel.
 */
const GENERIC_WORDS = new Set([
  'pix',
  'qr',
  'key',
  'transfer',
  'transferencia',
  'enviada',
  'enviado',
  'recebida',
  'recebido',
  'ted',
  'doc',
  'pagamento',
  'pago',
  'compra',
  'debito',
  'credito',
  'saque',
  'deposito',
  'boleto',
  'cartao',
  'para',
  'com',
  'sem',
]);

/** Junta cobrancas do mesmo lugar apesar de codigo e numero na descricao. */
function merchantKey(description: string): string {
  return description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .split(' ')
    .filter((word) => word.length >= 3 && !GENERIC_WORDS.has(word))
    .join(' ')
    .trim();
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

/**
 * Acha os gastos recentes que destoam do historico.
 *
 * `txs` deve ser o extrato normalizado dos ultimos meses; so consumo entra —
 * transferencia, aplicacao e pagamento de fatura sao movimentacao de dinheiro,
 * nao gasto, e alertar sobre elas so ensinaria a ignorar o aviso.
 */
export function findAnomalies(txs: Tx[], now: Date): Anomaly[] {
  const spend = txs
    .filter((t) => t.group === 'consumption' && t.amount < 0 && t.description)
    .map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      key: merchantKey(t.description),
      value: Math.abs(t.amount),
    }))
    // Sem nada na descricao alem do meio de pagamento nao da pra dizer a quem
    // o dinheiro foi: o aviso nao ajudaria a decidir nada, e boa parte desses
    // lancamentos e movimentacao entre contas classificada como consumo.
    .filter((t) => t.key.length >= 3);
  if (!spend.length) return [];

  const cutoff = now.getTime() - RECENT_DAYS * 86_400_000;

  // O teto habitual sai so do que ja era historico antes da janela recente:
  // incluir a propria compra suspeita no calculo faria ela virar o padrao e
  // nenhum gasto atipico seria detectado.
  const ceiling = percentile(
    spend.filter((t) => t.date.getTime() < cutoff).map((t) => t.value),
    95,
  );

  const out: Anomaly[] = [];
  for (const tx of spend) {
    if (tx.date.getTime() < cutoff) continue;
    if (tx.value < MIN_AMOUNT) continue;

    const before = spend
      .filter((o) => o.key === tx.key && o.date < tx.date)
      .map((o) => o.value);

    if (before.length >= MERCHANT_MIN_HISTORY) {
      const usual = median(before);
      if (usual > 0 && tx.value >= usual * MERCHANT_FACTOR && tx.value - usual >= MIN_AMOUNT) {
        out.push({
          transactionId: tx.id,
          description: tx.description,
          amount: tx.value,
          typical: usual,
          reason: 'merchant',
          times: Math.round((tx.value / usual) * 10) / 10,
        });
      }
      continue;
    }

    // Lugar novo: sem "de sempre" para comparar, o parametro passa a ser o
    // tamanho das compras que a pessoa costuma fazer.
    if (ceiling > 0 && tx.value >= Math.max(ceiling * UNUSUAL_FACTOR, MIN_AMOUNT)) {
      out.push({
        transactionId: tx.id,
        description: tx.description,
        amount: tx.value,
        typical: ceiling,
        reason: 'unusual',
        times: Math.round((tx.value / ceiling) * 10) / 10,
      });
    }
  }

  return out.sort((a, b) => b.amount - a.amount).slice(0, MAX_ANOMALIES);
}

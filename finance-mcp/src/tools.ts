/**
 * Catalogo de tools expostas ao cliente MCP.
 *
 * Todas sao somente leitura: cada uma mapeia para um GET do finance-app.
 * As respostas passam por um enxugamento antes de virar JSON — o modelo paga
 * tokens por campo, entao ids internos da Pluggy e timestamps de auditoria
 * ficam de fora do que nao precisa deles.
 */

import { FinanceApi } from './api.js';
import { localDateTime, monthBounds } from './timezone.js';

/** Schema JSON de um argumento de mes, reaproveitado em varias tools. */
const MES = {
  type: 'string',
  pattern: '^\\d{4}-\\d{2}$',
  description: "Mes no formato 'YYYY-MM' (ex.: '2026-07').",
} as const;

/**
 * Sinal economico do valor. Compras de cartao chegam da Pluggy como DEBIT
 * com valor positivo, entao quem manda e o `type`, nao o numero — mesma
 * regra do AnalyticsService. Sem isto o modelo somaria gasto como receita.
 */
function signedAmount(amount: unknown, type: string | null | undefined): number {
  const raw = Number(amount);
  if (type === 'DEBIT') return -Math.abs(raw);
  if (type === 'CREDIT') return Math.abs(raw);
  return raw;
}

function accountLabel(account: {
  name?: string | null;
  marketingName?: string | null;
  item?: { connectorName?: string | null } | null;
}): string {
  return (
    account.marketingName ?? account.name ?? account.item?.connectorName ?? 'conta'
  );
}

function num(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/**
 * Valida 'YYYY-MM' antes de virar Date.
 *
 * O servidor MCP nao valida inputSchema por conta propria: sem isto, um mes
 * escrito como "julho" chegava ao `new Date()` e o modelo recebia um
 * "Invalid time value" que nao diz o que consertar.
 */
function requireMonth(value: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error(
      `Mes invalido: "${value}". Use o formato YYYY-MM (ex.: 2026-07). ` +
        'Chame listar_meses para ver os meses disponiveis.',
    );
  }
  return value;
}

export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run(api: FinanceApi, args: Record<string, any>): Promise<unknown>;
}

export const TOOLS: Tool[] = [
  {
    name: 'listar_meses',
    title: 'Meses disponiveis',
    description:
      'Lista os meses (YYYY-MM) que tem transacoes sincronizadas, do mais antigo ao mais recente. ' +
      'Use antes de qualquer analise para saber o intervalo real de dados e qual e o mes corrente.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run(api) {
      const meses = await api.get<string[]>('/analytics/months');
      return { meses, mesMaisRecente: meses.at(-1) ?? null };
    },
  },

  {
    name: 'relatorio_mensal',
    title: 'Relatorio do mes',
    description:
      'Relatorio completo de um mes: receita, gastos, sobra, quebra por categoria, assinaturas ' +
      'detectadas, score de saude, projecao ate o fim do mes, custo dos habitos, reserva de ' +
      'emergencia e um resumo em linguagem natural. E a fonte mais rica — prefira esta tool a ' +
      'somar transacoes na mao.',
    inputSchema: {
      type: 'object',
      properties: {
        mes: { ...MES, description: `${MES.description} Padrao: o mes mais recente.` },
        contaId: {
          type: 'string',
          description: 'Opcional: restringe a uma conta especifica (id de contas_e_saldos).',
        },
      },
      additionalProperties: false,
    },
    run: (api, args) =>
      api.get('/analytics/report', {
        month: args.mes ? requireMonth(args.mes) : undefined,
        accountId: args.contaId,
      }),
  },

  {
    name: 'serie_mensal',
    title: 'Serie historica',
    description:
      'Serie mes a mes com renda, consumo, sobra e principais categorias. Use para comparar ' +
      'meses, achar tendencia ou responder "gastei mais que o normal?".',
    inputSchema: {
      type: 'object',
      properties: {
        meses: {
          type: 'integer',
          minimum: 1,
          maximum: 36,
          description: 'Quantos meses recentes retornar (padrao 12, maximo 36).',
        },
        contaId: { type: 'string', description: 'Opcional: restringe a uma conta.' },
      },
      additionalProperties: false,
    },
    run: (api, args) =>
      api.get('/analytics/series', { months: args.meses, accountId: args.contaId }),
  },

  {
    name: 'contas_e_saldos',
    title: 'Contas e saldos',
    description:
      'Contas conectadas com saldo atual, banco de origem e, nos cartoes de credito, limite, ' +
      'fatura atual, fechamento e vencimento. Responde "quanto tenho hoje?" e "quando vence a fatura?".',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run(api) {
      const accounts = await api.get<any[]>('/pluggy/db/accounts');
      const contas = accounts.map((a) => {
        const credito = a.type === 'CREDIT';
        return {
          id: a.id,
          nome: accountLabel(a),
          banco: a.item?.connectorName ?? null,
          tipo: a.type, // BANK | CREDIT
          subtipo: a.subtype, // CHECKING_ACCOUNT | CREDIT_CARD | MANUAL (Carteira)
          // Em cartao o `balance` e a fatura em aberto (divida), nao dinheiro
          // disponivel — e o sinal varia por instituicao, entao vai em modulo.
          ...(credito
            ? {
                faturaAtual: Math.abs(Number(a.balance ?? 0)),
                limiteCredito: num(a.creditLimit),
                limiteDisponivel: num(a.availableCreditLimit),
                pagamentoMinimo: num(a.minimumPayment),
                fechamentoFatura: a.balanceCloseDate,
                vencimentoFatura: a.balanceDueDate,
              }
            : { saldo: num(a.balance) }),
          transacoes: a._count?.transactions ?? null,
          ultimaSincronizacao: a.item?.lastSyncedAt ?? null,
        };
      });
      const somar = (tipo: string, campo: 'saldo' | 'faturaAtual') =>
        contas
          .filter((c) => c.tipo === tipo)
          .reduce((sum, c) => sum + ((c as any)[campo] ?? 0), 0);
      return {
        // Mesmo criterio do relatorio do app: so contas BANK contam como saldo.
        totalEmConta: somar('BANK', 'saldo'),
        totalFaturasAbertas: somar('CREDIT', 'faturaAtual'),
        contas,
      };
    },
  },

  {
    name: 'investimentos',
    title: 'Investimentos',
    description:
      'Posicoes de investimento ativas com saldo atual (rendimento ja embutido) e o total aplicado. ' +
      'Posicoes totalmente resgatadas ficam de fora.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run(api) {
      const data = await api.get<{ total: number; investments: any[] }>(
        '/pluggy/db/investments',
      );
      return {
        total: data.total,
        investimentos: data.investments.map((i) => ({
          nome: i.name,
          instituicao: i.item?.connectorName ?? null,
          tipo: i.type,
          subtipo: i.subtype,
          saldoAtual: num(i.balance),
          valorAplicado: num(i.amount),
          status: i.status,
          data: i.date,
        })),
      };
    },
  },

  {
    name: 'transacoes',
    title: 'Transacoes',
    description:
      'Lancamentos individuais, do mais recente ao mais antigo, com filtro por mes, periodo, ' +
      'categoria, busca na descricao e conta. O campo `valor` ja vem com sinal economico ' +
      '(negativo = saiu dinheiro). Use quando precisar do detalhe — para totais do mes, ' +
      'relatorio_mensal e mais barato e mais confiavel.',
    inputSchema: {
      type: 'object',
      properties: {
        mes: { ...MES, description: `${MES.description} Atalho para de/ate no fuso de Brasilia.` },
        de: { type: 'string', description: "Data inicial 'YYYY-MM-DD' (ignorada se `mes` vier)." },
        ate: { type: 'string', description: "Data final 'YYYY-MM-DD' (ignorada se `mes` vier)." },
        categoria: {
          type: 'string',
          description: 'Categoria exata, sem diferenciar maiusculas (ex.: "Food and drinks").',
        },
        busca: { type: 'string', description: 'Trecho da descricao (ex.: "uber", "netflix").' },
        contaId: { type: 'string', description: 'Id de uma conta de contas_e_saldos.' },
        limite: {
          type: 'integer',
          minimum: 1,
          maximum: 500,
          description: 'Quantas transacoes retornar (padrao 50).',
        },
        pular: { type: 'integer', minimum: 0, description: 'Quantas pular, para paginar.' },
      },
      additionalProperties: false,
    },
    async run(api, args) {
      const janela = args.mes
        ? monthBounds(requireMonth(args.mes))
        : { from: args.de, to: args.ate };
      const data = await api.get<{ total: number; transactions: any[]; hasMore: boolean }>(
        '/pluggy/db/transactions',
        {
          from: janela.from,
          to: janela.to,
          category: args.categoria,
          search: args.busca,
          accountId: args.contaId,
          take: args.limite ?? 50,
          skip: args.pular,
        },
      );
      return {
        total: data.total,
        exibidas: data.transactions.length,
        temMais: data.hasMore,
        transacoes: data.transactions.map((t) => ({
          id: t.id,
          data: localDateTime(t.date),
          descricao: t.description ?? t.descriptionRaw,
          valor: signedAmount(t.amount, t.type),
          categoria: t.category,
          conta: accountLabel(t.account ?? {}),
          banco: t.account?.item?.connectorName ?? null,
        })),
      };
    },
  },

  {
    name: 'metas',
    title: 'Metas de poupanca',
    description:
      'Metas cadastradas com valor alvo, quanto ja foi poupado, aporte mensal planejado, prazo, ' +
      'status e o historico de aportes por mes.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run(api) {
      const goals = await api.get<any[]>('/goals');
      return goals.map((g) => ({
        id: g.id,
        nome: g.name,
        valorAlvo: num(g.targetAmount),
        jaPoupado: num(g.saved),
        faltam: Number(g.targetAmount) - Number(g.saved),
        aporteMensalPlanejado: num(g.monthlyContribution),
        prazo: g.deadline,
        status: g.status, // ACTIVE | READY | DONE
        aportes: (g.entries ?? []).map((e: any) => ({
          mes: e.month,
          valor: num(e.amount),
        })),
      }));
    },
  },

  {
    name: 'parcelas',
    title: 'Compras parceladas em aberto',
    description:
      'Compras parceladas que ainda tem parcela a vencer, remontadas a partir do extrato dos cartoes, ' +
      'e quanto de cada mes futuro elas ja ocupam. Use quando a pergunta for sobre divida ja contratada, ' +
      'se cabe parcelar algo novo, ou por que a fatura dos proximos meses ja esta comprometida. ' +
      'Nao aparece em transacoes: la so existe a parcela do mes.',
    inputSchema: {
      type: 'object',
      properties: {
        meses: {
          type: 'integer',
          minimum: 1,
          maximum: 24,
          description: 'Tamanho do cronograma em meses (padrao 6).',
        },
      },
      additionalProperties: false,
    },
    async run(api, args) {
      const data = await api.get<any>('/installments', { months: args.meses ?? 6 });
      return {
        mesDeReferencia: data.month,
        totalAindaAPagar: data.committedTotal,
        rendaMensalDeReferencia: data.monthlyIncome,
        percentualDaRendaNesteMes: data.currentSharePct,
        livreAPartirDe: data.freeFrom,
        porMes: (data.monthly ?? []).map((m: any) => ({
          mes: m.month,
          valor: m.amount,
          compras: m.count,
        })),
        compras: (data.plans ?? []).map((p: any) => ({
          descricao: p.description,
          cartao: p.accountName,
          valorDaParcela: p.installmentAmount,
          parcelasPagas: p.paidInstallments,
          totalDeParcelas: p.totalInstallments,
          faltamParcelas: p.remaining,
          faltaPagar: p.remainingAmount,
          valorTotalDaCompra: p.totalAmount,
          ultimaParcelaEm: p.endsOn,
        })),
      };
    },
  },

  {
    name: 'orcamentos',
    title: 'Orcamentos',
    description:
      'Limites de gasto configurados por categoria. A categoria "_global" e o teto geral do mes, ' +
      'nao uma categoria de verdade.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run(api) {
      const budgets = await api.get<any[]>('/budgets');
      return budgets.map((b) => ({
        categoria: b.category === '_global' ? 'TETO GERAL DO MES' : b.category,
        limite: num(b.amount),
      }));
    },
  },
];

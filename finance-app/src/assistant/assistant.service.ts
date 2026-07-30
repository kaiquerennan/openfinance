import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';

const MODEL = 'gemini-flash-latest';
/** Quantos meses de historico (alem do mes-alvo) entram no contexto geral. */
const HISTORY_MONTHS = 12;

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private client: GoogleGenAI | null = null;

  constructor(
    private readonly analytics: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new InternalServerErrorException(
          'GEMINI_API_KEY não configurada no servidor',
        );
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * Responde uma pergunta usando como contexto: as contas/saldos atuais, um
   * historico resumido dos ultimos meses e o relatorio completo do mes-alvo
   * (default: mes mais recente). Cobre tanto perguntas gerais ("quanto tenho
   * no total?") quanto especificas de um mes ("quanto gastei em julho?").
   */
  async ask(question: string, month?: string): Promise<{ answer: string }> {
    const months = await this.analytics.availableMonths();
    if (!months.length) {
      return {
        answer:
          'Ainda não há transações sincronizadas para analisar. Conecte um banco primeiro.',
      };
    }
    const targetMonth = month ?? months[months.length - 1];

    const [currentReport, accounts, goals, budgets] = await Promise.all([
      this.analytics.report(targetMonth),
      this.prisma.account.findMany({
        include: { item: { select: { connectorName: true } } },
      }),
      this.prisma.goal.findMany({ include: { entries: true } }),
      this.prisma.budget.findMany(),
    ]);

    const accountsSummary = accounts.map((a) => ({
      nome: a.marketingName ?? a.name ?? a.item.connectorName,
      tipo: a.type,
      subtipo: a.subtype,
      saldoAtual: a.balance,
    }));

    const goalsSummary = goals.map((g) => ({
      nome: g.name,
      valorAlvo: g.targetAmount,
      jaPoupado:
        Number(g.initialAmount) + g.entries.reduce((s, e) => s + Number(e.amount), 0),
      aporteMensalPlanejado: g.monthlyContribution,
      prazo: g.deadline,
      status: g.status,
    }));

    // Historico resumido: uma serie agregada, nao um relatorio completo por
    // mes. Antes eram ate 12 relatorios (cada um reprocessando o extrato
    // inteiro) so para montar o contexto de uma pergunta.
    const history = (await this.analytics.series(HISTORY_MONTHS))
      .filter((p) => p.month !== targetMonth)
      .map((p) => ({
        mes: p.month,
        income: p.income,
        consumption: p.consumption,
        savings: p.savings,
      }));

    const systemInstruction =
      'Você é um consultor financeiro pessoal, respondendo em português do Brasil ' +
      'com acentuação correta, de forma direta e concisa (poucos parágrafos). Os ' +
      'dados JSON abaixo (contas, histórico de meses, detalhe do mês mais recente) ' +
      'são sua ÚNICA fonte para fatos sobre o usuário (saldos, gastos, renda, ' +
      'categorias) — nunca invente ou estime um desses valores caso não estejam ' +
      'presentes nos dados; diga que a informação não está disponível. ISSO NÃO SE ' +
      'APLICA a números que o próprio usuário informar na pergunta (uma meta, um ' +
      'valor hipotético, um prazo etc.) — nesses casos, faça o cálculo ou projeção ' +
      'normalmente combinando esse número com os dados reais fornecidos (ex.: ' +
      'quanto falta para uma meta, quanto precisaria poupar por mês, simulações). ' +
      'Responda em texto plano, sem markdown (sem **negrito**, sem #, sem listas ' +
      'com -), pois o texto aparece cru na tela.\n\n' +
      `Contas conectadas e saldo atual (JSON):\n${JSON.stringify(accountsSummary)}\n\n` +
      `Metas de poupança cadastradas pelo usuário (JSON):\n${JSON.stringify(goalsSummary)}\n\n` +
      `Limites de gasto (orçamentos) definidos (JSON):\n${JSON.stringify(budgets)}\n\n` +
      `Histórico resumido de outros meses (JSON):\n${JSON.stringify(history)}\n\n` +
      `Dados completos do mês ${targetMonth} (JSON):\n${JSON.stringify(currentReport.data)}\n\n` +
      'Frases já interpretadas por um consultor de regras sobre o mês acima ' +
      '(use como referência de interpretação correta dos números, especialmente ' +
      'sinais de ganho/perda em campos como "gamblingNet"):\n' +
      `${JSON.stringify(currentReport.narrative)}`;

    try {
      const response = await this.getClient().models.generateContent({
        model: MODEL,
        contents: question,
        config: { systemInstruction },
      });
      return { answer: response.text ?? '' };
    } catch (err) {
      this.logger.error(`Falha ao consultar Gemini: ${(err as Error).message}`);
      throw new InternalServerErrorException('Falha ao consultar o assistente');
    }
  }
}

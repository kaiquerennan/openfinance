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

    const [currentReport, accounts] = await Promise.all([
      this.analytics.report(targetMonth),
      this.prisma.account.findMany({
        include: { item: { select: { connectorName: true } } },
      }),
    ]);

    const accountsSummary = accounts.map((a) => ({
      nome: a.marketingName ?? a.name ?? a.item.connectorName,
      tipo: a.type,
      subtipo: a.subtype,
      saldoAtual: a.balance,
    }));

    const otherMonths = months.slice(-HISTORY_MONTHS).filter((m) => m !== targetMonth);
    const history = await Promise.all(
      otherMonths.map(async (m) => {
        const r = await this.analytics.report(m);
        return { mes: m, ...r.data.summary };
      }),
    );

    const systemInstruction =
      'Você é um consultor financeiro pessoal, respondendo em português do Brasil ' +
      'com acentuação correta, de forma direta e concisa (poucos parágrafos). Use ' +
      'APENAS os dados JSON abaixo como base factual — eles cobrem tanto o estado ' +
      'geral (contas e saldos atuais, histórico resumido de vários meses) quanto o ' +
      'detalhe completo do mês mais relevante. Se a pergunta pedir algo fora desses ' +
      'dados (ex.: um mês sem histórico disponível), diga isso claramente em vez de ' +
      'inventar números. Responda em texto plano, sem markdown (sem **negrito**, ' +
      'sem #, sem listas com -), pois o texto aparece cru na tela.\n\n' +
      `Contas conectadas e saldo atual (JSON):\n${JSON.stringify(accountsSummary)}\n\n` +
      `Histórico resumido de outros meses (JSON):\n${JSON.stringify(history)}\n\n` +
      `Dados completos do mês ${targetMonth} (JSON):\n${JSON.stringify(currentReport.data)}`;

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

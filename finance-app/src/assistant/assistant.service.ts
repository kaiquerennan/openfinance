import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { AnalyticsService } from '../analytics/analytics.service';

const MODEL = 'gemini-flash-latest';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private client: GoogleGenAI | null = null;

  constructor(private readonly analytics: AnalyticsService) {}

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new InternalServerErrorException(
          'GEMINI_API_KEY nao configurada no servidor',
        );
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  /** Responde uma pergunta usando o relatorio financeiro do mes como contexto. */
  async ask(question: string, month?: string): Promise<{ answer: string }> {
    const report = await this.analytics.report(month);

    const systemInstruction =
      'Voce e um consultor financeiro pessoal, respondendo em portugues do Brasil, ' +
      'de forma direta e concisa (poucos paragrafos). Use APENAS os dados JSON ' +
      'abaixo (analise financeira do usuario no mes) como base factual. Se a ' +
      'pergunta nao puder ser respondida com esses dados, diga isso claramente ' +
      'em vez de inventar numeros. Responda em texto plano, sem markdown ' +
      '(sem **negrito**, sem #, sem listas com -), pois o texto aparece cru na tela.\n\n' +
      `Dados financeiros (JSON):\n${JSON.stringify(report.data)}`;

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

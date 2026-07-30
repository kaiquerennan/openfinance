import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { dayOfMonth, monthKey } from '../analytics/timezone';

/**
 * Intervalo minimo entre dois envios do mesmo alerta.
 *
 * O sync roda de 3 em 3 horas; sem isto, "sua fatura vence em 3 dias" chegaria
 * 8 vezes por dia e viraria ruido — e alerta que vira ruido deixa de ser lido.
 */
const REPEAT_AFTER_HOURS = 20;

/** Aumento mensal minimo (R$) para um reajuste virar notificacao. */
const MIN_RAISE_TO_ALERT = 5;

interface Alert {
  /** Identidade do alerta. Muda quando o conteudo muda de verdade. */
  key: string;
  text: string;
}

const brl = (n: number) =>
  `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Avisos que procuram o usuario em vez de esperar ele abrir o app.
 *
 * Roda depois de cada sincronizacao: e o unico momento em que os dados
 * acabaram de mudar e um aviso ainda da tempo de mudar uma decisao.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly config: ConfigService,
  ) {}

  /** Monta os alertas do momento e envia os que ainda nao foram avisados. */
  async run(): Promise<void> {
    const alerts = await this.collect().catch((err) => {
      this.logger.error(`Falha ao montar alertas: ${(err as Error).message}`);
      return [] as Alert[];
    });
    if (!alerts.length) return;

    const pending = await this.filterAlreadySent(alerts);
    if (!pending.length) {
      this.logger.log('Nenhum alerta novo para enviar.');
      return;
    }

    const sent = await this.send(pending.map((a) => a.text));
    if (!sent) return;

    await this.prisma.$transaction(
      pending.map((a) =>
        this.prisma.alertLog.upsert({
          where: { key: a.key },
          create: { key: a.key, sentAt: new Date() },
          update: { sentAt: new Date() },
        }),
      ),
    );
    this.logger.log(`${pending.length} alerta(s) enviado(s).`);
  }

  // ---------------------------------------------------------------------------

  private async collect(): Promise<Alert[]> {
    const month = monthKey(new Date());
    const [report, budgets, accounts] = await Promise.all([
      this.analytics.report(month).catch(() => null),
      this.prisma.budget.findMany(),
      this.prisma.account.findMany({ where: { type: 'CREDIT' } }),
    ]);
    if (!report) return [];

    const out: Alert[] = [];
    const { summary, outlook, subscriptions } = report.data;

    // 1) Limite mensal perto do fim ou estourado
    const global = budgets.find((b) => b.category === '_global');
    if (global) {
      const limit = Number(global.amount);
      const used = summary.consumption;
      const share = limit > 0 ? (used / limit) * 100 : 0;
      const restantes = outlook ? outlook.daysInMonth - outlook.today : 0;
      if (share >= 100) {
        out.push({
          key: `budget-over:${month}`,
          text: `Você passou do limite do mês: ${brl(used)} gastos de ${brl(limit)} planejados.`,
        });
      } else if (share >= 80 && restantes > 3) {
        out.push({
          key: `budget-80:${month}`,
          text: `Você já usou ${Math.round(share)}% do limite do mês e ainda faltam ${restantes} dias.`,
        });
      }
    }

    // 2) Fatura de cartao vencendo
    const hoje = new Date();
    for (const card of accounts) {
      if (!card.balanceDueDate) continue;
      const dias = Math.round(
        (card.balanceDueDate.getTime() - hoje.getTime()) / 86_400_000,
      );
      if (dias < 0 || dias > 3) continue;
      const nome = card.marketingName ?? card.name ?? 'cartão';
      const quando = dias === 0 ? 'vence hoje' : `vence em ${dias} dia(s)`;
      out.push({
        key: `card-due:${card.id}:${card.balanceDueDate.toISOString().slice(0, 10)}`,
        text: `A fatura do ${nome} ${quando}: ${brl(Math.abs(Number(card.balance ?? 0)))}.`,
      });
    }

    // 3) Saldo projetado para o negativo antes do fim do mes
    if (outlook?.negativeFromDay != null) {
      out.push({
        key: `negative:${month}:${outlook.negativeFromDay}`,
        text: `No ritmo atual (${brl(outlook.dailyRate)}/dia) seu saldo fica negativo no dia ${outlook.negativeFromDay}.`,
      });
    }

    // 4) Assinatura reajustada, se o aumento pesar no bolso.
    // Na tela vale mostrar qualquer variacao; para interromper alguem com uma
    // notificacao, um reajuste de centavos nao justifica.
    for (const s of subscriptions.items) {
      if (s.increasePct == null) continue;
      const aumento = s.currentAmount - s.monthlyAmount;
      if (aumento < MIN_RAISE_TO_ALERT) continue;
      out.push({
        key: `sub-raise:${s.description}:${s.currentAmount}`,
        text: `"${s.description}" subiu ${s.increasePct}%: a última cobrança foi ${brl(s.currentAmount)}.`,
      });
    }

    return out;
  }

  /** Descarta alertas ja enviados dentro da janela de repeticao. */
  private async filterAlreadySent(alerts: Alert[]): Promise<Alert[]> {
    const logs = await this.prisma.alertLog.findMany({
      where: { key: { in: alerts.map((a) => a.key) } },
    });
    const lastSent = new Map(logs.map((l) => [l.key, l.sentAt.getTime()]));
    const limit = Date.now() - REPEAT_AFTER_HOURS * 3_600_000;
    return alerts.filter((a) => (lastSent.get(a.key) ?? 0) < limit);
  }

  /**
   * Entrega via Telegram. Sem as variaveis configuradas o alerta so vai para o
   * log — o app continua funcionando, apenas sem notificacao.
   */
  private async send(messages: string[]): Promise<boolean> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID');
    const text = messages.map((m) => `• ${m}`).join('\n');

    if (!token || !chatId) {
      this.logger.log(`Alertas (sem canal configurado):\n${text}`);
      return false;
    }

    try {
      await axios.post(
        `https://api.telegram.org/bot${token}/sendMessage`,
        { chat_id: chatId, text: `Visor — seus alertas\n\n${text}` },
        { timeout: 10_000 },
      );
      return true;
    } catch (err) {
      this.logger.error(`Falha ao enviar alertas: ${(err as Error).message}`);
      return false;
    }
  }
}

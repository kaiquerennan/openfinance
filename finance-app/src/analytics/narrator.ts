import { AnalyticsData, AnalyticsNarrative } from './analytics.types';

/**
 * Contrato do gerador de narrativa. Hoje temos a implementação por regras
 * (RuleBasedNarrator). No futuro, um AiNarrator (Claude) implementa a mesma
 * interface recebendo o AnalyticsData como "fatos" e só trocamos o provider.
 */
export interface InsightNarrator {
  narrate(data: AnalyticsData): AnalyticsNarrative;
}

const brl = (n: number) =>
  `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number | null) =>
  n == null ? 's/ base' : `${n > 0 ? '+' : ''}${n}%`;

/** Narrador determinístico: transforma métricas em frases de consultor. */
export class RuleBasedNarrator implements InsightNarrator {
  narrate(d: AnalyticsData): AnalyticsNarrative {
    return {
      avisos: d.dataQuality.notes,
      resumoGeral: this.resumo(d),
      analiseCategorias: this.categorias(d),
      mapaDestino: this.destino(d),
      mudancasComportamento: this.comportamento(d),
      tendencia: this.tendencia(d),
      assinaturas: this.assinaturas(d),
      desperdicios: this.desperdicios(d),
      alertas: this.alertas(d),
      oportunidades: this.oportunidades(d),
      previsoes: this.previsoes(d),
      indiceSaude: this.saude(d),
      insightsAutomaticos: this.insights(d),
      comportamentosPositivos: this.positivos(d),
      recomendacoes: this.recomendacoes(d),
    };
  }

  private resumo(d: AnalyticsData): string[] {
    const s = d.summary;
    if (!d.dataQuality.incomeReliable) {
      // Sem renda confiável, foca no consumo absoluto (que é mensurável).
      const out = [
        `No mês ${d.period.month} você gastou ${brl(s.consumption)} em consumo.`,
        `Não dá pra medir com segurança o quanto isso compromete sua renda (sem salário identificável nos dados).`,
      ];
      if (s.changeVsPrevPct != null)
        out.push(
          s.changeVsPrevPct <= 0
            ? `Seu consumo foi ${Math.abs(s.changeVsPrevPct)}% menor que o mês anterior.`
            : `Seu consumo foi ${s.changeVsPrevPct}% maior que o mês anterior.`,
        );
      return out;
    }
    const out = [
      `No mês ${d.period.month} você teve ${brl(s.income)} de entradas e gastou ${brl(s.consumption)} em consumo.`,
      `Seu consumo representa ${s.commitmentPct}% da sua renda — situação ${s.classification.toLowerCase()}.`,
    ];
    if (s.savings >= 0)
      out.push(`Sobraram ${brl(s.savings)} após consumo, taxas e dívidas.`);
    else
      out.push(`Você ficou ${brl(Math.abs(s.savings))} no negativo após consumo, taxas e dívidas.`);
    if (s.changeVsPrevPct != null)
      out.push(
        s.changeVsPrevPct <= 0
          ? `Houve melhora: consumo ${Math.abs(s.changeVsPrevPct)}% menor que o mês anterior.`
          : `Atenção: consumo ${s.changeVsPrevPct}% maior que o mês anterior.`,
      );
    return out;
  }

  private categorias(d: AnalyticsData): string[] {
    const out: string[] = [];
    const top = d.categories.slice(0, 3);
    for (const c of top)
      out.push(`${c.category} representa ${c.share}% do seu consumo (${brl(c.total)}).`);
    const growing = d.categories.filter((c) => c.growthPct != null && c.growthPct > 20);
    for (const c of growing.slice(0, 2))
      out.push(`Seus gastos com ${c.category} subiram ${c.growthPct}% vs o mês passado.`);
    const shrinking = d.categories.filter((c) => c.growthPct != null && c.growthPct < -15);
    for (const c of shrinking.slice(0, 2))
      out.push(`${c.category} caiu ${Math.abs(c.growthPct!)}% — bom controle.`);
    const aboveAvg = d.categories.filter((c) => c.vsHistAvgPct != null && c.vsHistAvgPct > 30);
    for (const c of aboveAvg.slice(0, 2))
      out.push(`${c.category} está ${c.vsHistAvgPct}% acima da sua média histórica.`);
    return out.length ? out : ['Sem consumo categorizado relevante no período.'];
  }

  private destino(d: AnalyticsData): string[] {
    const m = d.moneyDestination;
    if (!d.dataQuality.incomeReliable)
      return [
        'Sem uma renda confiável nos dados, o mapa de destino por % não é significativo. Use a análise de categorias para ver onde o consumo se concentra.',
      ];
    if (m.income <= 0)
      return ['Não houve renda identificada no período para mapear o destino do dinheiro.'];
    const out = [`Dos ${brl(m.income)} que entraram:`];
    for (const s of m.slices.slice(0, 5))
      out.push(`- ${s.share}% foram para ${s.label} (${brl(s.amount)}).`);
    out.push(
      m.leftover >= 0
        ? `- ${m.leftoverShare}% permaneceram como saldo/poupança (${brl(m.leftover)}).`
        : `- Você gastou ${brl(Math.abs(m.leftover))} além do que recebeu.`,
    );
    return out;
  }

  private comportamento(d: AnalyticsData): string[] {
    const b = d.behavior;
    const out: string[] = [];
    if (b.weekendSharePct >= 35)
      out.push(`${b.weekendSharePct}% das suas compras acontecem nos fins de semana.`);
    if (b.nightSharePct >= 25)
      out.push(`${b.nightSharePct}% das suas transações são noturnas (22h-6h).`);
    if (b.deliveryCountThisMonth > b.deliveryCountPrevMonth && b.deliveryCountPrevMonth >= 0)
      out.push(
        `Seus pedidos de delivery passaram de ${b.deliveryCountPrevMonth} para ${b.deliveryCountThisMonth} neste mês.`,
      );
    out.push(`Média de ${b.avgTransactionsPerDay} compras de consumo por dia.`);
    return out;
  }

  private tendencia(d: AnalyticsData): string[] {
    const get = (w: string) => d.trends.find((t) => t.window === w)!;
    const t3 = get('3m');
    const t6 = get('6m');
    const t12 = get('12m');
    const out = [
      `Últimos 3 meses: ${brl(t3.consumption)} de consumo, taxa de poupança ${t3.savingsRatePct}%.`,
      `Últimos 6 meses: poupança ${t6.savingsRatePct}%. Últimos 12: ${t12.savingsRatePct}%.`,
    ];
    if (t3.savingsRatePct < t6.savingsRatePct)
      out.push('Sua capacidade de poupança caiu nos últimos 3 meses.');
    else out.push('Sua capacidade de poupança melhorou no curto prazo.');
    return out;
  }

  private assinaturas(d: AnalyticsData): string[] {
    const s = d.subscriptions;
    if (!s.items.length) return ['Nenhuma cobrança recorrente clara foi detectada.'];
    const out = [
      `Você tem ${s.items.length} cobrança(s) recorrente(s), somando ${brl(s.monthlyTotal)}/mês (${brl(s.annualTotal)}/ano).`,
    ];
    for (const i of s.items.slice(0, 6))
      out.push(`- "${i.description}": ${brl(i.monthlyAmount)}/mês (visto em ${i.monthsSeen} meses).`);
    return out;
  }

  private desperdicios(d: AnalyticsData): string[] {
    if (!d.waste.length) return ['Nenhum desperdício evidente no período.'];
    return d.waste.map((w) => w.note);
  }

  private alertas(d: AnalyticsData): string[] {
    const out: string[] = [];
    const s = d.summary;
    if (d.dataQuality.incomeReliable) {
      if (s.commitmentPct > 100)
        out.push('Seus gastos ultrapassaram sua renda neste mês.');
      else if (s.commitmentPct > 85)
        out.push(`Mais de 85% da sua renda está comprometida (${s.commitmentPct}%).`);
    }
    if (s.changeVsPrevPct != null && s.changeVsPrevPct > 25)
      out.push(`Seu consumo cresceu ${s.changeVsPrevPct}% em um mês — ritmo acelerado.`);
    if (d.movements.debt > 0)
      out.push(`Você teve ${brl(d.movements.debt)} em dívidas/financiamento no mês.`);
    if (d.movements.gamblingNet != null && d.movements.gamblingNet < 0)
      out.push(`Resultado líquido em apostas no mês: perda de ${brl(Math.abs(d.movements.gamblingNet))} (descontando o que voltou da mesma casa).`);
    const t3 = d.trends.find((t) => t.window === '3m')!;
    if (t3.savingsRatePct < 0)
      out.push('Nos últimos 3 meses você gastou mais do que recebeu (poupança negativa).');
    return out.length ? out : ['Nenhum alerta crítico no momento.'];
  }

  private oportunidades(d: AnalyticsData): string[] {
    const out: string[] = [];
    const delivery = d.waste.find((w) => w.label.toLowerCase().includes('delivery'));
    if (delivery && delivery.total > 0)
      out.push(
        `Reduzir delivery pela metade economizaria cerca de ${brl(delivery.total / 2)}/mês.`,
      );
    if (d.subscriptions.items.length >= 2) {
      // "Menos usada" = vista em menos meses; empate desempata pelo maior
      // valor, que e onde o corte compensa mais. A lista chega ordenada por
      // valor, entao precisa reordenar antes de escolher.
      const leastUsed = [...d.subscriptions.items]
        .sort((a, b) => a.monthsSeen - b.monthsSeen || b.monthlyAmount - a.monthlyAmount)
        .slice(0, 2);
      const econ = leastUsed.reduce((a, b) => a + b.monthlyAmount, 0);
      const nomes = leastUsed.map((s) => `"${s.description}"`).join(' e ');
      out.push(
        `Revisar as 2 assinaturas menos usadas (${nomes}) pode liberar até ${brl(econ)}/mês (${brl(econ * 12)}/ano).`,
      );
    }
    const gambling = d.categories.find((c) => c.category.toLowerCase() === 'gambling');
    if (gambling)
      out.push(`Cortar apostas economizaria ${brl(gambling.total)}/mês.`);
    return out.length ? out : ['Sem oportunidades óbvias de economia neste período.'];
  }

  private previsoes(d: AnalyticsData): string[] {
    const t3 = d.trends.find((t) => t.window === '3m')!;
    const monthlySavings = t3.savings / 3;
    const out: string[] = [];
    out.push(
      monthlySavings >= 0
        ? `Mantendo a média atual, você deve poupar ~${brl(monthlySavings)}/mês (${brl(monthlySavings * 12)}/ano).`
        : `Mantendo o ritmo atual, sua tendência é fechar cada mês ${brl(Math.abs(monthlySavings))} no negativo.`,
    );
    if (d.summary.changeVsPrevPct != null && d.summary.changeVsPrevPct > 0)
      out.push('Se o aumento de consumo continuar, sua taxa de poupança deve cair nos próximos meses.');
    return out;
  }

  private saude(d: AnalyticsData): string[] {
    const h = d.health;
    const out = [`Índice de saúde financeira: ${h.score}/100 — ${h.rating}.`];
    for (const c of h.components)
      out.push(`- ${c.label}: ${c.points}/${c.max} (${c.note}).`);
    return out;
  }

  private insights(d: AnalyticsData): string[] {
    const out: string[] = [];
    const cats = d.categories;
    const delivery = cats.find((c) => c.category.toLowerCase().includes('delivery'));
    const market = cats.find((c) =>
      ['supermarket', 'groceries', 'food and drinks'].includes(c.category.toLowerCase()),
    );
    if (delivery && market && delivery.total > market.total)
      out.push('Você gastou mais com delivery do que com supermercado.');
    if (cats[0]) out.push(`Seu maior gasto de consumo atual é ${cats[0].category}.`);
    const t = d.trends;
    const t1 = t.find((x) => x.window === '1m')!;
    const t6 = t.find((x) => x.window === '6m')!;
    if (t1.savingsRatePct > t6.savingsRatePct)
      out.push('Sua taxa de poupança deste mês está acima da média de 6 meses.');
    if (d.behavior.weekendSharePct >= 40)
      out.push('Boa parte do seu consumo se concentra nos fins de semana.');
    return out.length ? out : ['Sem insights automáticos relevantes neste período.'];
  }

  private positivos(d: AnalyticsData): string[] {
    const out: string[] = [];
    for (const c of d.categories)
      if (c.growthPct != null && c.growthPct < -15)
        out.push(`Você reduziu ${c.category} em ${Math.abs(c.growthPct)}%.`);
    if (d.summary.savings > 0)
      out.push(`Você terminou o mês positivo, poupando ${brl(d.summary.savings)}.`);
    if (d.movements.investmentsNet > 0)
      out.push(`Você aplicou ${brl(d.movements.investmentsNet)} em investimentos.`);
    if (d.movements.gamblingNet != null && d.movements.gamblingNet >= 0)
      out.push(`Resultado líquido em apostas no mês: ganho de ${brl(d.movements.gamblingNet)} (você recuperou mais do que apostou).`);
    const t3 = d.trends.find((t) => t.window === '3m')!;
    const t6 = d.trends.find((t) => t.window === '6m')!;
    if (t3.savingsRatePct > t6.savingsRatePct)
      out.push('Sua capacidade de poupança melhorou no trimestre.');
    return out.length ? out : ['Continue acompanhando para construir bons hábitos.'];
  }

  private recomendacoes(d: AnalyticsData): string[] {
    const out: string[] = [];
    const delivery = d.waste.find((w) => w.label.toLowerCase().includes('delivery'));
    if (delivery && delivery.total > 0)
      out.push(
        `Reduzir delivery em 25% geraria economia de ~${brl(delivery.total * 0.25)}/mês.`,
      );
    if (
      d.dataQuality.incomeReliable &&
      d.subscriptions.monthlyTotal > 0 &&
      d.summary.income > 0
    ) {
      const share = ((d.subscriptions.monthlyTotal / d.summary.income) * 100).toFixed(0);
      out.push(
        `Suas assinaturas somam ${share}% da renda; revise os serviços menos usados.`,
      );
    } else if (d.subscriptions.monthlyTotal > 0) {
      out.push(
        `Suas assinaturas somam ${brl(d.subscriptions.monthlyTotal)}/mês (${brl(d.subscriptions.annualTotal)}/ano); revise os serviços menos usados.`,
      );
    }
    const overBudget = d.categories.find((c) => c.vsHistAvgPct != null && c.vsHistAvgPct > 40);
    if (overBudget)
      out.push(
        `${overBudget.category} está ${overBudget.vsHistAvgPct}% acima da média; definir uma meta mensal ajuda a controlar.`,
      );
    if (d.dataQuality.incomeReliable && d.summary.commitmentPct > 85)
      out.push(
        'Com mais de 85% da renda comprometida, priorize reduzir as 2 maiores categorias de consumo.',
      );
    return out.length ? out : ['Mantenha o padrão atual e revise as metas mensalmente.'];
  }
}

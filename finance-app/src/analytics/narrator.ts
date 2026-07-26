import { AnalyticsData, AnalyticsNarrative } from './analytics.types';

/**
 * Contrato do gerador de narrativa. Hoje temos a implementacao por regras
 * (RuleBasedNarrator). No futuro, um AiNarrator (Claude) implementa a mesma
 * interface recebendo o AnalyticsData como "fatos" e so trocamos o provider.
 */
export interface InsightNarrator {
  narrate(data: AnalyticsData): AnalyticsNarrative;
}

const brl = (n: number) =>
  `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number | null) =>
  n == null ? 's/ base' : `${n > 0 ? '+' : ''}${n}%`;

/** Narrador deterministico: transforma metricas em frases de consultor. */
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
      // Sem renda confiavel, foca no consumo absoluto (que e mensuravel).
      const out = [
        `No mes ${d.period.month} voce gastou ${brl(s.consumption)} em consumo.`,
        `Nao da pra medir com seguranca o quanto isso compromete sua renda (sem salario identificavel nos dados).`,
      ];
      if (s.changeVsPrevPct != null)
        out.push(
          s.changeVsPrevPct <= 0
            ? `Seu consumo foi ${Math.abs(s.changeVsPrevPct)}% menor que o mes anterior.`
            : `Seu consumo foi ${s.changeVsPrevPct}% maior que o mes anterior.`,
        );
      return out;
    }
    const out = [
      `No mes ${d.period.month} voce teve ${brl(s.income)} de entradas e gastou ${brl(s.consumption)} em consumo.`,
      `Seu consumo representa ${s.commitmentPct}% da sua renda — situacao ${s.classification.toLowerCase()}.`,
    ];
    if (s.savings >= 0)
      out.push(`Sobraram ${brl(s.savings)} apos consumo, taxas e dividas.`);
    else
      out.push(`Voce ficou ${brl(Math.abs(s.savings))} no negativo apos consumo, taxas e dividas.`);
    if (s.changeVsPrevPct != null)
      out.push(
        s.changeVsPrevPct <= 0
          ? `Houve melhora: consumo ${Math.abs(s.changeVsPrevPct)}% menor que o mes anterior.`
          : `Atencao: consumo ${s.changeVsPrevPct}% maior que o mes anterior.`,
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
      out.push(`Seus gastos com ${c.category} subiram ${c.growthPct}% vs o mes passado.`);
    const shrinking = d.categories.filter((c) => c.growthPct != null && c.growthPct < -15);
    for (const c of shrinking.slice(0, 2))
      out.push(`${c.category} caiu ${Math.abs(c.growthPct!)}% — bom controle.`);
    const aboveAvg = d.categories.filter((c) => c.vsHistAvgPct != null && c.vsHistAvgPct > 30);
    for (const c of aboveAvg.slice(0, 2))
      out.push(`${c.category} esta ${c.vsHistAvgPct}% acima da sua media historica.`);
    return out.length ? out : ['Sem consumo categorizado relevante no periodo.'];
  }

  private destino(d: AnalyticsData): string[] {
    const m = d.moneyDestination;
    if (!d.dataQuality.incomeReliable)
      return [
        'Sem uma renda confiavel nos dados, o mapa de destino por % nao e significativo. Use a analise de categorias para ver onde o consumo se concentra.',
      ];
    if (m.income <= 0)
      return ['Nao houve renda identificada no periodo para mapear o destino do dinheiro.'];
    const out = [`Dos ${brl(m.income)} que entraram:`];
    for (const s of m.slices.slice(0, 5))
      out.push(`- ${s.share}% foram para ${s.label} (${brl(s.amount)}).`);
    out.push(
      m.leftover >= 0
        ? `- ${m.leftoverShare}% permaneceram como saldo/poupanca (${brl(m.leftover)}).`
        : `- Voce gastou ${brl(Math.abs(m.leftover))} alem do que recebeu.`,
    );
    return out;
  }

  private comportamento(d: AnalyticsData): string[] {
    const b = d.behavior;
    const out: string[] = [];
    if (b.weekendSharePct >= 35)
      out.push(`${b.weekendSharePct}% das suas compras acontecem nos fins de semana.`);
    if (b.nightSharePct >= 25)
      out.push(`${b.nightSharePct}% das suas transacoes sao noturnas (22h-6h).`);
    if (b.deliveryCountThisMonth > b.deliveryCountPrevMonth && b.deliveryCountPrevMonth >= 0)
      out.push(
        `Seus pedidos de delivery passaram de ${b.deliveryCountPrevMonth} para ${b.deliveryCountThisMonth} neste mes.`,
      );
    out.push(`Media de ${b.avgTransactionsPerDay} compras de consumo por dia.`);
    return out;
  }

  private tendencia(d: AnalyticsData): string[] {
    const get = (w: string) => d.trends.find((t) => t.window === w)!;
    const t3 = get('3m');
    const t6 = get('6m');
    const t12 = get('12m');
    const out = [
      `Ultimos 3 meses: ${brl(t3.consumption)} de consumo, taxa de poupanca ${t3.savingsRatePct}%.`,
      `Ultimos 6 meses: poupanca ${t6.savingsRatePct}%. Ultimos 12: ${t12.savingsRatePct}%.`,
    ];
    if (t3.savingsRatePct < t6.savingsRatePct)
      out.push('Sua capacidade de poupanca caiu nos ultimos 3 meses.');
    else out.push('Sua capacidade de poupanca melhorou no curto prazo.');
    return out;
  }

  private assinaturas(d: AnalyticsData): string[] {
    const s = d.subscriptions;
    if (!s.items.length) return ['Nenhuma cobranca recorrente clara foi detectada.'];
    const out = [
      `Voce tem ${s.items.length} cobranca(s) recorrente(s), somando ${brl(s.monthlyTotal)}/mes (${brl(s.annualTotal)}/ano).`,
    ];
    for (const i of s.items.slice(0, 6))
      out.push(`- "${i.description}": ${brl(i.monthlyAmount)}/mes (visto em ${i.monthsSeen} meses).`);
    return out;
  }

  private desperdicios(d: AnalyticsData): string[] {
    if (!d.waste.length) return ['Nenhum desperdicio evidente no periodo.'];
    return d.waste.map((w) => w.note);
  }

  private alertas(d: AnalyticsData): string[] {
    const out: string[] = [];
    const s = d.summary;
    if (d.dataQuality.incomeReliable) {
      if (s.commitmentPct > 100)
        out.push('Seus gastos ultrapassaram sua renda neste mes.');
      else if (s.commitmentPct > 85)
        out.push(`Mais de 85% da sua renda esta comprometida (${s.commitmentPct}%).`);
    }
    if (s.changeVsPrevPct != null && s.changeVsPrevPct > 25)
      out.push(`Seu consumo cresceu ${s.changeVsPrevPct}% em um mes — ritmo acelerado.`);
    if (d.movements.debt > 0)
      out.push(`Voce teve ${brl(d.movements.debt)} em dividas/financiamento no mes.`);
    const t3 = d.trends.find((t) => t.window === '3m')!;
    if (t3.savingsRatePct < 0)
      out.push('Nos ultimos 3 meses voce gastou mais do que recebeu (poupanca negativa).');
    return out.length ? out : ['Nenhum alerta critico no momento.'];
  }

  private oportunidades(d: AnalyticsData): string[] {
    const out: string[] = [];
    const delivery = d.waste.find((w) => w.label.toLowerCase().includes('delivery'));
    if (delivery && delivery.total > 0)
      out.push(
        `Reduzir delivery pela metade economizaria cerca de ${brl(delivery.total / 2)}/mes.`,
      );
    if (d.subscriptions.items.length >= 2) {
      const cheapest = d.subscriptions.items.slice(-2);
      const econ = cheapest.reduce((a, b) => a + b.monthlyAmount, 0);
      out.push(
        `Revisar 2 assinaturas menos usadas pode liberar ate ${brl(econ)}/mes (${brl(econ * 12)}/ano).`,
      );
    }
    const gambling = d.categories.find((c) => c.category.toLowerCase() === 'gambling');
    if (gambling)
      out.push(`Cortar apostas economizaria ${brl(gambling.total)}/mes.`);
    return out.length ? out : ['Sem oportunidades obvias de economia neste periodo.'];
  }

  private previsoes(d: AnalyticsData): string[] {
    const t3 = d.trends.find((t) => t.window === '3m')!;
    const monthlySavings = t3.savings / 3;
    const out: string[] = [];
    out.push(
      monthlySavings >= 0
        ? `Mantendo a media atual, voce deve poupar ~${brl(monthlySavings)}/mes (${brl(monthlySavings * 12)}/ano).`
        : `Mantendo o ritmo atual, sua tendencia e fechar cada mes ${brl(Math.abs(monthlySavings))} no negativo.`,
    );
    if (d.summary.changeVsPrevPct != null && d.summary.changeVsPrevPct > 0)
      out.push('Se o aumento de consumo continuar, sua taxa de poupanca deve cair nos proximos meses.');
    return out;
  }

  private saude(d: AnalyticsData): string[] {
    const h = d.health;
    const out = [`Indice de saude financeira: ${h.score}/100 — ${h.rating}.`];
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
      out.push('Voce gastou mais com delivery do que com supermercado.');
    if (cats[0]) out.push(`Seu maior gasto de consumo atual e ${cats[0].category}.`);
    const t = d.trends;
    const t1 = t.find((x) => x.window === '1m')!;
    const t6 = t.find((x) => x.window === '6m')!;
    if (t1.savingsRatePct > t6.savingsRatePct)
      out.push('Sua taxa de poupanca deste mes esta acima da media de 6 meses.');
    if (d.behavior.weekendSharePct >= 40)
      out.push('Boa parte do seu consumo se concentra nos fins de semana.');
    return out.length ? out : ['Sem insights automaticos relevantes neste periodo.'];
  }

  private positivos(d: AnalyticsData): string[] {
    const out: string[] = [];
    for (const c of d.categories)
      if (c.growthPct != null && c.growthPct < -15)
        out.push(`Voce reduziu ${c.category} em ${Math.abs(c.growthPct)}%.`);
    if (d.summary.savings > 0)
      out.push(`Voce terminou o mes positivo, poupando ${brl(d.summary.savings)}.`);
    if (d.movements.investmentsNet > 0)
      out.push(`Voce aplicou ${brl(d.movements.investmentsNet)} em investimentos.`);
    const t3 = d.trends.find((t) => t.window === '3m')!;
    const t6 = d.trends.find((t) => t.window === '6m')!;
    if (t3.savingsRatePct > t6.savingsRatePct)
      out.push('Sua capacidade de poupanca melhorou no trimestre.');
    return out.length ? out : ['Continue acompanhando para construir bons habitos.'];
  }

  private recomendacoes(d: AnalyticsData): string[] {
    const out: string[] = [];
    const delivery = d.waste.find((w) => w.label.toLowerCase().includes('delivery'));
    if (delivery && delivery.total > 0)
      out.push(
        `Reduzir delivery em 25% geraria economia de ~${brl(delivery.total * 0.25)}/mes.`,
      );
    if (
      d.dataQuality.incomeReliable &&
      d.subscriptions.monthlyTotal > 0 &&
      d.summary.income > 0
    ) {
      const share = ((d.subscriptions.monthlyTotal / d.summary.income) * 100).toFixed(0);
      out.push(
        `Suas assinaturas somam ${share}% da renda; revise os servicos menos usados.`,
      );
    } else if (d.subscriptions.monthlyTotal > 0) {
      out.push(
        `Suas assinaturas somam ${brl(d.subscriptions.monthlyTotal)}/mes (${brl(d.subscriptions.annualTotal)}/ano); revise os servicos menos usados.`,
      );
    }
    const overBudget = d.categories.find((c) => c.vsHistAvgPct != null && c.vsHistAvgPct > 40);
    if (overBudget)
      out.push(
        `${overBudget.category} esta ${overBudget.vsHistAvgPct}% acima da media; definir uma meta mensal ajuda a controlar.`,
      );
    if (d.dataQuality.incomeReliable && d.summary.commitmentPct > 85)
      out.push(
        'Com mais de 85% da renda comprometida, priorize reduzir as 2 maiores categorias de consumo.',
      );
    return out.length ? out : ['Mantenha o padrao atual e revise as metas mensalmente.'];
  }
}

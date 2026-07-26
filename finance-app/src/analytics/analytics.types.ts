import { CatGroup } from './category-groups';

/** Transacao normalizada para os calculos. */
export interface Tx {
  id: string;
  accountId: string;
  date: Date;
  amount: number; // negativo = saida, positivo = entrada
  category: string;
  description: string;
  type: string | null;
  group: CatGroup;
  uncertain: boolean;
}

export interface CategoryStat {
  category: string;
  total: number; // valor absoluto gasto no periodo
  share: number; // % do consumo do periodo (0-100)
  count: number;
  growthPct: number | null; // variacao % vs mes anterior (null se n/a)
  vsHistAvgPct: number | null; // % acima/abaixo da media historica
}

export interface MoneyDestinationSlice {
  label: string;
  amount: number;
  share: number; // % da renda
}

export interface Subscription {
  description: string;
  monthlyAmount: number; // valor medio mensal
  monthsSeen: number;
  annualEstimate: number;
  lastDate: string;
}

export interface TrendPoint {
  window: '1m' | '3m' | '6m' | '12m';
  income: number;
  consumption: number;
  savings: number;
  savingsRatePct: number;
}

export interface HealthScore {
  score: number; // 0-100
  rating: 'Critico' | 'Atencao' | 'Bom' | 'Excelente';
  components: { label: string; points: number; max: number; note: string }[];
}

/** Numeros calculados deterministicamente — a fonte da verdade. */
export interface AnalyticsData {
  period: { month: string; from: string; to: string };
  dataQuality: {
    uncertainCategoryShare: number;
    salaryDetected: boolean;
    incomeReliable: boolean; // se nao, % sobre renda e classificacao nao sao confiaveis
    notes: string[];
  };

  summary: {
    income: number;
    consumption: number;
    savings: number;
    commitmentPct: number; // consumo / renda * 100
    classification: 'Critico' | 'Atencao' | 'Estavel' | 'Saudavel';
    changeVsPrevPct: number | null; // variacao do consumo vs mes anterior
  };

  categories: CategoryStat[];
  moneyDestination: { income: number; slices: MoneyDestinationSlice[]; leftover: number; leftoverShare: number };

  behavior: {
    weekendSharePct: number;
    nightSharePct: number;
    deliveryCountThisMonth: number;
    deliveryCountPrevMonth: number;
    avgTransactionsPerDay: number;
  };

  trends: TrendPoint[];

  subscriptions: { items: Subscription[]; monthlyTotal: number; annualTotal: number };

  waste: { label: string; total: number; count: number; note: string }[];

  health: HealthScore;

  movements: { transfers: number; investmentsNet: number; debt: number; fees: number };
}

/** Saida narrativa estilo consultor (gerada por regras; futura IA pluga aqui). */
export interface AnalyticsNarrative {
  avisos: string[]; // ressalvas de qualidade de dados (mostrar primeiro)
  resumoGeral: string[];
  analiseCategorias: string[];
  mapaDestino: string[];
  mudancasComportamento: string[];
  tendencia: string[];
  assinaturas: string[];
  desperdicios: string[];
  alertas: string[];
  oportunidades: string[];
  previsoes: string[];
  indiceSaude: string[];
  insightsAutomaticos: string[];
  comportamentosPositivos: string[];
  recomendacoes: string[];
}

export interface AnalyticsReport {
  data: AnalyticsData;
  narrative: AnalyticsNarrative;
}

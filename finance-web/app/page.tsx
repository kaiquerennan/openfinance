"use client";

// Início: responde, de cima para baixo, "quanto ainda posso gastar?", "tem
// algo que eu precise resolver?" e "o que vence agora?". O resto (resultado,
// contas, últimas transações) fica abaixo, como consulta.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  accountKindLabel,
  accountTitle,
  AnalyticsReport,
  Anomaly,
  api,
  brl,
  brl0,
  Budget,
  capFirst,
  currentMonth,
  daysUntil,
  DbAccount,
  DbTransaction,
  MONTH_LABELS,
  monthRange,
  todayParts,
} from "@/lib/api";
import { useDataVersion } from "@/lib/bus";
import { catMeta } from "@/lib/categories";
import { navItem, SECONDARY_NAV } from "@/lib/nav";
import { useMostVisited } from "@/lib/usage";
import PageHeader from "@/components/Header";
import LimitSheet, { LimitSuggestion } from "@/components/LimitSheet";
import TxList from "@/components/TxList";
import { BudgetPace } from "@/components/Charts";
import {
  Amount,
  Card,
  CardHeader,
  ErrorCard,
  ListRow,
  LoadingCard,
  Money,
  PageHero,
  TipCarousel,
} from "@/components/ui";
import { IconChevronRight, IconPencil } from "@/components/icons";

const SHORTCUT_DEFAULTS = SECONDARY_NAV.map((i) => i.href);

interface AttentionItem {
  key: string;
  tone: "neg" | "amber" | "info";
  icon: string;
  title: string;
  detail: React.ReactNode;
  href: string;
}

interface UpcomingItem {
  key: string;
  icon: string;
  title: string;
  /** Dias até vencer (0 = hoje). */
  days: number;
  amount: number;
  href: string;
}

function dueLabel(days: number) {
  if (days === 0) return "vence hoje";
  if (days === 1) return "vence amanhã";
  return `vence em ${days} dias`;
}

/** Arredonda para a dezena — sugestão de limite não precisa de centavos. */
const round10 = (n: number) => Math.round(n / 10) * 10;

export default function HomePage() {
  const router = useRouter();
  const version = useDataVersion();
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [accounts, setAccounts] = useState<DbAccount[] | null>(null);
  const [recent, setRecent] = useState<DbTransaction[] | null>(null);
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [allAttention, setAllAttention] = useState(false);

  const month = currentMonth();
  const { daysInMonth } = monthRange(month);
  const today = todayParts();
  const shortcuts = useMostVisited(SHORTCUT_DEFAULTS, 4);

  useEffect(() => {
    Promise.all([
      api.report(month).catch(() => null),
      api.accounts(),
      // "Últimas" de verdade: parcelas futuras do cartão já vêm lançadas com
      // data à frente e ocupavam o topo da lista.
      api.transactions({ take: 6, to: new Date().toISOString() }),
      api.budgets(),
    ])
      .then(([r, accs, latest, buds]) => {
        setReport(r);
        setAccounts(accs);
        setRecent(latest.transactions);
        setBudgets(buds);
        setError(null);
      })
      .catch((e) => setError(e.message));
    // Avisos são extras: se falharem, a home segue sem eles.
    api.anomalies().then(setAnomalies).catch(() => {});
    Promise.all([api.goalSuggestions(), api.goals()])
      .then(([s, goals]) =>
        setPendingDeposits(goals.some((g) => g.status === "ACTIVE") ? s.length : 0),
      )
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const budget = useMemo(() => {
    const g = budgets?.find((b) => b.category === "_global");
    return g ? Number(g.amount) : null;
  }, [budgets]);

  // Renda, consumo e ritmo diário vêm calculados do backend — a mesma conta
  // que alimenta a análise, para a tela não mostrar um total diferente dela.
  const cumulative = report?.data.dailyConsumption ?? [];
  const spent = report?.data.summary.consumption ?? 0;
  const income = report?.data.summary.income ?? 0;

  const remaining = budget !== null ? budget - spent : null;
  const daysLeft = daysInMonth - today.day + 1; // contando hoje
  const perDay = remaining !== null && remaining > 0 ? remaining / daysLeft : null;

  // Média mensal recente: ponto de partida para quem ainda não tem limite.
  const avg3 = useMemo(() => {
    const t3 = report?.data.trends.find((t) => t.window === "3m");
    return t3 && t3.consumption > 0 ? t3.consumption / 3 : null;
  }, [report]);

  const limitSuggestions: LimitSuggestion[] = avg3
    ? [
        { label: "Sua média recente", value: round10(avg3) },
        { label: "10% abaixo", value: round10(avg3 * 0.9) },
      ]
    : [];

  /* ——— O que vence: contas fixas do mês + faturas de cartão ——— */
  const upcoming = useMemo<UpcomingItem[]>(() => {
    const list: UpcomingItem[] = [];
    // lastDate é uma data de calendário ("YYYY-MM-DD"): a conta é feita no dia
    // do mês direto, sem passar por Date (que reinterpretaria em UTC).
    for (const s of report?.data.subscriptions.items ?? []) {
      const dueDay = Number(s.lastDate.split("-")[2]);
      if (dueDay < today.day || dueDay > daysInMonth) continue;
      list.push({
        key: `sub:${s.description}`,
        icon: "🔁",
        title: capFirst(s.description),
        days: dueDay - today.day,
        amount: s.monthlyAmount,
        href: "/recorrentes",
      });
    }
    for (const a of accounts ?? []) {
      if (a.type !== "CREDIT" || !a.balanceDueDate) continue;
      const days = daysUntil(a.balanceDueDate);
      const amount = Math.abs(Number(a.balance ?? 0));
      if (days < 0 || days > 31 || amount === 0) continue;
      list.push({
        key: `card:${a.id}`,
        icon: "💳",
        title: `Fatura ${accountTitle(a)}`,
        days,
        amount,
        href: "/cartoes",
      });
    }
    return list.sort((a, b) => a.days - b.days);
  }, [report, accounts, today.day, daysInMonth]);

  /* ——— O que pede atenção, do mais urgente ao menos ——— */
  const attention = useMemo<AttentionItem[]>(() => {
    const list: AttentionItem[] = [];
    const outlook = report?.data.outlook;
    if (outlook && outlook.negativeFromDay !== null)
      list.push({
        key: "negative",
        tone: "neg",
        icon: "📉",
        title: `Saldo pode ficar negativo no dia ${outlook.negativeFromDay}`,
        detail: "No ritmo atual de gastos — veja a projeção do mês",
        href: "/projecao",
      });

    // Fatura com vencimento já passado e saldo em aberto. O banco às vezes
    // demora a virar a data depois do pagamento, por isso o texto pede para
    // conferir em vez de afirmar o atraso; além de 45 dias é dado velho.
    for (const a of accounts ?? []) {
      if (a.type !== "CREDIT" || !a.balanceDueDate) continue;
      const days = daysUntil(a.balanceDueDate);
      const amount = Math.abs(Number(a.balance ?? 0));
      if (days >= 0 || days < -45 || amount === 0) continue;
      list.push({
        key: `overdue:${a.id}`,
        tone: "neg",
        icon: "💳",
        title: `Fatura ${accountTitle(a)} venceu há ${-days} ${days === -1 ? "dia" : "dias"}`,
        detail: (
          <>
            <Amount>{brl0(amount)}</Amount> em aberto — confira se já foi paga
          </>
        ),
        href: "/cartoes",
      });
    }

    const spentBy = new Map(
      (report?.data.categories ?? []).map((c) => [c.category.toLowerCase(), c.total]),
    );
    for (const b of budgets ?? []) {
      if (b.category === "_global") continue;
      const limit = Number(b.amount);
      const total = spentBy.get(b.category) ?? 0;
      if (limit > 0 && total > limit)
        list.push({
          key: `over:${b.category}`,
          tone: "neg",
          icon: catMeta(b.category).icon,
          title: `${catMeta(b.category).label} passou do limite`,
          detail: (
            <>
              <Amount>{brl0(total)}</Amount> de <Amount>{brl0(limit)}</Amount> planejados
            </>
          ),
          href: "/categorias",
        });
    }

    for (const a of anomalies)
      list.push({
        key: `anomaly:${a.transactionId}`,
        tone: "amber",
        icon: "⚠️",
        title: `Gasto fora do padrão: ${a.description}`,
        detail:
          a.reason === "merchant" ? (
            <>
              <Amount>{brl(a.amount)}</Amount> · {a.times}x o de sempre nesse lugar
            </>
          ) : (
            <>
              <Amount>{brl(a.amount)}</Amount> · suas compras raramente passam de{" "}
              <Amount>{brl0(a.typical)}</Amount>
            </>
          ),
        href: `/transacoes?q=${encodeURIComponent(a.description)}`,
      });

    for (const s of report?.data.subscriptions.items ?? [])
      if (s.increasePct != null)
        list.push({
          key: `increase:${s.description}`,
          tone: "amber",
          icon: "🔺",
          title: `${capFirst(s.description)} subiu ${Math.round(s.increasePct)}%`,
          detail: (
            <>
              Agora <Amount>{brl0(s.currentAmount)}</Amount> por mês
            </>
          ),
          href: "/recorrentes",
        });

    if (pendingDeposits > 0)
      list.push({
        key: "deposits",
        tone: "info",
        icon: "🎯",
        title:
          pendingDeposits === 1
            ? "1 aplicação pode contar para uma meta"
            : `${pendingDeposits} aplicações podem contar para uma meta`,
        detail: "Um toque em cada uma atualiza o progresso",
        href: "/metas",
      });
    return list;
  }, [report, budgets, accounts, anomalies, pendingDeposits]);

  const banks = useMemo(
    () =>
      (accounts ?? [])
        .filter((a) => a.type !== "CREDIT")
        .sort((a, b) => Number(b.balance ?? 0) - Number(a.balance ?? 0)),
    [accounts],
  );
  const total = banks.reduce((s, a) => s + Number(a.balance ?? 0), 0);
  const banksShown = banks.filter((a) => Number(a.balance ?? 0) !== 0).slice(0, 4);

  const loading = !accounts || !recent || !budgets;
  const attentionShown = allAttention ? attention : attention.slice(0, 3);
  const toneDot = { neg: "bg-neg", amber: "bg-amber", info: "bg-accent" } as const;

  return (
    <div>
      <PageHeader title={MONTH_LABELS[today.month - 1]} addTx>
        {budget === null ? (
          <PageHero
            label="Gastos no mês até agora"
            value={<Amount>{brl0(spent)}</Amount>}
            hint={
              avg3 ? (
                <>
                  Sua média recente é <Amount>{brl0(avg3)}</Amount> por mês
                </>
              ) : undefined
            }
          >
            <button
              onClick={() => setLimitOpen(true)}
              className="mt-4 rounded-full bg-accent text-white font-semibold px-5 py-2.5 text-sm"
            >
              Definir limite mensal
            </button>
          </PageHero>
        ) : (
          <PageHero
            label={
              (remaining ?? 0) >= 0 ? "Disponível até o fim do mês" : "Acima do limite do mês"
            }
            value={
              <span className={(remaining ?? 0) < 0 ? "text-neg" : ""}>
                <Amount>{brl0(Math.abs(remaining ?? 0))}</Amount>
              </span>
            }
            hint={
              <button
                onClick={() => setLimitOpen(true)}
                className="inline-flex items-center gap-1.5"
                aria-label="Editar limite mensal"
              >
                <Amount>{brl0(spent)}</Amount> gastos de <Amount>{brl0(budget)}</Amount>
                <span className="text-accent">
                  <IconPencil size={13} />
                </span>
              </button>
            }
          >
            {perDay !== null && (
              <p className="mt-3 text-[15px] text-ink leading-snug">
                Dá para gastar{" "}
                <b className="font-semibold">
                  <Amount>{brl0(perDay)}</Amount> por dia
                </b>{" "}
                <span className="text-ink-dim">
                  {daysLeft === 1 ? "— hoje é o último dia" : `nos ${daysLeft} dias que restam`}
                </span>
              </p>
            )}
            {cumulative.length > 0 && (
              <div className="mt-4">
                <BudgetPace cumulative={cumulative} daysInMonth={daysInMonth} budget={budget} />
              </div>
            )}
          </PageHero>
        )}
      </PageHeader>

      <div className="px-4 mt-5">
        {error && (
          <div className="mb-4">
            <ErrorCard message={error} />
          </div>
        )}

        {loading ? (
          !error && <LoadingCard text="Carregando suas finanças…" />
        ) : (
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-5 lg:items-start">
            {/* Coluna principal no desktop; no celular os blocos se intercalam pela ordem. */}
            <div className="contents lg:block lg:col-span-2 lg:space-y-5">
              {attention.length > 0 && (
                <Card className="order-1">
                  <CardHeader title="Pede atenção" />
                  <div className="divide-y divide-edge">
                    {attentionShown.map((a) => (
                      <button
                        key={a.key}
                        onClick={() => router.push(a.href)}
                        className="w-full flex items-center gap-3.5 py-3 text-left"
                      >
                        <span className="relative h-11 w-11 rounded-2xl bg-soft grid place-items-center text-lg shrink-0">
                          {a.icon}
                          <span
                            className={`absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card ${toneDot[a.tone]}`}
                          />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-semibold text-ink leading-snug">
                            {a.title}
                          </span>
                          <span className="block text-[13px] text-ink-dim mt-0.5">
                            {a.detail}
                          </span>
                        </span>
                        <span className="text-ink-faint shrink-0">
                          <IconChevronRight size={15} />
                        </span>
                      </button>
                    ))}
                  </div>
                  {attention.length > 3 && (
                    <button
                      onClick={() => setAllAttention((v) => !v)}
                      className="w-full text-sm font-semibold text-accent pt-3"
                    >
                      {allAttention ? "Mostrar menos" : `Ver mais ${attention.length - 3}`}
                    </button>
                  )}
                </Card>
              )}

              <Card className="order-3" onClick={() => router.push("/analises")}>
                <CardHeader
                  title="Resultado do mês"
                  onOpen={() => router.push("/analises")}
                  openLabel="Análises"
                />
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { label: "Entrou", value: income, cls: "text-pos" },
                    { label: "Saiu", value: spent, cls: "text-ink" },
                    {
                      label: "Resultado",
                      value: income - spent,
                      cls: income - spent < 0 ? "text-neg" : "text-pos",
                    },
                  ].map((s) => (
                    <div key={s.label}>
                      <div className="text-[13px] text-ink-dim">{s.label}</div>
                      <Money value={s.value} cents={false} className={`text-lg ${s.cls}`} />
                    </div>
                  ))}
                </div>
                {report && !report.data.dataQuality.incomeReliable && (
                  <p className="text-xs text-ink-faint mt-3">
                    Sua renda ainda não aparece com clareza nos dados — o resultado
                    considera só o que foi identificado como renda.
                  </p>
                )}
              </Card>

              <Card className="order-6">
                <CardHeader
                  title="Últimas transações"
                  onOpen={() => router.push("/transacoes")}
                />
                <div className="mt-2">
                  <TxList transactions={recent ?? []} />
                </div>
              </Card>
            </div>

            <div className="contents lg:block lg:space-y-5">
              {upcoming.length > 0 && (
                <Card className="order-2">
                  <CardHeader
                    title="A pagar"
                    right={
                      <span className="text-sm text-ink-dim ml-auto">
                        <Amount>{brl0(upcoming.reduce((s, u) => s + u.amount, 0))}</Amount>
                      </span>
                    }
                  />
                  <div className="divide-y divide-edge">
                    {upcoming.slice(0, 4).map((u) => (
                      <ListRow
                        key={u.key}
                        icon={u.icon}
                        title={u.title}
                        subtitle={
                          <span className={u.days <= 3 ? "text-neg font-semibold" : ""}>
                            {dueLabel(u.days)}
                          </span>
                        }
                        right={<Money value={u.amount} cents={false} className="text-[16px]" />}
                        onClick={() => router.push(u.href)}
                      />
                    ))}
                  </div>
                  {upcoming.length > 4 && (
                    <button
                      onClick={() => router.push("/recorrentes")}
                      className="w-full text-sm font-semibold text-accent pt-3"
                    >
                      Ver mais {upcoming.length - 4}
                    </button>
                  )}
                </Card>
              )}

              <nav aria-label="Atalhos" className="order-4 grid grid-cols-4 gap-2">
                {shortcuts.map((href) => {
                  const item = navItem(href);
                  if (!item) return null;
                  return (
                    <button
                      key={href}
                      onClick={() => router.push(href)}
                      className="card flex flex-col items-center gap-1.5 px-1 py-3.5 active:scale-95 transition"
                    >
                      <span className="text-accent">{item.icon(21)}</span>
                      <span className="text-[11.5px] font-semibold text-ink-dim leading-tight text-center">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </nav>

              <Card className="order-5">
                <CardHeader
                  title="Em conta"
                  onOpen={() => router.push("/contas")}
                  openLabel={banks.length > banksShown.length ? `Todas (${banks.length})` : "Contas"}
                />
                <Money value={total} className="text-2xl text-ink" />
                {banksShown.length > 0 && (
                  <div className="divide-y divide-edge mt-2">
                    {banksShown.map((a) => (
                      <ListRow
                        key={a.id}
                        icon={a.subtype === "MANUAL" ? "👛" : "🏦"}
                        title={accountTitle(a)}
                        subtitle={accountKindLabel(a)}
                        right={
                          <Money
                            value={Number(a.balance ?? 0)}
                            cents={false}
                            className="text-[16px]"
                          />
                        }
                      />
                    ))}
                  </div>
                )}
              </Card>

              <div className="order-7">
                <TipCarousel
                  tips={[
                    ...(report?.narrative.insightsAutomaticos ?? []),
                    ...(report?.narrative.recomendacoes ?? []),
                  ].filter(Boolean)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <LimitSheet
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        current={budget}
        suggestions={limitSuggestions}
      />
    </div>
  );
}

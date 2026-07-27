"use client";

// Visão geral: gasto vs limite do mês, receitas/despesas/resultado,
// contas a pagar, contas e últimas transações.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  accountKindLabel,
  accountTitle,
  AnalyticsReport,
  api,
  brl,
  brl0,
  Budget,
  currentMonth,
  DbAccount,
  DbTransaction,
  monthRange,
  signedAmount,
  sortAccounts,
} from "@/lib/api";
import { txKind } from "@/lib/categories";
import { useDataVersion } from "@/lib/bus";
import BlueHeader from "@/components/Header";
import LimitSheet from "@/components/LimitSheet";
import TxList from "@/components/TxList";
import { BudgetPace } from "@/components/Charts";
import {
  Amount,
  Card,
  CardHeader,
  ErrorCard,
  LoadingCard,
  Money,
  TipCarousel,
} from "@/components/ui";
import { IconArrows, IconChevronRight, IconFlow, IconPie } from "@/components/icons";

function subEmoji(desc: string) {
  const d = desc.toLowerCase();
  if (d.includes("ifood") || d.includes("food")) return "🍔";
  if (d.includes("netflix") || d.includes("stream") || d.includes("spotify")) return "📺";
  if (d.includes("gym") || d.includes("academia") || d.includes("smart")) return "🏋️";
  if (d.includes("internet") || d.includes("claro") || d.includes("vivo") || d.includes("tim"))
    return "📡";
  return "🧾";
}


export default function HomePage() {
  const router = useRouter();
  const version = useDataVersion();
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [accounts, setAccounts] = useState<DbAccount[] | null>(null);
  const [txs, setTxs] = useState<DbTransaction[] | null>(null);
  const [recent, setRecent] = useState<DbTransaction[] | null>(null);
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);

  const month = currentMonth();
  const { from, to, daysInMonth } = monthRange(month);

  useEffect(() => {
    Promise.all([
      api.report(month).catch(() => null),
      api.accounts(),
      api.transactions({ from, to, take: 1000 }),
      api.transactions({ take: 12 }),
      api.budgets(),
    ])
      .then(([r, accs, monthTxs, latest, buds]) => {
        setReport(r);
        setAccounts(accs);
        setTxs(monthTxs.transactions);
        setRecent(latest.transactions);
        setBudgets(buds);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const budget = useMemo(() => {
    const g = budgets?.find((b) => b.category === "_global");
    return g ? Number(g.amount) : null;
  }, [budgets]);

  // Gasto acumulado por dia (consumo) do mês corrente
  const { cumulative, spent, income } = useMemo(() => {
    const today = new Date().getDate();
    const perDay = new Array<number>(today + 1).fill(0);
    let inc = 0;
    for (const t of txs ?? []) {
      const amt = signedAmount(t);
      const kind = txKind(t.category, amt);
      const day = new Date(t.date).getUTCDate();
      if (kind === "consumption" && amt < 0 && day <= today) perDay[day] += -amt;
      if (kind === "income" && amt > 0) inc += amt;
    }
    const cum: number[] = [];
    let acc = 0;
    for (let d = 1; d <= today; d++) {
      acc += perDay[d];
      cum.push(acc);
    }
    return { cumulative: cum, spent: acc, income: inc };
  }, [txs]);

  const over = budget !== null ? spent - budget : null;

  // Contas a pagar: recorrências com próxima cobrança ainda neste mês
  const upcoming = useMemo(() => {
    if (!report) return [];
    const now = new Date();
    return report.data.subscriptions.items
      .map((s) => {
        const last = new Date(s.lastDate);
        const due = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate()));
        return { ...s, due };
      })
      .filter(
        (s) =>
          s.due.getUTCMonth() === now.getMonth() &&
          s.due.getUTCFullYear() === now.getFullYear() &&
          s.due.getUTCDate() >= now.getDate(),
      )
      .sort((a, b) => a.due.getTime() - b.due.getTime());
  }, [report]);

  const total = (accounts ?? [])
    .filter((a) => a.type === "BANK")
    .reduce((s, a) => s + Number(a.balance ?? 0), 0);

  const loading = !accounts || !txs || !recent || !budgets;

  return (
    <div>
      <BlueHeader>
        <div className="mt-5">
          {budget === null ? (
            <button onClick={() => setLimitOpen(true)} className="text-left">
              <div className="text-4xl font-semibold">
                <Amount>{brl0(spent)}</Amount>{" "}
                <span className="text-white/70 text-2xl font-normal">gastos no mês</span>
              </div>
              <div className="text-white/70 mt-1 text-[15px]">
                Toque para definir um limite mensal ✏️
              </div>
            </button>
          ) : (
            <>
              <div className="text-4xl font-semibold">
                <Amount>{brl0(Math.abs(over ?? 0))}</Amount>{" "}
                <span className="text-white/70 text-2xl font-normal">
                  {(over ?? 0) > 0 ? "acima do limite" : "disponíveis"}
                </span>
              </div>
              <button
                onClick={() => setLimitOpen(true)}
                className="text-white/70 mt-1 text-[15px]"
              >
                de <Amount>{brl0(budget)}</Amount> planejados para o mês ✏️
              </button>
            </>
          )}
        </div>

        {budget !== null && cumulative.length > 0 && (
          <div className="mt-4">
            <BudgetPace
              cumulative={cumulative}
              daysInMonth={daysInMonth}
              budget={budget}
            />
          </div>
        )}

      </BlueHeader>

      <div className="px-4 mt-5 space-y-4">
        {error && <ErrorCard message={error} />}

        <TipCarousel
          tips={[
            ...(budget !== null
              ? [
                  (over ?? 0) > 0
                    ? `Você ultrapassou R$ ${brl0(Math.abs(over ?? 0))} do limite mensal.`
                    : `Você ainda tem R$ ${brl0(Math.abs(over ?? 0))} do limite deste mês.`,
                ]
              : []),
            ...(report?.narrative.insightsAutomaticos ?? []),
            ...(report?.narrative.recomendacoes ?? []),
          ].filter(Boolean)}
        />

        {/* Atalhos rápidos */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {[
            { href: "/analises", label: "Fluxo de Caixa", icon: <IconFlow size={16} /> },
            { href: "/categorias", label: "Categorias", icon: <IconPie size={16} /> },
            { href: "/cartoes", label: "Faturas", icon: <IconArrows size={16} /> },
          ].map((s, i) => (
            <button
              key={s.href}
              onClick={() => router.push(s.href)}
              className={`shrink-0 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${
                i === 0 ? "bg-accent text-white" : "bg-soft text-ink-dim"
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        {/* Resultado parcial (Receitas / Despesas / Resultado) */}
        <Card className="cursor-pointer" onClick={() => router.push("/analises")}>
          <CardHeader title="Resultado parcial" onOpen={() => router.push("/analises")} />
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { label: "Receitas", value: income, bar: "bg-pos" },
              { label: "Despesas", value: spent, bar: "bg-neg" },
              { label: "Resultado", value: income - spent, bar: "bg-[#38bdf8]", signed: true },
            ].map((s) => (
              <div key={s.label} className="flex gap-2.5">
                <span className={`w-1 rounded-full ${s.bar}`} />
                <div>
                  <div className="text-sm text-ink-dim">{s.label}</div>
                  <div className="text-lg font-bold text-ink whitespace-nowrap">
                    {s.signed && s.value < 0 ? "-" : ""}
                    <Amount>{brl0(Math.abs(s.value))}</Amount>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {loading ? (
          <LoadingCard text="Carregando suas finanças…" />
        ) : (
          <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-5 lg:items-start">
            {/* Contas a pagar */}
            {upcoming.length > 0 && (
              <Card
                className="flex items-center gap-4 cursor-pointer lg:col-span-3"
                onClick={() => router.push("/transacoes?tab=recorrentes")}
              >
                <div className="flex -space-x-3 shrink-0">
                  {upcoming.slice(0, 2).map((s, i) => (
                    <span
                      key={i}
                      className="h-11 w-11 rounded-2xl bg-soft grid place-items-center text-lg ring-2 ring-card"
                    >
                      {subEmoji(s.description)}
                    </span>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[17px] font-bold text-ink">
                    {upcoming.length} conta{upcoming.length > 1 ? "s" : ""} a pagar
                  </div>
                  <div className="text-sm text-ink-dim flex items-center gap-2">
                    Total de <Amount>{brl0(upcoming.reduce((s, u) => s + u.monthlyAmount, 0))}</Amount>
                    <span className="text-ink-faint">|</span>
                    Até{" "}
                    {upcoming[upcoming.length - 1].due.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      timeZone: "UTC",
                    })}
                  </div>
                </div>
                <span className="h-10 w-10 rounded-full bg-soft grid place-items-center text-ink-dim shrink-0">
                  <IconChevronRight size={16} />
                </span>
              </Card>
            )}

            {/* Contas */}
            <Card className="lg:col-span-1">
              <CardHeader title="Contas" onOpen={() => router.push("/contas")} />
              <div className="divide-y divide-edge">
                {sortAccounts(accounts ?? []).map((a) => (
                  <div key={a.id} className="flex items-center gap-3.5 py-4">
                    <span className="h-11 w-11 rounded-2xl bg-soft grid place-items-center text-lg shrink-0">
                      {a.subtype === "MANUAL"
                        ? "👛"
                        : a.type === "CREDIT"
                          ? "💳"
                          : "🏦"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[16px] font-semibold text-ink truncate">
                        {accountTitle(a)}
                      </div>
                      <div className="text-sm text-ink-dim">{accountKindLabel(a)}</div>
                    </div>
                    <div className="text-right">
                      <Money value={Number(a.balance ?? 0)} cents={false} className="text-[17px]" />
                      <div className="text-sm text-ink-dim">Saldo atual</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2.5 pt-4 border-t border-edge">
                <span className="w-1 rounded-full bg-pos" />
                <div>
                  <div className="text-sm text-ink-dim">Total</div>
                  <div className="text-xl font-bold text-ink"><Amount>{brl(total)}</Amount></div>
                </div>
              </div>
            </Card>

            {/* Últimas transações */}
            <Card className="lg:col-span-2">
              <CardHeader
                title="Últimas transações"
                onOpen={() => router.push("/transacoes?tab=lancamentos")}
              />
              <div className="mt-3">
                <TxList transactions={(recent ?? []).slice(0, 8)} />
              </div>
            </Card>
          </div>
        )}
      </div>

      <LimitSheet
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        current={budget}
      />
    </div>
  );
}

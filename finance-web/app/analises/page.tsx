"use client";

// Análises: fluxo de caixa (líquido mensal), gastos (empilhado por categoria +
// ranking) e receitas, de 1 mês a 1 ano.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, brl0, MONTH_LABELS, MonthPoint } from "@/lib/api";
import { catColor, catMeta } from "@/lib/categories";
import { useDataVersion } from "@/lib/bus";
import PageHeader from "@/components/Header";
import { SegBars, ValueBars } from "@/components/Charts";
import {
  Amount,
  Card,
  CategoryIcon,
  ErrorCard,
  LoadingCard,
  Money,
  PageHero,
  PeriodTabs,
  SegTabs,
} from "@/components/ui";

const TABS = [
  { key: "fluxo", label: "Fluxo de caixa" },
  { key: "gastos", label: "Gastos" },
  { key: "receitas", label: "Receitas" },
];

function monthTick(m: string) {
  const [y, mm] = m.split("-").map(Number);
  const label = MONTH_LABELS[mm - 1].slice(0, 3);
  return y !== new Date().getFullYear() ? `${label}\n${String(y).slice(2)}` : label;
}

const monthName = (m: string) => MONTH_LABELS[Number(m.split("-")[1]) - 1].toLowerCase();

function AnalisesInner() {
  const router = useRouter();
  const version = useDataVersion();
  const params = useSearchParams();
  const initialTab = TABS.some((t) => t.key === params.get("tab"))
    ? (params.get("tab") as string)
    : "fluxo";
  const [tab, setTab] = useState(initialTab);
  const [period, setPeriod] = useState(12);
  const [serie, setSerie] = useState<MonthPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A série já vem agregada e classificada pelo backend — mesma regra do
  // relatório, então estes totais batem com os das outras telas.
  useEffect(() => {
    api
      .series(12)
      .then((s) => {
        setSerie(s);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
  }, [version]);

  const stats = useMemo(
    () =>
      (serie ?? []).slice(-period).map((p) => ({
        month: p.month,
        income: p.income,
        spent: p.consumption,
        cats: new Map(
          p.categories.map((c) => [c.category.toLowerCase(), c.total] as const),
        ),
      })),
    [serie, period],
  );

  const totalIncome = stats.reduce((s, m) => s + m.income, 0);
  const totalSpent = stats.reduce((s, m) => s + m.spent, 0);
  const net = totalIncome - totalSpent;
  const n = Math.max(stats.length, 1);

  // Ranking de categorias no período
  const ranking = useMemo(() => {
    const acc = new Map<string, number>();
    for (const m of stats)
      for (const [c, v] of m.cats) acc.set(c, (acc.get(c) ?? 0) + v);
    return [...acc.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [stats]);

  const topCats = ranking.slice(0, 5).map((r) => r.category);

  const stackedData = stats.map((m) => {
    const row: { name: string } & Record<string, number | string> = {
      name: monthTick(m.month),
    };
    let others = 0;
    for (const [c, v] of m.cats) {
      if (topCats.includes(c)) row[c] = v;
      else others += v;
    }
    if (others > 0) row.outros = others;
    return row;
  });

  const stackedSeries = [
    ...topCats.map((c) => ({
      key: c,
      label: catMeta(c).label,
      color: catColor(c),
    })),
    { key: "outros", label: "Outros", color: "#6b7280" },
  ];

  // Mês que mais pesou: dá sentido ao total, em vez de um "sem dados" fixo.
  const peak = (pick: (m: (typeof stats)[number]) => number) =>
    stats.reduce<(typeof stats)[number] | null>(
      (best, m) => (best === null || pick(m) > pick(best) ? m : best),
      null,
    );
  const worst = peak((m) => m.spent);
  const best = peak((m) => m.income);
  const several = stats.length > 1;

  const header =
    tab === "fluxo"
      ? {
          label: net >= 0 ? "Sobrou no período" : "Faltou no período",
          value: Math.abs(net),
          cls: net >= 0 ? "" : "text-neg",
          hint: several ? (
            <>
              Em média <Amount>{brl0(Math.abs(net) / n)}</Amount>{" "}
              {net >= 0 ? "de sobra" : "a mais do que entrou"} por mês
            </>
          ) : null,
        }
      : tab === "gastos"
        ? {
            label: "Gastos no período",
            value: totalSpent,
            cls: "",
            hint: several ? (
              <>
                Média de <Amount>{brl0(totalSpent / n)}</Amount> por mês
                {worst && worst.spent > 0 && (
                  <>
                    {" · maior em "}
                    {monthName(worst.month)} (<Amount>{brl0(worst.spent)}</Amount>)
                  </>
                )}
              </>
            ) : null,
          }
        : {
            label: "Receitas no período",
            value: totalIncome,
            cls: "",
            hint: several ? (
              <>
                Média de <Amount>{brl0(totalIncome / n)}</Amount> por mês
                {best && best.income > 0 && (
                  <>
                    {" · maior em "}
                    {monthName(best.month)} (<Amount>{brl0(best.income)}</Amount>)
                  </>
                )}
              </>
            ) : null,
          };

  const maxRank = ranking[0]?.total ?? 1;

  return (
    <div>
      <PageHeader title="Análises" back>
        <PageHero
          label={header.label}
          value={
            <span className={header.cls}>
              <Amount>{brl0(header.value)}</Amount>
            </span>
          }
          hint={header.hint}
        />
        <SegTabs className="mt-5 lg:max-w-lg" tabs={TABS} value={tab} onChange={setTab} />
        <div className="mt-2.5">
          <PeriodTabs value={period} onChange={setPeriod} />
        </div>
      </PageHeader>

      <div className="px-4 mt-5 space-y-5">
        {error && <ErrorCard message={error} />}
        {!serie ? (
          !error && <LoadingCard text="Montando suas análises…" />
        ) : (
          <div className="rise space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
            {tab === "fluxo" && (
              <>
                <Card className="lg:col-span-2 px-2!">
                  <ValueBars
                    symmetric
                    data={stats.map((m) => ({
                      name: monthTick(m.month),
                      value: m.income - m.spent,
                    }))}
                    height={250}
                  />
                </Card>
                <Card className="lg:col-span-1 divide-y divide-edge py-2!">
                  {[
                    { label: "Entrou", value: totalIncome, dot: "bg-pos", tab: "receitas" },
                    { label: "Saiu", value: totalSpent, dot: "bg-neg", tab: "gastos" },
                  ].map((r) => (
                    <button
                      key={r.label}
                      onClick={() => setTab(r.tab)}
                      className="w-full flex items-center justify-between py-3.5"
                    >
                      <span className="flex items-center gap-2.5 font-semibold text-ink">
                        <span className={`h-2.5 w-2.5 rounded-full ${r.dot}`} />
                        {r.label}
                      </span>
                      <Money value={r.value} cents={false} className="text-[17px]" />
                    </button>
                  ))}
                </Card>
              </>
            )}

            {tab === "gastos" && (
              <>
                <Card className="lg:col-span-2 px-2!">
                  <SegBars data={stackedData} series={stackedSeries} height={250} />
                </Card>
                <Card className="lg:col-span-1 py-3!">
                  {ranking.length === 0 && (
                    <p className="text-sm text-ink-faint text-center py-6">
                      Nenhum gasto no período.
                    </p>
                  )}
                  {ranking.map((r) => {
                    const meta = catMeta(r.category);
                    return (
                      <button
                        key={r.category}
                        onClick={() =>
                          router.push(`/transacoes?categoria=${encodeURIComponent(r.category)}`)
                        }
                        className="w-full flex items-center gap-3 py-2 text-left"
                      >
                        <CategoryIcon category={r.category} size="sm" />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center justify-between gap-3">
                            <span className="text-[15px] font-medium text-ink truncate">
                              {meta.label}
                            </span>
                            <Money value={r.total} cents={false} className="text-[15px]" />
                          </span>
                          <span className="block h-1.5 rounded-full bg-soft overflow-hidden mt-1.5">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${Math.max((r.total / maxRank) * 100, 2)}%`,
                                background: catColor(r.category),
                              }}
                            />
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </Card>
              </>
            )}

            {tab === "receitas" && (
              <Card className="lg:col-span-2 px-2!">
                <ValueBars
                  data={stats.map((m) => ({
                    name: monthTick(m.month),
                    value: m.income,
                  }))}
                  color="#2ec867"
                  height={250}
                />
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalisesPage() {
  return (
    <Suspense fallback={<div className="p-6"><LoadingCard /></div>}>
      <AnalisesInner />
    </Suspense>
  );
}

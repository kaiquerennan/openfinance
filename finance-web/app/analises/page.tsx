"use client";

// Análises: Fluxo de Caixa (líquido mensal), Gastos (empilhado por categoria
// + ranking) e Receitas, com período de 1M a 1 ano.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  api,
  MONTH_LABELS,
  MonthPoint,
} from "@/lib/api";
import { catColor, catMeta } from "@/lib/categories";
import { useDataVersion } from "@/lib/bus";
import BlueHeader from "@/components/Header";
import { SegBars, ValueBars } from "@/components/Charts";
import {
  ErrorCard,
  LoadingCard,
  Money,
  PeriodTabs,
  SegTabs,
} from "@/components/ui";

const TABS = [
  { key: "fluxo", label: "Fluxo de Caixa" },
  { key: "gastos", label: "Gastos" },
  { key: "receitas", label: "Receitas" },
];

function monthTick(m: string) {
  const [y, mm] = m.split("-").map(Number);
  const label = MONTH_LABELS[mm - 1].slice(0, 3);
  return y !== new Date().getFullYear() ? `${label}\n${String(y).slice(2)}` : label;
}

function AnalisesInner() {
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
      .then(setSerie)
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
    { key: "outros", label: "Outros", color: "#c3c8d1" },
  ];

  const header =
    tab === "fluxo"
      ? { label: "Resultado líquido", value: net }
      : tab === "gastos"
        ? { label: "Total de gastos", value: totalSpent }
        : { label: "Total de receitas", value: totalIncome };

  const maxRank = ranking[0]?.total ?? 1;

  return (
    <div className="pb-16">
      <BlueHeader title="Análises">
        <div className="mt-4">
          <div className="text-white/70 text-[15px]">{header.label}</div>
          <div className="text-5xl font-semibold mt-1">
            {`R$ ${header.value < 0 ? "-" : ""}${Math.abs(header.value).toLocaleString(
              "pt-BR",
              { maximumFractionDigits: 0 },
            )}`}
          </div>
          <div className="text-white/50 mt-2 text-[15px]">
            Sem dados do período anterior
          </div>
        </div>
        <SegTabs className="mt-5" tabs={TABS} value={tab} onChange={setTab} />
      </BlueHeader>

      <div className="px-4 mt-6 space-y-5">
        {error && <ErrorCard message={error} />}
        {!serie ? (
          <LoadingCard text="Montando suas análises…" />
        ) : (
          <div className="rise space-y-5 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
            {tab === "fluxo" && (
              <>
                <div className="lg:col-span-2">
                  <ValueBars
                    symmetric
                    data={stats.map((m) => ({
                      name: monthTick(m.month),
                      value: m.income - m.spent,
                    }))}
                    height={260}
                  />
                </div>
                <div className="space-y-2.5 lg:col-span-1">
                  <div className="flex items-center justify-between rounded-2xl bg-[#0f2a1a] px-4 py-3.5">
                    <span className="flex items-center gap-2.5 font-semibold text-ink">
                      <span className="h-2.5 w-2.5 rounded-full bg-pos" />
                      Receitas
                    </span>
                    <Money value={totalIncome} cents={false} className="text-[17px]" />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-[#3a1416] px-4 py-3.5">
                    <span className="flex items-center gap-2.5 font-semibold text-ink">
                      <span className="h-2.5 w-2.5 rounded-full bg-neg" />
                      Gastos
                    </span>
                    <Money value={totalSpent} cents={false} className="text-[17px]" />
                  </div>
                </div>
              </>
            )}

            {tab === "gastos" && (
              <>
                <div className="lg:col-span-2">
                  <SegBars data={stackedData} series={stackedSeries} height={260} />
                </div>
                <div className="space-y-2.5 lg:col-span-1">
                  {ranking.map((r) => {
                    const color = catColor(r.category);
                    const meta = catMeta(r.category);
                    const w = Math.max((r.total / maxRank) * 100, 22);
                    return (
                      <div key={r.category} className="relative h-12">
                        <span
                          className="absolute inset-y-0 left-0 rounded-2xl"
                          style={{
                            width: `${w}%`,
                            background: `color-mix(in srgb, ${color} 16%, white)`,
                          }}
                        />
                        <div className="relative h-full flex items-center justify-between px-4">
                          <span className="flex items-center gap-2.5 font-semibold text-ink">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: color }}
                            />
                            <span className="text-base">{meta.icon}</span>
                            {meta.label}
                          </span>
                          <Money value={r.total} cents={false} className="text-[16px]" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {tab === "receitas" && (
              <>
                <div className="lg:col-span-2">
                  <ValueBars
                    data={stats.map((m) => ({
                      name: monthTick(m.month),
                      value: m.income,
                    }))}
                    color="#2ec867"
                    height={260}
                  />
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[#0f2a1a] px-4 py-3.5 lg:col-span-1 lg:self-start">
                  <span className="flex items-center gap-2.5 font-semibold text-ink">
                    <span className="h-2.5 w-2.5 rounded-full bg-pos" />
                    Receitas
                  </span>
                  <Money value={totalIncome} cents={false} className="text-[17px]" />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Seletor de período flutuante */}
      <div className="fixed bottom-24 inset-x-0 z-30 pointer-events-none lg:pl-64">
        <div className="mx-auto w-full max-w-md flex justify-center pb-2">
          <div className="pointer-events-auto">
            <PeriodTabs value={period} onChange={setPeriod} />
          </div>
        </div>
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

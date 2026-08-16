"use client";

// Categorias: gasto do mês por categoria com limites editáveis.

import { useEffect, useMemo, useState } from "react";
import {
  AnalyticsReport,
  api,
  brl0,
  Budget,
  CategoryRule,
  currentMonth,
  monthLabel,
} from "@/lib/api";
import { catColor, catMeta } from "@/lib/categories";
import { bumpData, useDataVersion } from "@/lib/bus";
import BlueHeader from "@/components/Header";
import LimitSheet from "@/components/LimitSheet";
import LifestyleCard from "@/components/LifestyleCard";
import { Amount, Card, CardHeader, ErrorCard, LoadingCard, Money, MonthNav } from "@/components/ui";
import { IconTrash } from "@/components/icons";

export default function CategoriasPage() {
  const version = useDataVersion();
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitCat, setLimitCat] = useState<string | null>(null);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [rules, setRules] = useState<CategoryRule[]>([]);

  useEffect(() => {
    api
      .months()
      .then((ms) => setMonths(ms.includes(currentMonth()) ? ms : [...ms, currentMonth()]))
      .catch((e) => setError(e.message));
    api.budgets().then(setBudgets).catch((e) => setError(e.message));
    api.categoryRules().then(setRules).catch(() => {});
  }, [version]);

  useEffect(() => {
    setReport(null);
    api.report(month).then(setReport).catch((e) => setError(e.message));
  }, [month, version]);

  // Os totais por categoria vêm do relatório, não das transações cruas: assim
  // o abatimento de apostas e a exclusão de taxas/dívidas já vêm aplicados e
  // o número aqui bate com o da análise e o da home.
  const byCategory = useMemo(() => {
    const map = new Map<string, number>(
      (report?.data.categories ?? []).map((c) => [c.category.toLowerCase(), c.total]),
    );
    // categorias com limite definido aparecem mesmo sem gasto no mês
    for (const b of budgets ?? [])
      if (b.category !== "_global" && !map.has(b.category)) map.set(b.category, 0);
    return [...map.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [report, budgets]);

  const catBudget = (cat: string) => {
    const b = budgets?.find((x) => x.category === cat);
    return b ? Number(b.amount) : null;
  };
  const total = byCategory.reduce((s, c) => s + c.total, 0);

  return (
    <div>
      <BlueHeader title="Categorias">
        <div className="mt-4">
          <div className="text-white/70 text-[15px]">Total gasto</div>
          <div className="text-5xl font-semibold mt-1"><Amount>{brl0(total)}</Amount></div>
        </div>
        <div className="mt-5">
          <MonthNav months={months} value={month} onChange={setMonth} label={monthLabel} />
        </div>
      </BlueHeader>

      <div className="px-4 mt-5">
        {error && <ErrorCard message={error} />}
        <div className="mb-4">
          <LifestyleCard
            lifestyle={report?.data.lifestyle}
            habits={report?.data.habits}
          />
        </div>
        {!report || !budgets ? (
          <LoadingCard />
        ) : (
          <div className="rise">
            <div className="flex text-sm text-ink-faint px-2 mb-3">
              <span className="flex-1" />
              <span className="w-24 text-right">Gasto</span>
              <span className="w-28 text-right">Limite</span>
            </div>
            <div className="space-y-5 px-2 lg:columns-2 lg:gap-x-10 lg:space-y-0">
              {byCategory.map((c) => {
                const meta = catMeta(c.category);
                const color = catColor(c.category);
                const limit = catBudget(c.category);
                const ratio = limit ? Math.min(c.total / limit, 1) : 0;
                return (
                  <button
                    key={c.category}
                    onClick={() => setLimitCat(c.category)}
                    className="w-full flex items-center gap-2 lg:break-inside-avoid lg:mb-5"
                  >
                    <span
                      className="w-0 h-0 border-y-[7px] border-y-transparent border-l-[11px] shrink-0"
                      style={{ borderLeftColor: color }}
                    />
                    <span className="text-lg -mt-0.5">{meta.icon}</span>
                    <span className="flex-1 text-left text-[16px] font-medium text-ink truncate">
                      {meta.label}
                    </span>
                    <span className="w-24 text-right">
                      <Money value={c.total} cents={false} className="text-[16px]" />
                    </span>
                    <span className="w-28 flex items-center justify-end gap-2">
                      <span className="relative h-2.5 w-16 rounded-full bg-soft overflow-hidden">
                        {limit !== null && (
                          <span
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{
                              width: `${ratio * 100}%`,
                              background: c.total > limit ? "#ef4444" : color,
                            }}
                          />
                        )}
                      </span>
                      <span className="text-sm text-ink-dim min-w-8 text-right">
                        {limit !== null ? <Amount>{brl0(limit)}</Amount> : "—"}
                      </span>
                    </span>
                  </button>
                );
              })}
              {byCategory.length === 0 && (
                <p className="text-sm text-ink-faint text-center py-8">
                  Nenhum gasto neste mês.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {rules.length > 0 && (
        <div className="px-4 mt-6">
          <Card className="divide-y divide-edge">
            <CardHeader title="Regras de categoria" />
            <p className="text-xs text-ink-dim pb-3">
              Toda transação cuja descrição contém o texto abaixo entra na categoria
              escolhida — inclusive as que ainda vão chegar.
            </p>
            {rules.map((r) => {
              const meta = catMeta(r.category);
              return (
                <div key={r.id} className="flex items-center gap-3 py-3">
                  <span className="text-lg">{meta.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-medium text-ink truncate">
                      {r.pattern}
                    </span>
                    <span className="block text-xs text-ink-dim">{meta.label}</span>
                  </span>
                  <button
                    aria-label={`Remover regra ${r.pattern}`}
                    onClick={async () => {
                      await api.deleteCategoryRule(r.id);
                      setRules((list) => list.filter((x) => x.id !== r.id));
                      bumpData();
                    }}
                    className="h-9 w-9 rounded-full bg-soft grid place-items-center text-ink-dim shrink-0"
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      <LimitSheet
        open={limitCat !== null}
        onClose={() => setLimitCat(null)}
        category={limitCat ?? "_global"}
        current={limitCat ? catBudget(limitCat) : null}
      />
    </div>
  );
}

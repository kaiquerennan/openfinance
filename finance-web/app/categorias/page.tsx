"use client";

// Categorias: gasto do mês por categoria com limites editáveis.

import { useEffect, useMemo, useState } from "react";
import {
  api,
  brl0,
  Budget,
  currentMonth,
  DbTransaction,
  monthLabel,
  monthRange,
  signedAmount,
} from "@/lib/api";
import { catColor, catMeta, txGroup } from "@/lib/categories";
import { useDataVersion } from "@/lib/bus";
import BlueHeader from "@/components/Header";
import LimitSheet from "@/components/LimitSheet";
import { Amount, ErrorCard, LoadingCard, Money, MonthNav } from "@/components/ui";

export default function CategoriasPage() {
  const version = useDataVersion();
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [monthData, setMonthData] = useState<{
    month: string;
    txs: DbTransaction[];
  } | null>(null);
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitCat, setLimitCat] = useState<string | null>(null);

  useEffect(() => {
    api
      .months()
      .then((ms) => setMonths(ms.includes(currentMonth()) ? ms : [...ms, currentMonth()]))
      .catch((e) => setError(e.message));
    api.budgets().then(setBudgets).catch((e) => setError(e.message));
  }, [version]);

  useEffect(() => {
    const { from, to } = monthRange(month);
    api
      .transactions({ from, to, take: 1000 })
      .then((p) => setMonthData({ month, txs: p.transactions }))
      .catch((e) => setError(e.message));
  }, [month, version]);

  const txs = monthData?.month === month ? monthData.txs : null;

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txs ?? []) {
      const amt = signedAmount(t);
      if (txGroup(t.category, amt) !== "consumption" || amt >= 0) continue;
      const key = (t.category ?? "sem categoria").toLowerCase();
      map.set(key, (map.get(key) ?? 0) + -amt);
    }
    // categorias com limite definido aparecem mesmo sem gasto no mês
    for (const b of budgets ?? [])
      if (b.category !== "_global" && !map.has(b.category)) map.set(b.category, 0);
    return [...map.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [txs, budgets]);

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
        {!txs || !budgets ? (
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

      <LimitSheet
        open={limitCat !== null}
        onClose={() => setLimitCat(null)}
        category={limitCat ?? "_global"}
        current={limitCat ? catBudget(limitCat) : null}
      />
    </div>
  );
}

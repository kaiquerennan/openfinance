"use client";

// Categorias: para onde foi o dinheiro do mês e como cada categoria está em
// relação ao limite. Tocar numa abre as transações dela.

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
import CategoryDetailSheet from "@/components/CategoryDetailSheet";
import PageHeader from "@/components/Header";
import LimitSheet from "@/components/LimitSheet";
import LifestyleCard from "@/components/LifestyleCard";
import {
  Amount,
  Card,
  CategoryIcon,
  ErrorCard,
  LoadingCard,
  Money,
  MonthNav,
  PageHero,
  ProgressBar,
} from "@/components/ui";
import { IconChevronRight, IconTrash } from "@/components/icons";

export default function CategoriasPage() {
  const version = useDataVersion();
  const nowMonth = currentMonth();
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState(nowMonth);
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ key: string; report: AnalyticsReport } | null>(null);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [limitCat, setLimitCat] = useState<string | null>(null);

  useEffect(() => {
    api
      .months()
      .then((ms) => setMonths(ms.includes(nowMonth) ? ms : [...ms, nowMonth].sort()))
      .catch((e) => setError(e.message));
    api.budgets().then(setBudgets).catch((e) => setError(e.message));
    api.categoryRules().then(setRules).catch(() => {});
  }, [version, nowMonth]);

  const key = `${month}|${version}`;
  useEffect(() => {
    let stale = false;
    api
      .report(month)
      .then((report) => {
        if (stale) return;
        setLoaded({ key, report });
        setError(null);
      })
      .catch((e) => !stale && setError(e.message));
    return () => {
      stale = true;
    };
  }, [month, key]);

  const report = loaded?.key === key ? loaded.report : null;

  // Os totais por categoria vêm do relatório, não das transações cruas: assim
  // o abatimento de apostas e a exclusão de taxas/dívidas já vêm aplicados e
  // o número aqui bate com o da análise e o da home.
  const stats = useMemo(
    () => new Map((report?.data.categories ?? []).map((c) => [c.category.toLowerCase(), c])),
    [report],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, number>([...stats].map(([k, c]) => [k, c.total]));
    // categorias com limite definido aparecem mesmo sem gasto no mês
    for (const b of budgets ?? [])
      if (b.category !== "_global" && !map.has(b.category)) map.set(b.category, 0);
    return [...map.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [stats, budgets]);

  const catBudget = (cat: string) => {
    const b = budgets?.find((x) => x.category === cat);
    return b ? Number(b.amount) : null;
  };
  const total = byCategory.reduce((s, c) => s + c.total, 0);
  const globalBudget = catBudget("_global");
  const detailTotal = byCategory.find((c) => c.category === detail)?.total ?? 0;

  return (
    <div>
      <PageHeader title="Categorias">
        <PageHero
          label={month === nowMonth ? "Gasto no mês até agora" : "Gasto no mês"}
          value={<Amount>{brl0(total)}</Amount>}
          hint={
            globalBudget !== null && month === nowMonth ? (
              <button onClick={() => setLimitCat("_global")} className="text-left">
                {Math.round((total / globalBudget) * 100)}% do limite de{" "}
                <Amount>{brl0(globalBudget)}</Amount>
              </button>
            ) : undefined
          }
        >
          {globalBudget !== null && month === nowMonth && (
            <ProgressBar ratio={total / globalBudget} className="mt-3" />
          )}
        </PageHero>
        <div className="mt-4">
          <MonthNav months={months} value={month} onChange={setMonth} label={monthLabel} />
        </div>
      </PageHeader>

      <div className="px-4 mt-4 space-y-4">
        {error && <ErrorCard message={error} />}
        {!report || !budgets ? (
          !error && <LoadingCard />
        ) : (
          <div className="rise space-y-4 lg:space-y-0 lg:grid lg:grid-cols-5 lg:gap-5 lg:items-start">
            <Card className="lg:col-span-3 py-2!">
              {byCategory.length === 0 ? (
                <p className="text-sm text-ink-faint text-center py-8">
                  Nenhum gasto neste mês.
                </p>
              ) : (
                <div className="divide-y divide-edge">
                  {byCategory.map((c) => {
                    const meta = catMeta(c.category);
                    const limit = catBudget(c.category);
                    const stat = stats.get(c.category);
                    const growth = stat?.growthPct ?? null;
                    const share = total > 0 ? Math.round((c.total / total) * 100) : 0;
                    return (
                      <button
                        key={c.category}
                        onClick={() => setDetail(c.category)}
                        className="w-full py-3.5 text-left"
                      >
                        <span className="flex items-center gap-3.5">
                          <CategoryIcon category={c.category} />
                          <span className="flex-1 min-w-0">
                            <span className="block text-[15px] font-semibold text-ink truncate">
                              {meta.label}
                            </span>
                            <span className="block text-[13px] text-ink-dim truncate">
                              {limit !== null ? (
                                c.total > limit ? (
                                  <span className="text-neg font-semibold">
                                    <Amount>{brl0(c.total - limit)}</Amount> acima do limite
                                  </span>
                                ) : (
                                  <>
                                    de <Amount>{brl0(limit)}</Amount> · restam{" "}
                                    <Amount>{brl0(limit - c.total)}</Amount>
                                  </>
                                )
                              ) : (
                                <>
                                  {share}% do mês
                                  {growth !== null && Math.abs(growth) >= 10 && (
                                    <span className={growth > 0 ? "text-neg" : "text-pos"}>
                                      {" · "}
                                      {growth > 0 ? "▲" : "▼"} {Math.abs(Math.round(growth))}%
                                    </span>
                                  )}
                                </>
                              )}
                            </span>
                          </span>
                          <Money value={c.total} cents={false} className="text-[16px]" />
                          <span className="text-ink-faint">
                            <IconChevronRight size={14} />
                          </span>
                        </span>
                        {limit !== null && (
                          <ProgressBar
                            ratio={limit > 0 ? c.total / limit : 0}
                            color={catColor(c.category)}
                            size="sm"
                            className="mt-2.5 ml-[3.625rem]"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            <div className="space-y-4 lg:col-span-2">
              <LifestyleCard lifestyle={report.data.lifestyle} habits={report.data.habits} />

              {rules.length > 0 && (
                <Card>
                  <button
                    onClick={() => setRulesOpen((v) => !v)}
                    aria-expanded={rulesOpen}
                    className="w-full flex items-center justify-between gap-3 text-left"
                  >
                    <span>
                      <span className="block text-[17px] font-bold text-ink">
                        Regras de categoria
                      </span>
                      <span className="block text-[13px] text-ink-dim">
                        {rules.length} {rules.length === 1 ? "regra ativa" : "regras ativas"}
                      </span>
                    </span>
                    <span
                      className={`text-ink-faint transition-transform ${rulesOpen ? "rotate-90" : ""}`}
                    >
                      <IconChevronRight size={15} />
                    </span>
                  </button>
                  {rulesOpen && (
                    <div className="mt-3">
                      <p className="text-xs text-ink-dim pb-2">
                        Toda transação cuja descrição contém o texto abaixo entra na
                        categoria escolhida — inclusive as que ainda vão chegar.
                      </p>
                      <div className="divide-y divide-edge">
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
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      <CategoryDetailSheet
        category={detail}
        month={month}
        total={detailTotal}
        limit={detail ? catBudget(detail) : null}
        stat={detail ? stats.get(detail) : undefined}
        onClose={() => setDetail(null)}
        onEditLimit={() => setLimitCat(detail)}
      />

      <LimitSheet
        open={limitCat !== null}
        onClose={() => setLimitCat(null)}
        category={limitCat ?? "_global"}
        current={limitCat ? catBudget(limitCat) : null}
      />
    </div>
  );
}

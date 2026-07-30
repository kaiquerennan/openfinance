"use client";

// Transações: Visão geral (gasto x limite por categoria), Lançamentos
// (busca + lista) e Recorrentes (contas fixas: recorrências + parcelamentos).

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addMonths,
  AnalyticsReport,
  api,
  brl0,
  Budget,
  currentMonth,
  DbAccount,
  DbTransaction,
  monthLabel,
  MONTH_LABELS,
  monthRange,
  signedAmount,
} from "@/lib/api";
import { catColor, catMeta, txGroup } from "@/lib/categories";
import { bumpData, useDataVersion } from "@/lib/bus";
import BlueHeader from "@/components/Header";
import LimitSheet from "@/components/LimitSheet";
import Sheet from "@/components/Sheet";
import TxList from "@/components/TxList";
import { SegBars } from "@/components/Charts";
import {
  Amount,
  Chip,
  ErrorCard,
  Field,
  inputCls,
  LoadingCard,
  Money,
  MonthNav,
  PrimaryButton,
  SegTabs,
} from "@/components/ui";
import { IconSearch, IconSliders, IconTrash } from "@/components/icons";

const TABS = [
  { key: "visao", label: "Visão geral" },
  { key: "lancamentos", label: "Lançamentos" },
  { key: "recorrentes", label: "Recorrentes" },
];

interface Installment {
  key: string;
  description: string;
  amount: number;
  current: number; // parcela vista mais recentemente
  total: number;
  lastMonth: string; // YYYY-MM em que a parcela `current` ocorreu
  category: string | null;
}

/** Detecta parcelamentos "3/10" na descrição, agrupando pela descrição-base. */
function detectInstallments(txs: DbTransaction[]): Installment[] {
  const re = /(?:^|[\s(])(\d{1,2})\s*\/\s*(\d{1,2})(?:[\s).]|$)/;
  const map = new Map<string, Installment>();
  for (const t of txs) {
    const desc = t.description ?? t.descriptionRaw ?? "";
    const m = desc.match(re);
    if (!m) continue;
    const cur = Number(m[1]);
    const tot = Number(m[2]);
    if (!tot || cur > tot || tot < 2 || tot > 48) continue;
    const base = desc.replace(re, " ").replace(/\s+/g, " ").trim();
    const key = `${base}|${tot}`;
    const month = t.date.slice(0, 7);
    const prev = map.get(key);
    if (!prev || month > prev.lastMonth || (month === prev.lastMonth && cur > prev.current)) {
      map.set(key, {
        key,
        description: base || desc,
        amount: Math.abs(Number(t.amount)),
        current: cur,
        total: tot,
        lastMonth: month,
        category: t.category,
      });
    }
  }
  return [...map.values()];
}

/** Diferença em meses entre YYYY-MM (b - a). */
function monthDiff(a: string, b: string) {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

function TransacoesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const version = useDataVersion();
  const tab = TABS.some((t) => t.key === params.get("tab"))
    ? (params.get("tab") as string)
    : "visao";

  const nowMonth = currentMonth();
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState(nowMonth);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [monthData, setMonthData] = useState<{
    month: string;
    txs: DbTransaction[];
  } | null>(null);
  const [histTxs, setHistTxs] = useState<DbTransaction[] | null>(null);
  const [allTxs, setAllTxs] = useState<DbTransaction[] | null>(null);
  const [accounts, setAccounts] = useState<DbAccount[]>([]);
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState<number | null>(null);

  const [showAll, setShowAll] = useState(false);
  const [limitCat, setLimitCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [fCategory, setFCategory] = useState("");
  const [fAccount, setFAccount] = useState("");
  const [subTab, setSubTab] = useState<"recorrentes" | "parcelamentos">("recorrentes");
  const [selected, setSelected] = useState<DbTransaction | null>(null);

  // Carga geral (independente do mês selecionado)
  useEffect(() => {
    (async () => {
      try {
        const ms = await api.months();
        setMonths(ms.includes(nowMonth) ? ms : [...ms, nowMonth]);
        const last6 = ms.slice(-6);
        const [rep, accs, buds, all, ...hist] = await Promise.all([
          api.report().catch(() => null),
          api.accounts(),
          api.budgets(),
          api.transactions({ take: 500 }),
          ...last6.map((m) => {
            const { from, to } = monthRange(m);
            return api.transactions({ from, to, take: 1000 });
          }),
        ]);
        setReport(rep);
        setAccounts(accs);
        setBudgets(buds);
        setAllTxs(all.transactions);
        setHistTxs(hist.flatMap((h) => h.transactions));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // Transações do mês selecionado (aba visão geral)
  useEffect(() => {
    const { from, to } = monthRange(month);
    api
      .transactions({ from, to, take: 1000 })
      .then((p) => {
        setMonthData({ month, txs: p.transactions });
        // Os totais por categoria abaixo são somados sobre esta página. Se ela
        // veio cortada, o total mostrado é menor que o real — melhor avisar do
        // que exibir um número errado como se fosse completo.
        setTruncated(p.hasMore ? p.total : null);
      })
      .catch((e) => setError(e.message));
  }, [month, version]);

  const monthTxs = monthData?.month === month ? monthData.txs : null;

  /* ——— Visão geral ——— */

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of monthTxs ?? []) {
      const amt = signedAmount(t);
      if (txGroup(t.category, amt) !== "consumption" || amt >= 0) continue;
      const key = (t.category ?? "sem categoria").toLowerCase();
      map.set(key, (map.get(key) ?? 0) + -amt);
    }
    return [...map.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [monthTxs]);

  const totalSpent = byCategory.reduce((s, c) => s + c.total, 0);
  const globalBudget = useMemo(() => {
    const g = budgets?.find((b) => b.category === "_global");
    return g ? Number(g.amount) : null;
  }, [budgets]);
  const catBudget = (cat: string) => {
    const b = budgets?.find((x) => x.category === cat);
    return b ? Number(b.amount) : null;
  };

  /* ——— Lançamentos ——— */

  const filtered = useMemo(() => {
    let list = allTxs ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) =>
        (t.description ?? t.descriptionRaw ?? "").toLowerCase().includes(q),
      );
    }
    if (fCategory) list = list.filter((t) => (t.category ?? "").toLowerCase() === fCategory);
    if (fAccount) list = list.filter((t) => t.accountId === fAccount);
    return list;
  }, [allTxs, search, fCategory, fAccount]);

  /* ——— Recorrentes ——— */

  const recMonths = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addMonths(nowMonth, i)),
    [nowMonth],
  );
  const [recMonth, setRecMonth] = useState(nowMonth);

  const installments = useMemo(
    () => detectInstallments(histTxs ?? []),
    [histTxs],
  );

  /** Parcelas ativas num mês (projeção pelas parcelas restantes). */
  const installmentsIn = (m: string) =>
    installments
      .map((i) => ({ ...i, n: i.current + monthDiff(i.lastMonth, m) }))
      .filter((i) => i.n >= 1 && i.n <= i.total && monthDiff(i.lastMonth, m) >= 0);

  const recurringMonthly = report?.data.subscriptions.monthlyTotal ?? 0;
  const recurringItems = report?.data.subscriptions.items ?? [];

  const recChart = recMonths.map((m) => {
    const [, mm] = m.split("-");
    const parc = installmentsIn(m).reduce((s, i) => s + i.amount, 0);
    return {
      name: MONTH_LABELS[Number(mm) - 1].slice(0, 3),
      parcelados: parc,
      recorrentes: recurringMonthly,
    };
  });

  const selParc = installmentsIn(recMonth);
  const fixedTotal =
    selParc.reduce((s, i) => s + i.amount, 0) + recurringMonthly;
  const prevFixed =
    installmentsIn(addMonths(recMonth, -1)).reduce((s, i) => s + i.amount, 0) +
    recurringMonthly;

  /* ——— render ——— */

  const setTab = (k: string) => router.replace(`/transacoes?tab=${k}`, { scroll: false });

  return (
    <div>
      <BlueHeader title="Transações">
        {tab === "visao" && (
          <div className="mt-4">
            <div className="text-white/70 text-[15px]">Total gasto</div>
            <div className="text-5xl font-semibold mt-1"><Amount>{brl0(totalSpent)}</Amount></div>
            <button
              onClick={() => setLimitCat("_global")}
              className="text-white/70 mt-2 text-[15px]"
            >
              {globalBudget !== null ? (
                <>do limite de <Amount>{brl0(globalBudget)}</Amount> ✏️</>
              ) : (
                "definir limite mensal ✏️"
              )}
            </button>
          </div>
        )}
        {tab === "recorrentes" && (
          <div className="mt-4">
            <div className="text-white/70 text-[15px]">Contas fixas</div>
            <div className="text-5xl font-semibold mt-1"><Amount>{brl0(fixedTotal)}</Amount></div>
            <div className="text-white/50 mt-2 text-[15px]">
              {prevFixed > 0 ? (
                <><Amount>{brl0(prevFixed)}</Amount> no mês anterior</>
              ) : (
                "Sem dados do mês anterior"
              )}
            </div>
          </div>
        )}

        <SegTabs className="mt-5" tabs={TABS} value={tab} onChange={setTab} />

        {tab === "visao" && (
          <div className="mt-4">
            <MonthNav months={months} value={month} onChange={setMonth} label={monthLabel} />
          </div>
        )}
        {tab === "recorrentes" && (
          <div className="mt-4">
            <MonthNav
              months={recMonths}
              value={recMonth}
              onChange={setRecMonth}
              label={monthLabel}
            />
          </div>
        )}
      </BlueHeader>

      <div className="px-4 mt-5 space-y-4">
        {error && <ErrorCard message={error} />}
        {truncated !== null && (
          <ErrorCard
            message={`Este mês tem ${truncated} lançamentos e a tela carrega no máximo 1000 — os totais por categoria abaixo estão incompletos.`}
          />
        )}

        {/* ——— Visão geral ——— */}
        {tab === "visao" &&
          (!monthTxs || !budgets ? (
            <LoadingCard />
          ) : (
            <div className="rise">
              <div className="flex text-sm text-ink-faint px-2 mb-3">
                <span className="flex-1" />
                <span className="w-24 text-right">Gasto</span>
                <span className="w-28 text-right">Limite</span>
              </div>
              <div className="space-y-5 px-2 lg:columns-2 lg:gap-x-10 lg:space-y-0">
                {(showAll ? byCategory : byCategory.slice(0, 4)).map((c) => {
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
                          {limit !== null ? <Amount>{brl0(limit).replace(/ /g, " ")}</Amount> : "—"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {byCategory.length > 4 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="w-full text-center text-[15px] text-ink-faint font-medium py-6"
                >
                  {showAll ? "Mostrar menos" : `Mostrar todas (${byCategory.length})`}
                </button>
              )}
              {byCategory.length === 0 && (
                <p className="text-sm text-ink-faint text-center py-8">
                  Nenhum gasto neste mês.
                </p>
              )}
            </div>
          ))}

        {/* ——— Lançamentos ——— */}
        {tab === "lancamentos" && (
          <div className="rise space-y-4">
            <div className="flex gap-2.5">
              <div className="flex-1 flex items-center gap-2.5 bg-soft rounded-2xl px-4">
                <span className="text-ink-faint">
                  <IconSearch size={17} />
                </span>
                <input
                  className="w-full bg-transparent py-3.5 text-sm font-medium outline-none placeholder:text-ink-faint"
                  placeholder="Buscar transações..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                aria-label="Filtros"
                onClick={() => setFilterOpen(true)}
                className={`h-12 w-12 rounded-2xl grid place-items-center shrink-0 ${
                  fCategory || fAccount ? "bg-accent text-white" : "bg-soft text-ink-dim"
                }`}
              >
                <IconSliders size={18} />
              </button>
            </div>
            {!allTxs ? (
              <LoadingCard />
            ) : (
              <div className="px-1">
                <TxList transactions={filtered} onSelect={setSelected} />
              </div>
            )}
          </div>
        )}

        {/* ——— Recorrentes ——— */}
        {tab === "recorrentes" &&
          (!histTxs || !report ? (
            <LoadingCard text="Detectando contas fixas…" />
          ) : (
            <div className="rise space-y-5">
              <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start space-y-5 lg:space-y-0">
                <div className="lg:col-span-2">
                  <SegBars
                    data={recChart}
                    series={[
                      { key: "parcelados", label: "Parcelados", color: "#f0a818" },
                      { key: "recorrentes", label: "Recorrentes", color: "#4e77f6" },
                    ]}
                    height={230}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 px-2 lg:col-span-1 lg:flex lg:flex-col lg:gap-4">
                  <div className="flex gap-2.5">
                    <span className="w-1 rounded-full bg-amber" />
                    <div>
                      <div className="text-sm text-ink-dim">Parcelados</div>
                      <Money
                        value={selParc.reduce((s, i) => s + i.amount, 0)}
                        className="text-lg"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="w-1 rounded-full bg-accent" />
                    <div>
                      <div className="text-sm text-ink-dim">Recorrentes</div>
                      <Money value={recurringMonthly} className="text-lg" />
                    </div>
                  </div>
                </div>
              </div>

              <SegTabs
                variant="light"
                tabs={[
                  { key: "recorrentes", label: "Recorrentes" },
                  { key: "parcelamentos", label: "Parcelamentos" },
                ]}
                value={subTab}
                onChange={(k) => setSubTab(k as typeof subTab)}
              />

              <div className="space-y-4 px-1 lg:columns-2 lg:gap-x-10 lg:space-y-0">
                {subTab === "recorrentes" &&
                  (recurringItems.length === 0 ? (
                    <p className="text-sm text-ink-faint text-center py-6">
                      Nenhuma recorrência detectada.
                    </p>
                  ) : (
                    recurringItems.map((s) => (
                      <div
                        key={s.description}
                        className="flex items-center gap-3.5 lg:break-inside-avoid lg:mb-4"
                      >
                        <span className="h-11 w-11 rounded-2xl bg-soft grid place-items-center text-lg shrink-0">
                          🔁
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-semibold text-ink truncate">
                            {s.description}
                          </div>
                          <div className="text-sm text-ink-dim">
                            há {s.monthsSeen} {s.monthsSeen === 1 ? "mês" : "meses"} · todo
                            dia {Number(s.lastDate.split("-")[2])}
                          </div>
                        </div>
                        <Money value={s.monthlyAmount} className="text-[16px]" />
                      </div>
                    ))
                  ))}
                {subTab === "parcelamentos" &&
                  (selParc.length === 0 ? (
                    <p className="text-sm text-ink-faint text-center py-6">
                      Nenhum parcelamento ativo em {monthLabel(recMonth)}.
                    </p>
                  ) : (
                    selParc.map((i) => (
                      <div
                        key={i.key}
                        className="flex items-center gap-3.5 lg:break-inside-avoid lg:mb-4"
                      >
                        <span className="h-11 w-11 rounded-2xl bg-soft grid place-items-center text-lg shrink-0">
                          {catMeta(i.category).icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-semibold text-ink truncate">
                            {i.description}
                          </div>
                          <div className="text-sm text-ink-dim">
                            parcela {i.n} de {i.total}
                          </div>
                        </div>
                        <Money value={i.amount} className="text-[16px]" />
                      </div>
                    ))
                  ))}
              </div>
            </div>
          ))}
      </div>

      {/* Sheets */}
      <LimitSheet
        open={limitCat !== null}
        onClose={() => setLimitCat(null)}
        category={limitCat ?? "_global"}
        current={limitCat ? catBudget(limitCat) ?? (limitCat === "_global" ? globalBudget : null) : null}
      />

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filtros">
        <div className="space-y-4">
          <Field label="Categoria">
            <select
              className={inputCls}
              value={fCategory}
              onChange={(e) => setFCategory(e.target.value)}
            >
              <option value="">Todas</option>
              {[...new Set((allTxs ?? []).map((t) => (t.category ?? "").toLowerCase()).filter(Boolean))]
                .sort()
                .map((c) => (
                  <option key={c} value={c}>
                    {catMeta(c).icon} {catMeta(c).label}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Conta">
            <select
              className={inputCls}
              value={fAccount}
              onChange={(e) => setFAccount(e.target.value)}
            >
              <option value="">Todas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.marketingName ?? a.name ?? a.item.connectorName}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setFCategory("");
                setFAccount("");
              }}
              className="flex-1 rounded-full bg-soft text-ink font-semibold py-3.5 text-sm"
            >
              Limpar
            </button>
            <div className="flex-1">
              <PrimaryButton onClick={() => setFilterOpen(false)}>Aplicar</PrimaryButton>
            </div>
          </div>
        </div>
      </Sheet>

      {/* Detalhe de transação */}
      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Transação"
      >
        {selected && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <Money
                value={Math.abs(Number(selected.amount))}
                className="text-3xl"
              />
              <div className="text-[15px] font-medium text-ink mt-2">
                {selected.description ?? selected.descriptionRaw}
              </div>
              <div className="text-sm text-ink-dim mt-1">
                {new Date(selected.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
              </div>
              <div className="mt-3 flex justify-center">
                <Chip category={selected.category} />
              </div>
            </div>
            {selected.accountId === "manual-wallet" && (
              <button
                onClick={async () => {
                  await api.deleteManualTx(selected.id);
                  setSelected(null);
                  bumpData();
                }}
                className="w-full rounded-full bg-neg/10 text-neg font-semibold py-3.5 text-sm inline-flex items-center justify-center gap-2"
              >
                <IconTrash size={16} /> Excluir lançamento
              </button>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

export default function TransacoesPage() {
  return (
    <Suspense fallback={<div className="p-6"><LoadingCard /></div>}>
      <TransacoesInner />
    </Suspense>
  );
}

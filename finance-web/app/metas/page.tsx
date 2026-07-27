"use client";

// Metas: aportes planejados dos próximos meses, resumo do mês e cards de
// meta com progresso, aporte e conclusão.

import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  api,
  brl0,
  currentMonth,
  Goal,
  MONTH_LABELS,
  monthLabel,
} from "@/lib/api";
import { bumpData, useDataVersion } from "@/lib/bus";
import BlueHeader from "@/components/Header";
import Sheet from "@/components/Sheet";
import { GoalBars } from "@/components/Charts";
import {
  Card,
  ErrorCard,
  Field,
  inputCls,
  LoadingCard,
  Money,
  PrimaryButton,
  SegTabs,
} from "@/components/ui";
import { IconCheck, IconClock, IconTrash } from "@/components/icons";

const TABS = [
  { key: "andamento", label: "Em andamento" },
  { key: "prontas", label: "Prontas" },
  { key: "concluidas", label: "Concluídas" },
];

function bucket(g: Goal): string {
  if (g.status === "DONE") return "concluidas";
  if (g.status === "READY" || g.saved >= Number(g.targetAmount)) return "prontas";
  return "andamento";
}

/** "5 meses e 20 dias" até a meta, no ritmo do aporte mensal. */
function remainingLabel(g: Goal): string | null {
  const monthly = Number(g.monthlyContribution ?? 0);
  const missing = Number(g.targetAmount) - g.saved;
  if (missing <= 0 || monthly <= 0) return null;
  const months = missing / monthly;
  const whole = Math.floor(months);
  const days = Math.round((months - whole) * 30);
  if (whole === 0) return `${days} dias`;
  return `${whole} ${whole === 1 ? "mês" : "meses"}${days > 0 ? ` e ${days} dias` : ""}`;
}

export default function MetasPage() {
  const version = useDataVersion();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("andamento");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Goal | null>(null);

  const month = currentMonth();

  useEffect(() => {
    api.goals().then(setGoals).catch((e) => setError(e.message));
  }, [version]);

  const active = (goals ?? []).filter((g) => g.status === "ACTIVE");

  // Barras: mês atual = aportes reais; futuros = soma dos aportes planejados
  const chart = useMemo(() => {
    const planned = active.reduce((s, g) => s + Number(g.monthlyContribution ?? 0), 0);
    return Array.from({ length: 6 }, (_, i) => {
      const m = addMonths(month, i);
      const [, mm] = m.split("-");
      const actual = (goals ?? []).reduce(
        (s, g) => s + g.entries.filter((e) => e.month === m).reduce((a, e) => a + Number(e.amount), 0),
        0,
      );
      return {
        name: MONTH_LABELS[Number(mm) - 1].slice(0, 3),
        value: i === 0 ? Math.max(actual, planned) : planned,
        active: i === 0,
      };
    });
  }, [goals, active, month]);

  const monthTotal = (g: Goal) =>
    g.entries
      .filter((e) => e.month === month)
      .reduce((s, e) => s + Number(e.amount), 0);

  const savedTotal = (goals ?? []).reduce((s, g) => s + g.saved, 0);
  const list = (goals ?? []).filter((g) => bucket(g) === tab);

  return (
    <div>
      <BlueHeader title="Metas" onAdd={() => setCreateOpen(true)} />

      <div className="px-4 mt-5 space-y-4">
        {error && <ErrorCard message={error} />}
        {!goals ? (
          <LoadingCard text="Carregando metas…" />
        ) : (
          <div className="rise space-y-4 lg:space-y-5">
            <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start space-y-4 lg:space-y-0">
              <div className="lg:col-span-2">
                <GoalBars data={chart} height={290} />
              </div>

              {/* Resumo do mês */}
              <Card className="lg:col-span-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-ink">
                    {monthLabel(month).replace(" ", " de ")}
                  </h2>
                  <span className="text-sm text-ink-faint">
                    {active.length} meta{active.length !== 1 ? "s" : ""} ativa
                    {active.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="mt-3 space-y-4">
                  {active.map((g) => (
                    <div key={g.id} className="flex items-center gap-3.5">
                      <span className="h-11 w-11 rounded-2xl bg-soft grid place-items-center text-xl shrink-0">
                        {g.icon}
                      </span>
                      <span className="flex-1 text-[16px] font-medium text-ink truncate">
                        {g.name}
                      </span>
                      <Money
                        value={monthTotal(g) || Number(g.monthlyContribution ?? 0)}
                        cents={false}
                        className="text-[17px]"
                      />
                    </div>
                  ))}
                  {active.length === 0 && (
                    <p className="text-sm text-ink-faint">Nenhuma meta ativa.</p>
                  )}
                </div>
                <div className="flex items-center justify-between pt-4 mt-2 border-t border-edge">
                  <span className="text-[16px] font-medium text-ink">Total</span>
                  <Money value={savedTotal} cents={false} className="text-xl" />
                </div>
              </Card>
            </div>

            <SegTabs variant="light" tabs={TABS} value={tab} onChange={setTab} />

            {/* Cards de meta */}
            <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4">
              {list.map((g) => {
                const target = Number(g.targetAmount);
                const pct = target > 0 ? Math.min(Math.round((g.saved / target) * 100), 100) : 0;
                const contributed = monthTotal(g) > 0;
                const remaining = remainingLabel(g);
                return (
                  <Card
                    key={g.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(g)}
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="h-13 w-13 min-h-12 min-w-12 rounded-2xl bg-soft grid place-items-center text-2xl shrink-0">
                        {g.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[16px] font-semibold text-ink truncate">
                          {g.name}
                        </div>
                        <div className="text-[15px] mt-0.5">
                          <span className="font-bold text-ink">{brl0(g.saved)}</span>
                          <span className="text-ink-faint"> / {brl0(target)}</span>
                        </div>
                      </div>
                      <span className="rounded-full bg-soft px-3.5 py-2 text-sm font-bold text-ink">
                        {pct}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                          contributed ? "text-pos" : "text-ink-faint"
                        }`}
                      >
                        📅 Aporte Mensal {contributed && <IconCheck size={14} />}
                      </span>
                      {remaining && (
                        <span className="inline-flex items-center gap-1.5 text-sm text-ink-dim">
                          <IconClock size={14} /> {remaining}
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
              {list.length === 0 && (
                <p className="text-sm text-ink-faint text-center py-8">
                  Nenhuma meta aqui ainda.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <CreateGoalSheet open={createOpen} onClose={() => setCreateOpen(false)} />
      <GoalSheet
        key={selected?.id ?? "none"}
        goal={selected}
        month={month}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function CreateGoalSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [target, setTarget] = useState("");
  const [initial, setInitial] = useState("");
  const [monthly, setMonthly] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const t = Number(target.replace(",", "."));
    if (!name.trim() || !t || t <= 0) {
      setError("Dê um nome e um valor alvo maior que zero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createGoal({
        name: name.trim(),
        icon,
        targetAmount: t,
        initialAmount: Number(initial.replace(",", ".")) || 0,
        monthlyContribution: Number(monthly.replace(",", ".")) || 0,
      });
      bumpData();
      setName("");
      setTarget("");
      setInitial("");
      setMonthly("");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nova meta">
      <div className="space-y-4">
        <div className="grid grid-cols-[4.5rem_1fr] gap-3">
          <Field label="Ícone">
            <input
              className={`${inputCls} text-center text-xl`}
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={4}
            />
          </Field>
          <Field label="Nome">
            <input
              className={inputCls}
              placeholder="Ex.: Carro, Viagem…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor alvo (R$)">
            <input
              className={inputCls}
              inputMode="decimal"
              placeholder="30000"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </Field>
          <Field label="Já poupado (R$)">
            <input
              className={inputCls}
              inputMode="decimal"
              placeholder="0"
              value={initial}
              onChange={(e) => setInitial(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Aporte mensal (R$)">
          <input
            className={inputCls}
            inputMode="decimal"
            placeholder="0"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
          />
        </Field>
        {error && <p className="text-xs text-neg">{error}</p>}
        <PrimaryButton onClick={submit} disabled={saving}>
          {saving ? "Criando…" : "Criar meta"}
        </PrimaryButton>
      </div>
    </Sheet>
  );
}

function GoalSheet({
  goal,
  month,
  onClose,
}: {
  goal: Goal | null;
  month: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(goal?.monthlyContribution ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!goal) return null;
  const target = Number(goal.targetAmount);
  const done = goal.status === "DONE";

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      bumpData();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={`${goal.icon} ${goal.name}`}>
      <div className="space-y-4">
        <div className="text-center">
          <span className="font-bold text-2xl text-ink">{brl0(goal.saved)}</span>
          <span className="text-ink-faint text-lg"> / {brl0(target)}</span>
        </div>
        <div className="h-3 rounded-full bg-soft overflow-hidden">
          <div
            className="h-full rounded-full bg-amber"
            style={{ width: `${Math.min((goal.saved / target) * 100, 100)}%` }}
          />
        </div>

        {!done && (
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Field label={`Aportar em ${monthLabel(month)}`}>
                <input
                  className={inputCls}
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
            </div>
            <button
              disabled={busy}
              onClick={() => {
                const v = Number(amount.replace(",", "."));
                if (v) run(() => api.addGoalEntry(goal.id, month, v));
              }}
              className="rounded-full bg-azure-600 text-white font-semibold px-6 py-3.5 text-sm disabled:opacity-50"
            >
              Aportar
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            disabled={busy}
            onClick={() =>
              run(() =>
                api.updateGoal(goal.id, { status: done ? "ACTIVE" : "DONE" }),
              )
            }
            className="rounded-full bg-soft text-ink font-semibold py-3.5 text-sm"
          >
            {done ? "Reativar" : "Concluir meta"}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              if (confirm(`Excluir a meta "${goal.name}"?`))
                run(() => api.deleteGoal(goal.id));
            }}
            className="rounded-full bg-neg/10 text-neg font-semibold py-3.5 text-sm inline-flex items-center justify-center gap-2"
          >
            <IconTrash size={15} /> Excluir
          </button>
        </div>
        {error && <p className="text-xs text-neg">{error}</p>}
      </div>
    </Sheet>
  );
}

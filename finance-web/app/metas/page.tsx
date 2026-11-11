"use client";

// Metas: as metas vêm primeiro, cada uma com progresso, prazo e o aporte do
// mês. (Antes a tela abria com um gráfico de aportes planejados — seis barras
// iguais — e as metas ficavam lá embaixo.)

import { useEffect, useState } from "react";
import {
  api,
  brl0,
  currentMonth,
  Goal,
  MONTH_LABELS,
  parseBRL,
} from "@/lib/api";
import { bumpData, useDataVersion } from "@/lib/bus";
import PageHeader, { HeaderAction } from "@/components/Header";
import GoalSuggestions from "@/components/GoalSuggestions";
import Sheet from "@/components/Sheet";
import {
  Amount,
  Card,
  EmptyState,
  ErrorCard,
  Field,
  FilterChip,
  inputCls,
  LoadingCard,
  PageHero,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  SegTabs,
} from "@/components/ui";
import { IconCheck, IconClock, IconTrash } from "@/components/icons";

const GOAL_ICONS = ["🎯", "🚗", "✈️", "🏠", "🛟", "💻", "🎓", "💍", "📱", "🏖️"];

type Bucket = "andamento" | "prontas" | "concluidas";

function bucket(g: Goal): Bucket {
  if (g.status === "DONE") return "concluidas";
  if (g.status === "READY" || g.saved >= Number(g.targetAmount)) return "prontas";
  return "andamento";
}

/** "2 anos e 3 meses" / "5 meses" / "20 dias" para juntar `missing` a `monthly` por mês. */
function timeToReach(missing: number, monthly: number): string | null {
  if (missing <= 0 || monthly <= 0) return null;
  const months = missing / monthly;
  if (months < 1) return `${Math.max(1, Math.round(months * 30))} dias`;
  const whole = Math.ceil(months);
  const years = Math.floor(whole / 12);
  const rest = whole % 12;
  const y = years ? `${years} ${years === 1 ? "ano" : "anos"}` : "";
  const m = rest ? `${rest} ${rest === 1 ? "mês" : "meses"}` : "";
  return [y, m].filter(Boolean).join(" e ");
}

const monthName = (m: string) => MONTH_LABELS[Number(m.split("-")[1]) - 1].toLowerCase();

export default function MetasPage() {
  const version = useDataVersion();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Bucket>("andamento");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const month = currentMonth();

  useEffect(() => {
    api
      .goals()
      .then((g) => {
        setGoals(g);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [version]);

  const all = goals ?? [];
  const active = all.filter((g) => g.status === "ACTIVE");
  const planned = active.reduce((s, g) => s + Number(g.monthlyContribution ?? 0), 0);
  const savedTotal = all.reduce((s, g) => s + g.saved, 0);

  const monthTotal = (g: Goal) =>
    g.entries.filter((e) => e.month === month).reduce((s, e) => s + Number(e.amount), 0);

  const counts: Record<Bucket, number> = { andamento: 0, prontas: 0, concluidas: 0 };
  for (const g of all) counts[bucket(g)]++;
  // Com tudo em uma aba só, as abas seriam três botões para nada.
  const showTabs = counts.prontas + counts.concluidas > 0;
  const shownTab = showTabs ? tab : "andamento";
  const list = all.filter((g) => bucket(g) === shownTab);
  const selected = all.find((g) => g.id === selectedId) ?? null;

  return (
    <div>
      <PageHeader
        title="Metas"
        back
        actions={<HeaderAction label="Nova meta" onClick={() => setCreateOpen(true)} />}
      >
        {all.length > 0 && (
          <PageHero
            label="Guardado para suas metas"
            value={<Amount>{brl0(savedTotal)}</Amount>}
            hint={
              <>
                {active.length} {active.length === 1 ? "meta ativa" : "metas ativas"}
                {planned > 0 && (
                  <>
                    {" · "}
                    <Amount>{brl0(planned)}</Amount> planejados por mês
                  </>
                )}
              </>
            }
          />
        )}
      </PageHeader>

      <div className="px-4 mt-5 space-y-4">
        {error && <ErrorCard message={error} />}
        {!goals ? (
          !error && <LoadingCard text="Carregando metas…" />
        ) : all.length === 0 ? (
          <EmptyState
            icon="🎯"
            text="Uma meta mostra quanto falta e em quanto tempo você chega lá — e os aportes do seu extrato entram nela com um toque."
            action={{ label: "Criar primeira meta", onClick: () => setCreateOpen(true) }}
          />
        ) : (
          <div className="rise space-y-4 lg:max-w-4xl">
            <GoalSuggestions goals={goals} />

            {showTabs && (
              <SegTabs
                variant="light"
                tabs={[
                  { key: "andamento", label: "Em andamento", count: counts.andamento },
                  { key: "prontas", label: "Prontas", count: counts.prontas },
                  { key: "concluidas", label: "Concluídas", count: counts.concluidas },
                ]}
                value={shownTab}
                onChange={(k) => setTab(k as Bucket)}
              />
            )}

            <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4">
              {list.map((g) => {
                const target = Number(g.targetAmount);
                const ratio = target > 0 ? g.saved / target : 0;
                const monthly = Number(g.monthlyContribution ?? 0);
                const thisMonth = monthTotal(g);
                const eta = timeToReach(target - g.saved, monthly);
                return (
                  <Card key={g.id} onClick={() => setSelectedId(g.id)}>
                    <div className="flex items-center gap-3.5">
                      <span className="h-12 w-12 rounded-2xl bg-soft grid place-items-center text-2xl shrink-0">
                        {g.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[16px] font-semibold text-ink truncate">
                          {g.name}
                        </div>
                        <div className="text-[14px] mt-0.5">
                          <span className="font-bold text-ink">
                            <Amount>{brl0(g.saved)}</Amount>
                          </span>
                          <span className="text-ink-dim">
                            {" "}
                            de <Amount>{brl0(target)}</Amount>
                          </span>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-ink">
                        {Math.min(Math.round(ratio * 100), 100)}%
                      </span>
                    </div>
                    <ProgressBar
                      ratio={Math.min(ratio, 1)}
                      color="var(--color-amber)"
                      className="mt-4"
                    />
                    {g.status === "ACTIVE" && (
                      <div className="flex items-center justify-between gap-3 mt-3 text-[13px]">
                        {thisMonth > 0 ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-pos">
                            <IconCheck size={13} />
                            <Amount>{brl0(thisMonth)}</Amount> em {monthName(month)}
                          </span>
                        ) : (
                          <span className="font-semibold text-accent">
                            {monthly > 0 ? (
                              <>
                                Aportar <Amount>{brl0(monthly)}</Amount> de {monthName(month)}
                              </>
                            ) : (
                              "Fazer um aporte"
                            )}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 text-ink-dim">
                          {eta ? (
                            <>
                              <IconClock size={13} /> {eta}
                            </>
                          ) : monthly === 0 ? (
                            "sem aporte mensal definido"
                          ) : null}
                        </span>
                      </div>
                    )}
                  </Card>
                );
              })}
              {list.length === 0 && (
                <p className="text-sm text-ink-faint text-center py-8 lg:col-span-2">
                  Nenhuma meta aqui ainda.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="Nova meta">
        {createOpen && <CreateGoalForm onClose={() => setCreateOpen(false)} />}
      </Sheet>
      <GoalSheet
        key={selected?.id ?? "none"}
        goal={selected}
        month={month}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (i: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1" role="radiogroup" aria-label="Ícone">
      {GOAL_ICONS.map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          onClick={() => onChange(i)}
          className={`h-11 w-11 shrink-0 rounded-2xl grid place-items-center text-xl ${
            value === i ? "bg-accent/20 ring-2 ring-accent" : "bg-soft"
          }`}
        >
          {i}
        </button>
      ))}
    </div>
  );
}

function CreateGoalForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(GOAL_ICONS[0]);
  const [target, setTarget] = useState("");
  const [monthly, setMonthly] = useState("");
  const [initial, setInitial] = useState("");
  const [hasInitial, setHasInitial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = parseBRL(target) || 0;
  const m = parseBRL(monthly) || 0;
  const i = hasInitial ? parseBRL(initial) || 0 : 0;
  const eta = timeToReach(t - i, m);

  async function submit() {
    if (!name.trim() || t <= 0) {
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
        initialAmount: i,
        monthlyContribution: m,
      });
      bumpData();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <IconPicker value={icon} onChange={setIcon} />
      <Field label="Para quê?">
        <input
          className={inputCls}
          placeholder="Ex.: carro, viagem, reserva…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quanto custa (R$)">
          <input
            className={inputCls}
            inputMode="decimal"
            placeholder="30.000"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </Field>
        <Field label="Aporte por mês (R$)">
          <input
            className={inputCls}
            inputMode="decimal"
            placeholder="opcional"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
          />
        </Field>
      </div>
      {hasInitial ? (
        <Field label="Já tenho guardado (R$)">
          <input
            className={inputCls}
            inputMode="decimal"
            placeholder="0"
            value={initial}
            onChange={(e) => setInitial(e.target.value)}
            autoFocus
          />
        </Field>
      ) : (
        <FilterChip active={false} onClick={() => setHasInitial(true)}>
          + Já tenho uma parte guardada
        </FilterChip>
      )}
      {eta && (
        <p className="text-sm text-ink-dim">
          Nesse ritmo você chega lá em <b className="text-ink font-semibold">{eta}</b>.
        </p>
      )}
      {error && (
        <p className="text-xs text-neg" role="alert">
          {error}
        </p>
      )}
      <PrimaryButton type="submit" disabled={saving}>
        {saving ? "Criando…" : "Criar meta"}
      </PrimaryButton>
    </form>
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
  const monthly = Number(goal?.monthlyContribution ?? 0);
  const [amount, setAmount] = useState(monthly > 0 ? String(monthly).replace(".", ",") : "");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(goal?.name ?? "");
  const [icon, setIcon] = useState(goal?.icon ?? GOAL_ICONS[0]);
  const [target, setTarget] = useState(goal ? String(Number(goal.targetAmount)).replace(".", ",") : "");
  const [contribution, setContribution] = useState(monthly > 0 ? String(monthly).replace(".", ",") : "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!goal) return null;
  const targetValue = Number(goal.targetAmount);
  const done = goal.status === "DONE";
  const missing = Math.max(targetValue - goal.saved, 0);

  async function run(fn: () => Promise<unknown>, close = true) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      bumpData();
      if (close) onClose();
      else setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={`${goal.icon} ${goal.name}`}>
      <div className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-bold text-2xl text-ink">
              <Amount>{brl0(goal.saved)}</Amount>
            </span>
            <span className="text-ink-dim text-sm">
              de <Amount>{brl0(targetValue)}</Amount>
            </span>
          </div>
          <ProgressBar
            ratio={targetValue > 0 ? Math.min(goal.saved / targetValue, 1) : 0}
            color="var(--color-amber)"
            className="mt-2.5"
          />
          {missing > 0 && (
            <div className="text-[13px] text-ink-dim mt-1.5">
              Faltam <Amount>{brl0(missing)}</Amount>
              {timeToReach(missing, monthly) ? ` · ${timeToReach(missing, monthly)} no ritmo atual` : ""}
            </div>
          )}
        </div>

        {!done && !editing && (
          <form
            className="flex gap-3 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              const v = parseBRL(amount);
              if (v > 0) run(() => api.addGoalEntry(goal.id, month, v));
              else setError("Informe o valor do aporte.");
            }}
          >
            <div className="flex-1">
              <Field label={`Aporte de ${monthName(month)} (R$)`}>
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
              type="submit"
              disabled={busy}
              className="rounded-full bg-azure-600 text-white font-semibold px-6 py-3 text-sm disabled:opacity-50"
            >
              Aportar
            </button>
          </form>
        )}

        {editing ? (
          <form
            className="space-y-3 rounded-2xl bg-soft/50 p-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              const t = parseBRL(target);
              if (!name.trim() || !(t > 0)) {
                setError("Nome e valor alvo são obrigatórios.");
                return;
              }
              run(
                () =>
                  api.updateGoal(goal.id, {
                    name: name.trim(),
                    icon,
                    targetAmount: t,
                    monthlyContribution: parseBRL(contribution) || 0,
                  }),
                false,
              );
            }}
          >
            <IconPicker value={icon} onChange={setIcon} />
            <Field label="Nome">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor alvo (R$)">
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </Field>
              <Field label="Aporte por mês (R$)">
                <input
                  className={inputCls}
                  inputMode="decimal"
                  placeholder="0"
                  value={contribution}
                  onChange={(e) => setContribution(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SecondaryButton onClick={() => setEditing(false)} disabled={busy}>
                Cancelar
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={busy}>
                Salvar
              </PrimaryButton>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <SecondaryButton onClick={() => setEditing(true)} disabled={busy}>
              Editar meta
            </SecondaryButton>
            <SecondaryButton
              disabled={busy}
              onClick={() =>
                run(() => api.updateGoal(goal.id, { status: done ? "ACTIVE" : "DONE" }))
              }
            >
              {done ? "Reativar" : "Concluir meta"}
            </SecondaryButton>
            <div className="col-span-2">
              <SecondaryButton
                tone="danger"
                disabled={busy}
                onClick={() =>
                  confirmDelete ? run(() => api.deleteGoal(goal.id)) : setConfirmDelete(true)
                }
              >
                <IconTrash size={15} />
                {confirmDelete ? "Toque de novo para excluir a meta" : "Excluir meta"}
              </SecondaryButton>
            </div>
          </div>
        )}
        {error && (
          <p className="text-xs text-neg" role="alert">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

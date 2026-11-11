"use client";

// Aplicações detectadas no extrato viram aporte de meta com um toque. Sem
// isto, a meta só avança se o usuário lembrar de abrir o app e digitar o
// valor — que é como metas morrem.
//
// Com uma única meta ativa (o caso comum) há também "contar todas": quatro
// aplicações pendentes deixam de ser quatro toques.

import { useEffect, useState } from "react";
import { api, brl0, Goal, GoalSuggestion } from "@/lib/api";
import { bumpData } from "@/lib/bus";
import { Amount, Card, CardHeader } from "@/components/ui";
import { IconX } from "@/components/icons";

export default function GoalSuggestions({ goals }: { goals: Goal[] }) {
  const [items, setItems] = useState<GoalSuggestion[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.goalSuggestions().then(setItems).catch(() => setItems([]));
  }, []);

  async function decide(transactionId: string, goalId?: string) {
    setBusy(transactionId);
    setErro(null);
    try {
      await api.decideGoalSuggestion(transactionId, goalId);
      setItems((prev) => (prev ?? []).filter((i) => i.transactionId !== transactionId));
      if (goalId) bumpData();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function decideAll(goalId: string) {
    setBusy("all");
    setErro(null);
    try {
      for (const s of items ?? []) {
        await api.decideGoalSuggestion(s.transactionId, goalId);
        setItems((prev) => (prev ?? []).filter((i) => i.transactionId !== s.transactionId));
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBusy(null);
      bumpData();
    }
  }

  const ativas = goals.filter((g) => g.status === "ACTIVE");
  if (!items?.length || !ativas.length) return null;

  const unica = ativas.length === 1 ? ativas[0] : null;
  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <Card>
      <CardHeader title="Aportes detectados" />
      <p className="text-sm text-ink-dim leading-relaxed">
        {items.length === 1
          ? "Encontramos 1 aplicação no seu extrato."
          : `Encontramos ${items.length} aplicações no seu extrato`}
        {items.length > 1 && (
          <>
            , somando <Amount>{brl0(total)}</Amount>.
          </>
        )}{" "}
        {unica ? `Contam para ${unica.icon} ${unica.name}?` : "Contam para qual meta?"}
      </p>

      {unica && items.length > 1 && (
        <button
          disabled={busy !== null}
          onClick={() => decideAll(unica.id)}
          className="mt-3 w-full rounded-full bg-accent text-white font-semibold py-3 text-sm disabled:opacity-50"
        >
          {busy === "all" ? "Contando…" : `Contar todas em ${unica.icon} ${unica.name}`}
        </button>
      )}

      {erro && <p className="text-xs text-neg mt-2">{erro}</p>}

      <div className="divide-y divide-edge mt-2">
        {items.slice(0, 5).map((s) => (
          <div key={s.transactionId} className="py-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-ink truncate">
                  {s.description}
                </div>
                <div className="text-xs text-ink-dim">
                  {s.date.slice(8, 10)}/{s.date.slice(5, 7)} ·{" "}
                  <span className="text-pos font-semibold">
                    <Amount>{brl0(s.amount)}</Amount>
                  </span>
                </div>
              </div>
              {unica && (
                <button
                  disabled={busy !== null}
                  onClick={() => decide(s.transactionId, unica.id)}
                  className="rounded-full bg-soft text-ink font-semibold px-3.5 py-2 text-sm disabled:opacity-40"
                >
                  Contar
                </button>
              )}
              <button
                aria-label="Não é aporte de meta"
                title="Não é aporte de meta"
                disabled={busy !== null}
                onClick={() => decide(s.transactionId)}
                className="h-9 w-9 rounded-full grid place-items-center text-ink-faint disabled:opacity-40"
              >
                <IconX size={14} />
              </button>
            </div>

            {!unica && (
              <div className="flex flex-wrap gap-2 mt-2">
                {ativas.map((g) => (
                  <button
                    key={g.id}
                    disabled={busy !== null}
                    onClick={() => decide(s.transactionId, g.id)}
                    className="flex items-center gap-1.5 rounded-full bg-soft px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
                  >
                    <span>{g.icon}</span>
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {items.length > 5 && (
        <p className="text-xs text-ink-faint mt-1">
          E mais {items.length - 5} — aparecem conforme você resolve estas.
        </p>
      )}
    </Card>
  );
}

"use client";

// Aplicações detectadas no extrato viram aporte de meta com um toque. Sem
// isto, a meta só avança se o usuário lembrar de abrir o app e digitar o
// valor — que é como metas morrem.

import { useEffect, useState } from "react";
import { api, brl0, Goal, GoalSuggestion } from "@/lib/api";
import { bumpData } from "@/lib/bus";
import { Amount, Card, CardHeader } from "@/components/ui";
import { IconSparkle, IconX } from "@/components/icons";

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

  const ativas = goals.filter((g) => g.status === "ACTIVE");
  if (!items?.length || !ativas.length) return null;

  return (
    <Card>
      <CardHeader title="Aportes detectados" />
      <p className="text-sm text-ink-dim mb-3 leading-relaxed">
        Encontramos {items.length}{" "}
        {items.length === 1 ? "aplicação" : "aplicações"} no seu extrato. Quer
        contar {items.length === 1 ? "ela" : "elas"} em alguma meta?
      </p>

      {erro && <p className="text-xs text-neg mb-2">{erro}</p>}

      <div className="space-y-3">
        {items.slice(0, 4).map((s) => (
          <div key={s.transactionId} className="bg-soft rounded-2xl p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-ink truncate">
                  {s.description}
                </div>
                <div className="text-xs text-ink-dim">
                  {s.date.slice(8, 10)}/{s.date.slice(5, 7)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[15px] font-bold text-pos">
                  <Amount>{brl0(s.amount)}</Amount>
                </span>
                <button
                  aria-label="Dispensar"
                  disabled={busy === s.transactionId}
                  onClick={() => decide(s.transactionId)}
                  className="h-8 w-8 rounded-full grid place-items-center text-ink-faint disabled:opacity-40"
                >
                  <IconX size={14} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-2.5">
              {ativas.map((g) => (
                <button
                  key={g.id}
                  disabled={busy === s.transactionId}
                  onClick={() => decide(s.transactionId, g.id)}
                  className="flex items-center gap-1.5 rounded-full bg-card border border-edge px-3 py-1.5 text-xs font-semibold text-ink-dim disabled:opacity-40"
                >
                  <span>{g.icon}</span>
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-ink-faint mt-3">
        <IconSparkle size={12} />
        Detectado pelas transações da categoria Investimentos.
      </div>
    </Card>
  );
}

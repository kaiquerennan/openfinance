"use client";

// Reserva de emergência em meses de custo de vida — "por quantos meses eu me
// sustento se a renda parar hoje" diz mais que o saldo absoluto.

import { brl0, ReserveStatus } from "@/lib/api";
import { Amount, Card } from "@/components/ui";

const STATUS: Record<
  ReserveStatus["status"],
  { label: string; bar: string; text: string }
> = {
  "sem-reserva": { label: "Sem reserva", bar: "bg-neg", text: "text-neg" },
  iniciando: { label: "Começando", bar: "bg-amber", text: "text-amber" },
  boa: { label: "No caminho", bar: "bg-azure-400", text: "text-azure-300" },
  completa: { label: "Completa", bar: "bg-pos", text: "text-pos" },
  indefinido: { label: "Sem dados", bar: "bg-soft", text: "text-ink-dim" },
};

export default function ReserveCard({ reserve }: { reserve?: ReserveStatus }) {
  // O backend pode estar numa versão anterior a este campo (front e API são
  // publicados separadamente) — nesse caso o cartão simplesmente não aparece,
  // em vez de derrubar a home inteira.
  if (!reserve || reserve.status === "indefinido" || reserve.months === null)
    return null;

  const meta = STATUS[reserve.status];
  const pct = Math.min((reserve.months / reserve.targetMonths) * 100, 100);
  const meses = reserve.months.toFixed(1).replace(".", ",");

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-ink-dim">Reserva de emergência</div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-3xl font-semibold text-ink">{meses}</span>
            <span className="text-ink-dim text-[15px]">
              {reserve.months === 1 ? "mês" : "meses"} de custo de vida
            </span>
          </div>
        </div>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full bg-soft ${meta.text}`}
        >
          {meta.label}
        </span>
      </div>

      <div className="mt-4 h-2 rounded-full bg-soft overflow-hidden">
        <div
          className={`h-full rounded-full ${meta.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-ink-dim mt-1.5">
        <span>
          <Amount>{brl0(reserve.liquidAssets)}</Amount> guardados
        </span>
        <span>meta: {reserve.targetMonths} meses</span>
      </div>

      <div className="text-sm text-ink-dim mt-3 leading-relaxed">
        {reserve.missing > 0 ? (
          <>
            Seu mês custa cerca de <Amount>{brl0(reserve.monthlyCost)}</Amount>.
            Faltam <b className="text-ink"><Amount>{brl0(reserve.missing)}</Amount></b> para
            os {reserve.targetMonths} meses recomendados.
          </>
        ) : (
          <>
            Sua reserva já cobre {reserve.targetMonths} meses. O dinheiro novo
            pode ir para objetivos de prazo mais longo.
          </>
        )}
      </div>
    </Card>
  );
}

"use client";

// Lista de transações agrupadas por dia: "SEG, 13 DE JULHO" + linhas com
// descrição, chip de categoria e valor.

import { DbTransaction, dayGroupLabel, signedAmount } from "@/lib/api";
import { txKind } from "@/lib/categories";
import { Chip, Money } from "@/components/ui";

export default function TxList({
  transactions,
  onSelect,
}: {
  transactions: DbTransaction[];
  onSelect?: (t: DbTransaction) => void;
}) {
  if (!transactions.length)
    return (
      <p className="text-sm text-ink-faint py-6 text-center">
        Nenhuma transação neste período.
      </p>
    );

  const groups: { day: string; txs: DbTransaction[] }[] = [];
  for (const t of transactions) {
    const day = t.date.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.txs.push(t);
    else groups.push({ day, txs: [t] });
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.day}>
          <div className="text-[11px] font-semibold tracking-[0.12em] text-ink-faint mb-2">
            {dayGroupLabel(g.day)}
          </div>
          <div className="space-y-3.5">
            {g.txs.map((t) => {
              const amt = signedAmount(t);
              const kind = txKind(t.category, amt);
              const income = kind === "income" && amt > 0;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelect?.(t)}
                  className="w-full flex items-center gap-2 text-left"
                >
                  <span className="flex-1 min-w-0 truncate text-[15px] font-medium text-ink">
                    {t.description ?? t.descriptionRaw ?? "—"}
                  </span>
                  <Chip category={t.category} />
                  <Money
                    value={Math.abs(amt)}
                    signed={false}
                    className={`text-[15px] ${income ? "text-pos" : "text-ink"}`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

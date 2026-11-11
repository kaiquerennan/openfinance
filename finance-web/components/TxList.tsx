"use client";

// Lista de transações agrupadas por dia. Cada linha tem duas linhas de texto:
// a descrição inteira em cima (antes ela era espremida pelo chip de categoria)
// e categoria · conta embaixo.
//
// Tocar numa linha abre o detalhe (com correção de categoria) em qualquer tela
// que use a lista — antes isso só funcionava em Transações, e nas outras a
// linha parecia clicável mas não fazia nada.

import { useState } from "react";
import {
  DbTransaction,
  dayGroupLabel,
  signedAmount,
  todayIso,
  txAccountName,
  txTitle,
  zonedDay,
} from "@/lib/api";
import { catMeta, txGroup } from "@/lib/categories";
import TxDetailSheet from "@/components/TxDetailSheet";
import { CategoryIcon, Money } from "@/components/ui";

export default function TxList({
  transactions,
  showAccount = true,
  emptyText = "Nenhuma transação por aqui.",
}: {
  transactions: DbTransaction[];
  /** Esconde a conta quando a lista inteira já é de uma conta só. */
  showAccount?: boolean;
  emptyText?: string;
}) {
  const [selected, setSelected] = useState<DbTransaction | null>(null);

  if (!transactions.length)
    return <p className="text-sm text-ink-faint py-6 text-center">{emptyText}</p>;

  const today = todayIso();
  const groups: { day: string; txs: DbTransaction[] }[] = [];
  for (const t of transactions) {
    const day = zonedDay(t.date);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.txs.push(t);
    else groups.push({ day, txs: [t] });
  }

  return (
    <>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.day}>
            <div className="text-[11px] font-semibold tracking-[0.12em] text-ink-faint mb-1">
              {dayGroupLabel(g.txs[0].date)}
              {/* Parcelas do cartão já vêm lançadas com a data em que vão cair. */}
              {g.day > today && <span className="text-accent"> · PREVISTO</span>}
            </div>
            <div>
              {g.txs.map((t) => {
                const amt = signedAmount(t);
                const kind = txGroup(t.category, amt);
                const income = kind === "income" && amt > 0;
                const neutral = kind === "transfer" || kind === "investment";
                const account = showAccount ? txAccountName(t) : null;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="w-full flex items-center gap-3 py-2 text-left active:opacity-70 transition"
                  >
                    <CategoryIcon category={t.category} size="sm" />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-[15px] font-medium text-ink">
                        {txTitle(t)}
                      </span>
                      <span className="block truncate text-[12.5px] text-ink-dim">
                        {catMeta(t.category).label}
                        {account ? ` · ${account}` : ""}
                      </span>
                    </span>
                    <Money
                      value={income ? amt : Math.abs(amt)}
                      signed={income}
                      className={`text-[15px] ${
                        income ? "text-pos" : neutral ? "text-ink-dim" : "text-ink"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <TxDetailSheet
        transaction={selected}
        onClose={() => setSelected(null)}
        onChange={setSelected}
      />
    </>
  );
}

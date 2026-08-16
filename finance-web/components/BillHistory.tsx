"use client";

// Ciclos de fatura de um cartão: o que já corre para a próxima, e como as
// últimas fecharam. O saldo sozinho responde "quanto devo agora"; é o
// histórico que responde "por que veio maior" e onde apareceu juros.

import { Bill, brl, brl0, CardBills } from "@/lib/api";
import { Amount, Money } from "@/components/ui";

const STATUS_STYLE: Record<Bill["status"], string> = {
  paga: "bg-pos/15 text-pos",
  "a vencer": "bg-soft text-ink-dim",
  parcial: "bg-neg/15 text-neg",
  "em aberto": "bg-amber/15 text-amber",
};

function monthDay(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export default function BillHistory({ card }: { card: CardBills }) {
  if (!card.bills.length && !card.open) return null;

  return (
    <div className="mt-4">
      {card.open && (
        <div className="rounded-2xl bg-soft px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-dim">Próxima fatura (parcial)</span>
            <Money value={card.open.total} className="text-[15px] text-ink" />
          </div>
          <div className="text-xs text-ink-faint mt-1">
            {card.open.count} compra(s) desde {monthDay(card.open.since)}
            {card.open.closesOn ? ` · fecha em ${monthDay(card.open.closesOn)}` : ""}
            {card.open.dueDate ? ` · vence em ${monthDay(card.open.dueDate)}` : ""}
          </div>
        </div>
      )}

      {card.chargesRecent > 0 && (
        <p className="text-xs text-neg mt-3">
          <Amount>{brl(card.chargesRecent)}</Amount> em juros e encargos nas últimas
          faturas — é o rotativo cobrando.
        </p>
      )}

      {card.bills.length > 0 && (
        <div className="mt-3">
          <div className="text-sm font-semibold text-ink-dim mb-2">Faturas</div>
          <div className="divide-y divide-edge">
            {card.bills.map((b) => (
              <div key={b.id} className="flex items-center gap-3 py-2.5">
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium text-ink">
                    Venceu {monthDay(b.dueDate)}
                  </span>
                  <span className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[b.status]}`}
                    >
                      {b.status}
                    </span>
                    {b.charges > 0 && (
                      <span className="text-[11px] text-neg">
                        <Amount>{brl0(b.charges)}</Amount> de encargos
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <Money value={b.total} className="text-[15px] text-ink" />
                  {b.changePct !== null && (
                    <span
                      className={`block text-xs ${
                        b.changePct > 0 ? "text-neg" : "text-pos"
                      }`}
                    >
                      {b.changePct > 0 ? "▲" : "▼"} {Math.abs(b.changePct)}%
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="text-xs text-ink-faint mt-2">
            Média das últimas: <Amount>{brl0(card.average)}</Amount>
          </div>
        </div>
      )}
    </div>
  );
}

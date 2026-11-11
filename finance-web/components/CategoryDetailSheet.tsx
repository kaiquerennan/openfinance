"use client";

// Tocar numa categoria responde "gastei isso em quê?": as transações dela no
// mês, a comparação com o mês passado e com a média, e o limite — tudo no
// mesmo lugar. Antes o toque só abria o campo de limite, e ver as compras
// exigia ir a Transações e montar o filtro à mão.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  brl0,
  CategoryStat,
  DbTransaction,
  monthLabel,
  monthRange,
} from "@/lib/api";
import { useDataVersion } from "@/lib/bus";
import { catColor, catMeta } from "@/lib/categories";
import Sheet from "@/components/Sheet";
import TxList from "@/components/TxList";
import {
  Amount,
  CategoryIcon,
  Money,
  ProgressBar,
  SecondaryButton,
} from "@/components/ui";
import { IconPencil } from "@/components/icons";

function Delta({ pct, label }: { pct: number | null; label: string }) {
  if (pct === null || Math.abs(pct) < 1) return null;
  const up = pct > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        up ? "bg-neg/15 text-neg" : "bg-pos/15 text-pos"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(Math.round(pct))}% {label}
    </span>
  );
}

export default function CategoryDetailSheet({
  category,
  month,
  total,
  limit,
  stat,
  onClose,
  onEditLimit,
}: {
  /** Chave em minúsculas; null = fechado. */
  category: string | null;
  month: string;
  total: number;
  limit: number | null;
  stat?: CategoryStat;
  onClose: () => void;
  onEditLimit: () => void;
}) {
  const router = useRouter();
  const version = useDataVersion();
  const [loaded, setLoaded] = useState<{ key: string; txs: DbTransaction[] } | null>(null);
  const key = category ? `${category}|${month}|${version}` : null;

  useEffect(() => {
    if (!category || !key) return;
    let stale = false;
    const { from, to } = monthRange(month);
    api
      .transactions({ from, to, category, take: 300 })
      .then((p) => !stale && setLoaded({ key, txs: p.transactions }))
      .catch(() => !stale && setLoaded({ key, txs: [] }));
    return () => {
      stale = true;
    };
  }, [category, month, key]);

  const txs = loaded && loaded.key === key ? loaded.txs : null;
  const meta = catMeta(category);

  return (
    <Sheet open={category !== null} onClose={onClose} title={meta.label}>
      {category && (
        <div className="space-y-4">
          <div className="flex items-center gap-3.5">
            <CategoryIcon category={category} />
            <div className="min-w-0">
              <Money value={total} className="text-2xl text-ink" />
              <div className="text-sm text-ink-dim">
                em {monthLabel(month).toLowerCase()}
                {stat ? ` · ${stat.count} ${stat.count === 1 ? "compra" : "compras"}` : ""}
              </div>
            </div>
          </div>

          {stat && (stat.growthPct !== null || stat.vsHistAvgPct !== null) && (
            <div className="flex flex-wrap gap-2">
              <Delta pct={stat.growthPct} label="vs. mês passado" />
              <Delta pct={stat.vsHistAvgPct} label="vs. sua média" />
            </div>
          )}

          <button
            onClick={onEditLimit}
            className="w-full rounded-2xl bg-soft px-4 py-3 text-left"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink-dim">Limite mensal</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                {limit !== null ? <Amount>{brl0(limit)}</Amount> : "Definir"}
                <IconPencil size={13} />
              </span>
            </span>
            {limit !== null && (
              <>
                <ProgressBar
                  ratio={limit > 0 ? total / limit : 0}
                  color={catColor(category)}
                  className="mt-2.5"
                />
                <span className="block text-xs text-ink-dim mt-1.5">
                  {total > limit ? (
                    <span className="text-neg font-semibold">
                      <Amount>{brl0(total - limit)}</Amount> acima do limite
                    </span>
                  ) : (
                    <>
                      Restam <Amount>{brl0(limit - total)}</Amount>
                    </>
                  )}
                </span>
              </>
            )}
          </button>

          <div>
            <div className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">
              Transações do mês
            </div>
            {txs === null ? (
              <p className="text-sm text-ink-faint py-4 text-center">Carregando…</p>
            ) : (
              <TxList
                transactions={txs}
                emptyText="Nenhuma transação desta categoria neste mês."
              />
            )}
          </div>

          <SecondaryButton
            onClick={() => {
              onClose();
              router.push(`/transacoes?categoria=${encodeURIComponent(category)}`);
            }}
          >
            Ver {meta.label} em todos os meses
          </SecondaryButton>
        </div>
      )}
    </Sheet>
  );
}

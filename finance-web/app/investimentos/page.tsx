"use client";

// Investimentos: aportes líquidos por mês (categoria "investments") e
// histórico de movimentações.

import { useEffect, useMemo, useState } from "react";
import {
  api,
  brl0,
  DbInvestment,
  DbTransaction,
  MONTH_LABELS,
  monthRange,
  signedAmount,
} from "@/lib/api";
import { useDataVersion } from "@/lib/bus";
import BlueHeader from "@/components/Header";
import TxList from "@/components/TxList";
import { ValueBars } from "@/components/Charts";
import { Amount, Card, EmptyState, ErrorCard, LoadingCard } from "@/components/ui";

export default function InvestimentosPage() {
  const version = useDataVersion();
  const [byMonth, setByMonth] = useState<Map<string, DbTransaction[]> | null>(null);
  const [investments, setInvestments] = useState<DbInvestment[] | null>(null);
  const [investmentsTotal, setInvestmentsTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ms = (await api.months()).slice(-12);
        const pages = await Promise.all(
          ms.map((m) => {
            const { from, to } = monthRange(m);
            return api.transactions({ from, to, category: "investments", take: 500 });
          }),
        );
        setByMonth(new Map(ms.map((m, i) => [m, pages[i].transactions])));
      } catch (e) {
        setError((e as Error).message);
      }
      try {
        const { total, investments } = await api.investments();
        setInvestmentsTotal(total);
        setInvestments(investments);
      } catch {
        // Conector pode nao expor investimentos — segue so com os aportes.
      }
    })();
  }, [version]);

  // Aportes líquidos: saída da conta (valor negativo) = dinheiro investido
  const monthly = useMemo(
    () =>
      [...(byMonth?.entries() ?? [])].map(([m, txs]) => {
        const net = txs.reduce((s, t) => s + -signedAmount(t), 0);
        const [, mm] = m.split("-");
        return { name: MONTH_LABELS[Number(mm) - 1].slice(0, 3), value: net };
      }),
    [byMonth],
  );

  const all = useMemo(
    () =>
      [...(byMonth?.values() ?? [])]
        .flat()
        .sort((a, b) => b.date.localeCompare(a.date)),
    [byMonth],
  );

  const totalInvested = monthly.reduce((s, m) => s + Math.max(m.value, 0), 0);
  const hasRealBalance = investments !== null && investments.length > 0;

  return (
    <div>
      <BlueHeader title="Investimentos">
        <div className="mt-4">
          <div className="text-white/70 text-[15px]">
            {hasRealBalance ? "Saldo atual investido" : "Aportes em 12 meses"}
          </div>
          <div className="text-5xl font-semibold mt-1">
            <Amount>{brl0(hasRealBalance ? investmentsTotal : totalInvested)}</Amount>
          </div>
          <div className="text-white/50 mt-2 text-[15px]">
            {hasRealBalance
              ? `${investments!.length} posições · saldo reportado pela instituição`
              : `${all.length} movimentações`}
          </div>
        </div>
      </BlueHeader>

      <div className="px-4 mt-5 space-y-4">
        {error && <ErrorCard message={error} />}
        {hasRealBalance && (
          <Card className="rise">
            <div className="text-sm font-semibold text-ink-dim mb-3">
              Posições
            </div>
            <div className="divide-y divide-black/5">
              {investments!.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0 pr-3">
                    <div className="text-[15px] truncate">{inv.name ?? inv.type ?? "Posição"}</div>
                    <div className="text-[13px] text-ink-dim">{inv.type ?? "-"}</div>
                  </div>
                  <div className="text-[15px] font-medium shrink-0">
                    <Amount>{brl0(Number(inv.balance ?? 0))}</Amount>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        {!byMonth ? (
          <LoadingCard />
        ) : all.length === 0 ? (
          <EmptyState text="Nenhuma movimentação de investimento encontrada." />
        ) : (
          <div className="rise space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
            <div className="lg:col-span-2">
              <ValueBars data={monthly} height={230} positiveColor="#0ea5e9" />
            </div>
            <Card className="lg:col-span-1">
              <div className="text-sm font-semibold text-ink-dim mb-3">
                Movimentações
              </div>
              <TxList transactions={all.slice(0, 30)} />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

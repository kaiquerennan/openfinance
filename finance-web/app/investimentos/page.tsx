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
import PageHeader from "@/components/Header";
import TxList from "@/components/TxList";
import { ValueBars } from "@/components/Charts";
import {
  Amount,
  Card,
  CardHeader,
  EmptyState,
  ErrorCard,
  ListRow,
  LoadingCard,
  Money,
  PageHero,
} from "@/components/ui";

/** Tipos de posição como o Open Finance devolve → como se fala. */
const POSITION_TYPE: Record<string, string> = {
  FIXED_INCOME: "Renda fixa",
  MUTUAL_FUND: "Fundo de investimento",
  EQUITY: "Ações",
  ETF: "ETF",
  COE: "COE",
  SECURITY: "Previdência",
};

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
      <PageHeader title="Investimentos" back>
        <PageHero
          label={hasRealBalance ? "Saldo investido" : "Aportes em 12 meses"}
          value={<Amount>{brl0(hasRealBalance ? investmentsTotal : totalInvested)}</Amount>}
          hint={
            hasRealBalance
              ? `${investments!.length} ${
                  investments!.length === 1 ? "posição" : "posições"
                } · saldo informado pela instituição`
              : byMonth
                ? `${all.length} movimentações`
                : undefined
          }
        />
      </PageHeader>

      <div className="px-4 mt-5 space-y-4">
        {error && <ErrorCard message={error} />}
        {hasRealBalance && (
          <Card className="rise lg:max-w-3xl">
            <CardHeader title="Posições" />
            <div className="divide-y divide-edge">
              {investments!.map((inv) => (
                <ListRow
                  key={inv.id}
                  icon="📈"
                  title={inv.name ?? inv.type ?? "Posição"}
                  subtitle={
                    inv.subtype === "CONTA_REMUNERADA"
                      ? "Conta remunerada"
                      : inv.type
                        ? POSITION_TYPE[inv.type] ?? inv.type
                        : undefined
                  }
                  right={
                    <Money value={Number(inv.balance ?? 0)} cents={false} className="text-[16px]" />
                  }
                />
              ))}
            </div>
          </Card>
        )}
        {!byMonth ? (
          !error && <LoadingCard />
        ) : all.length === 0 ? (
          !hasRealBalance && (
            <EmptyState icon="📈" text="Nenhuma movimentação de investimento encontrada." />
          )
        ) : (
          <div className="rise space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
            <Card className="lg:col-span-2">
              <CardHeader title="Aportes por mês" />
              <ValueBars data={monthly} height={220} positiveColor="#0ea5e9" />
            </Card>
            <Card className="lg:col-span-1">
              <CardHeader title="Movimentações" />
              <div className="mt-2">
                <TxList transactions={all.slice(0, 30)} />
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

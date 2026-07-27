"use client";

// Projeção: saldo projetado pros próximos meses, assumindo que a média de
// poupança dos últimos 3 meses (já calculada no backend, mesmo número da
// dica "mantendo o ritmo atual...") se mantém constante.

import { useEffect, useMemo, useState } from "react";
import {
  AnalyticsReport,
  api,
  brl,
  brl0,
  currentMonth,
  DbAccount,
  addMonths,
  monthLabel,
} from "@/lib/api";
import { useDataVersion } from "@/lib/bus";
import BlueHeader from "@/components/Header";
import { ProjectionChart } from "@/components/Charts";
import { Amount, Card, ErrorCard, LoadingCard, TipCarousel } from "@/components/ui";

const MONTHS_AHEAD = 6;

export default function ProjecaoPage() {
  const version = useDataVersion();
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [accounts, setAccounts] = useState<DbAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const month = currentMonth();

  useEffect(() => {
    Promise.all([api.report(month), api.accounts()])
      .then(([r, accs]) => {
        setReport(r);
        setAccounts(accs);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const saldoInicial = useMemo(
    () =>
      (accounts ?? [])
        .filter((a) => a.type === "BANK")
        .reduce((s, a) => s + Number(a.balance ?? 0), 0),
    [accounts],
  );

  const monthlyRate = useMemo(() => {
    const t3 = report?.data.trends.find((t) => t.window === "3m");
    return t3 ? t3.savings / 3 : 0;
  }, [report]);

  const currentResult = report ? report.data.summary.income - report.data.summary.consumption : 0;

  const points = useMemo(() => {
    const list: { label: string; resultado: number; saldo: number }[] = [];
    let saldo = saldoInicial;
    for (let i = 0; i < MONTHS_AHEAD; i++) {
      const resultado = i === 0 ? currentResult : monthlyRate;
      saldo += resultado;
      list.push({
        label: monthLabel(addMonths(month, i)).slice(0, 3),
        resultado,
        saldo,
      });
    }
    return list;
  }, [saldoInicial, currentResult, monthlyRate, month]);

  const saldoFinal = points[points.length - 1]?.saldo ?? saldoInicial;
  const delta = saldoFinal - saldoInicial;

  const loading = !report || !accounts;

  return (
    <div>
      <BlueHeader title="Projeção">
        <div className="mt-4">
          <div className="text-ink-dim text-[15px]">SALDO PROJETADO</div>
          <div className="flex items-center gap-3 mt-1">
            <div className="text-4xl font-semibold">
              <Amount>{brl0(saldoFinal)}</Amount>
            </div>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                delta >= 0 ? "bg-pos/15 text-pos" : "bg-neg/15 text-neg"
              }`}
            >
              {delta >= 0 ? "▲" : "▼"} <Amount>{brl0(Math.abs(delta))}</Amount> no período
            </span>
          </div>
        </div>
      </BlueHeader>

      <div className="px-4 mt-5 space-y-4">
        {error && <ErrorCard message={error} />}
        {loading ? (
          <LoadingCard text="Calculando projeção…" />
        ) : (
          <div className="rise space-y-4">
            <TipCarousel
              tips={[
                ...(report?.narrative.previsoes ?? []),
                ...(report?.narrative.oportunidades ?? []),
              ]}
            />

            <Card>
              <ProjectionChart points={points} />
            </Card>

            <Card className="divide-y divide-edge">
              {points.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-[15px] font-semibold text-ink">
                      {monthLabel(addMonths(month, i))}
                    </div>
                    <div className="text-xs text-ink-dim">
                      Resultado do mês:{" "}
                      <Amount>{`${p.resultado < 0 ? "-" : "+"}${brl(Math.abs(p.resultado))}`}</Amount>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-bold text-ink">
                      <Amount>{brl0(p.saldo)}</Amount>
                    </div>
                    <div className="text-xs text-ink-dim">Saldo projetado</div>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

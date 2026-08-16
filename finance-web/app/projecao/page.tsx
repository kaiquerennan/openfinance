"use client";

// Projeção: saldo projetado pros próximos meses, assumindo que a média de
// poupança dos últimos 3 meses (já calculada no backend, mesmo número da
// dica "mantendo o ritmo atual...") se mantém constante.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AnalyticsReport,
  api,
  brl,
  brl0,
  currentMonth,
  DbAccount,
  InstallmentsOverview,
  addMonths,
  monthLabel,
} from "@/lib/api";
import { useDataVersion } from "@/lib/bus";
import BlueHeader from "@/components/Header";
import { ProjectionChart } from "@/components/Charts";
import MonthOutlookCard from "@/components/MonthOutlookCard";
import CompoundSimulator from "@/components/CompoundSimulator";
import { Amount, Card, ErrorCard, LoadingCard, TipCarousel } from "@/components/ui";

const MONTHS_AHEAD = 6;

export default function ProjecaoPage() {
  const version = useDataVersion();
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [accounts, setAccounts] = useState<DbAccount[] | null>(null);
  const [parcelas, setParcelas] = useState<InstallmentsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const month = currentMonth();

  useEffect(() => {
    Promise.all([api.report(month), api.accounts()])
      .then(([r, accs]) => {
        setReport(r);
        setAccounts(accs);
      })
      .catch((e) => setError(e.message));
    // Parcela já contratada é a única parte do futuro que não é estimativa;
    // se falhar, a projeção continua — só perde essa camada.
    api.installments(MONTHS_AHEAD).then(setParcelas).catch(() => {});
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
                ...(report?.narrative.fimDoMes ?? []),
                ...(report?.narrative.previsoes ?? []),
                ...(report?.narrative.oportunidades ?? []),
              ]}
            />

            <MonthOutlookCard outlook={report?.data.outlook} />

            <CompoundSimulator habits={report?.data.habits} />

            <Card>
              <ProjectionChart points={points} />
            </Card>

            {parcelas && parcelas.committedTotal > 0 && (
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-semibold text-ink">
                      Já comprometido em parcelas
                    </div>
                    <p className="text-xs text-ink-dim mt-1 max-w-xs">
                      Compras que já foram feitas e vão ser cobradas nos próximos meses
                      {parcelas.freeFrom ? `, até ${monthLabel(parcelas.freeFrom)}` : ""}.
                    </p>
                  </div>
                  <Link
                    href="/parcelas"
                    className="text-right shrink-0 text-xl font-bold text-ink"
                  >
                    <Amount>{brl0(parcelas.committedTotal)}</Amount>
                    <div className="text-xs font-semibold text-accent">ver detalhe</div>
                  </Link>
                </div>
              </Card>
            )}

            <Card className="divide-y divide-edge">
              {points.map((p, i) => {
                const mes = addMonths(month, i);
                const parcela = parcelas?.monthly.find((m) => m.month === mes);
                return (
                <div key={i} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-[15px] font-semibold text-ink">
                      {monthLabel(mes)}
                    </div>
                    <div className="text-xs text-ink-dim">
                      Resultado do mês:{" "}
                      <Amount>{`${p.resultado < 0 ? "-" : "+"}${brl(Math.abs(p.resultado))}`}</Amount>
                    </div>
                    {parcela && parcela.amount > 0 && (
                      <div className="text-xs text-ink-faint mt-0.5">
                        Inclui <Amount>{brl(parcela.amount)}</Amount> de parcelas já
                        contratadas
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-bold text-ink">
                      <Amount>{brl0(p.saldo)}</Amount>
                    </div>
                    <div className="text-xs text-ink-dim">Saldo projetado</div>
                  </div>
                </div>
                );
              })}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

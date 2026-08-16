"use client";

// Gastos recentes muito acima do padrão do próprio histórico. Um valor alto
// só quer dizer alguma coisa comparado com o que a pessoa costuma gastar
// naquele lugar — e é o tipo de cobrança que ainda dá tempo de contestar.

import { Anomaly, brl } from "@/lib/api";
import { Amount, Card } from "@/components/ui";

export default function AnomalyCard({ anomalies }: { anomalies: Anomaly[] }) {
  if (!anomalies.length) return null;

  return (
    <Card className="border border-amber/30">
      <div className="flex items-center gap-2">
        <span className="text-lg">⚠️</span>
        <h2 className="text-[15px] font-bold text-ink">Gastos fora do padrão</h2>
      </div>
      <div className="mt-3 space-y-3">
        {anomalies.map((a) => (
          <div key={a.transactionId}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex-1 min-w-0 truncate text-[15px] font-medium text-ink">
                {a.description}
              </span>
              <span className="text-[15px] font-bold text-ink shrink-0">
                <Amount>{brl(a.amount)}</Amount>
              </span>
            </div>
            <div className="text-xs text-ink-dim mt-0.5">
              {a.reason === "merchant" ? (
                <>
                  {a.times}x o de sempre nesse lugar (<Amount>{brl(a.typical)}</Amount>)
                </>
              ) : (
                <>
                  Suas compras raramente passam de <Amount>{brl(a.typical)}</Amount>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

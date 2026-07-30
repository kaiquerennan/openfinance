"use client";

// "Eu chego no dia 30?" — saldo projetado dia a dia até o fim do mês, com o
// ritmo de gasto atual e as contas fixas que ainda faltam cair.

import { brl0, MonthOutlook } from "@/lib/api";
import { Amount, Card, CardHeader } from "@/components/ui";
import { useHideValues, maskAmount } from "@/lib/privacy";

function Curve({ outlook }: { outlook: MonthOutlook }) {
  const { projected, today, daysInMonth, negativeFromDay } = outlook;
  const W = 320;
  const H = 90;

  const max = Math.max(...projected, 0);
  const min = Math.min(...projected, 0);
  const span = max - min || 1;

  const x = (i: number) =>
    projected.length > 1 ? (i / (projected.length - 1)) * W : 0;
  const y = (v: number) => H - ((v - min) / span) * H;

  const points = projected.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const zeroY = y(0);
  const negative = negativeFromDay !== null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* linha do zero, se o saldo chega a cruzá-la */}
      {min < 0 && (
        <line
          x1={0}
          x2={W}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--color-neg)"
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.6}
        />
      )}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={negative ? "var(--color-neg)" : "var(--color-pos)"}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={x(0)}
        cy={y(projected[0])}
        r={4}
        fill={negative ? "var(--color-neg)" : "var(--color-pos)"}
      />
      <text x={2} y={H - 2} fontSize={10} fill="var(--color-ink-faint)">
        dia {today}
      </text>
      <text
        x={W - 2}
        y={H - 2}
        fontSize={10}
        textAnchor="end"
        fill="var(--color-ink-faint)"
      >
        dia {daysInMonth}
      </text>
    </svg>
  );
}

export default function MonthOutlookCard({ outlook }: { outlook?: MonthOutlook | null }) {
  const hide = useHideValues();
  if (!outlook) return null;

  const restantes = outlook.daysInMonth - outlook.today;
  const negativo = outlook.negativeFromDay !== null;
  const limiteDiario = restantes > 0 ? outlook.currentBalance / restantes : 0;

  return (
    <Card>
      <CardHeader title="Até o fim do mês" />

      <div className="flex items-baseline gap-2 mt-1">
        <span
          className={`text-3xl font-semibold ${negativo ? "text-neg" : "text-ink"}`}
        >
          <Amount>{brl0(outlook.endBalance)}</Amount>
        </span>
        <span className="text-ink-dim text-[15px]">saldo projetado</span>
      </div>

      <div className="mt-3">
        <Curve outlook={outlook} />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
        <div>
          <div className="text-ink-dim">Hoje em conta</div>
          <div className="font-semibold text-ink">
            <Amount>{brl0(outlook.currentBalance)}</Amount>
          </div>
        </div>
        <div>
          <div className="text-ink-dim">Ritmo de gasto</div>
          <div className="font-semibold text-ink">
            <Amount>{brl0(outlook.dailyRate)}</Amount>/dia
          </div>
        </div>
      </div>

      {outlook.upcomingFixed.length > 0 && (
        <div className="mt-4 pt-3 border-t border-edge space-y-2">
          <div className="text-xs font-semibold text-ink-faint uppercase tracking-wide">
            Ainda vão cair
          </div>
          {outlook.upcomingFixed.slice(0, 4).map((f) => (
            <div key={f.description} className="flex items-center justify-between">
              <span className="text-sm text-ink-dim truncate">
                dia {f.day} · {f.description}
              </span>
              <span className="text-sm font-semibold text-ink shrink-0">
                <Amount>{brl0(f.amount)}</Amount>
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        className={`text-sm mt-3 leading-relaxed ${negativo ? "text-neg" : "text-ink-dim"}`}
      >
        {negativo ? (
          <>
            Nesse ritmo o saldo fica negativo no dia {outlook.negativeFromDay}. Para
            chegar ao dia {outlook.daysInMonth} no zero, o gasto diário precisa cair
            para {maskAmount(brl0(Math.max(limiteDiario, 0)), hide)}.
          </>
        ) : (
          <>
            Faltam {restantes} {restantes === 1 ? "dia" : "dias"} e o dinheiro em
            conta cobre o ritmo atual.
          </>
        )}
      </div>
    </Card>
  );
}

"use client";

// Gráficos do design mobile: barras-pílula segmentadas, ritmo de gasto vs
// limite (hero da home) e barras de metas.

import React from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { brl, compactBRL } from "@/lib/api";
import { maskAmount, useHideValues } from "@/lib/privacy";

const AXIS = "#a9b0bc";

/* ————— utilidades ————— */

function TipBox({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; fill?: string; color?: string }[];
  label?: string;
}) {
  const hide = useHideValues();
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => (p.value ?? 0) !== 0);
  return (
    <div className="bg-white rounded-2xl shadow-xl px-3.5 py-2.5 text-xs">
      <div className="font-semibold text-ink mb-1">{label}</div>
      {rows.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 text-ink-dim">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: p.fill ?? p.color }}
          />
          {p.name}: <span className="font-semibold text-ink">{maskAmount(brl(p.value ?? 0), hide)}</span>
        </div>
      ))}
    </div>
  );
}

/** Tick de eixo X em até duas linhas ("Ago" / "25"). */
function MonthTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const lines = String(payload?.value ?? "").split("\n");
  return (
    <text x={x} y={y} fill={AXIS} fontSize={12} textAnchor="middle">
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 14 : 14}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

/** Arredonda para um valor "bonito" de eixo (1/2/5 × 10^n). */
function niceCeil(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Segmento pílula com folga de 3px entre camadas empilhadas. */
function PillSeg(props: unknown) {
  const { x, y, width, height, fill } = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
  };
  if (!height || Math.abs(height) < 0.5) return <g />;
  const top = height >= 0 ? y : y + height;
  const h = Math.max(Math.abs(height) - 3, 2.5);
  const r = Math.min(6, width / 2, h / 2);
  return <rect x={x} y={top + 1.5} width={width} height={h} rx={r} fill={fill} />;
}

export interface StackSeries {
  key: string;
  label: string;
  color: string;
}

/** Barras empilhadas em pílulas (Gastos por categoria, Recorrentes…). */
export function SegBars({
  data,
  series,
  height = 250,
}: {
  data: ({ name: string } & Record<string, number | string>)[];
  series: StackSeries[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barCategoryGap="28%" margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <XAxis
          dataKey="name"
          tick={<MonthTick />}
          axisLine={false}
          tickLine={false}
          interval={0}
          height={36}
        />
        <YAxis
          tickFormatter={compactBRL}
          tick={{ fill: AXIS, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={40}
          tickCount={3}
        />
        <Tooltip content={<TipBox />} cursor={{ fill: "rgba(120,130,150,0.08)" }} />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="a"
            fill={s.color}
            shape={<PillSeg />}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Barras simples com cor por sinal (fluxo líquido) ou fixa (receitas). */
export function ValueBars({
  data,
  height = 250,
  color,
  positiveColor = "#22c55e",
  negativeColor = "#ef4444",
  symmetric = false,
}: {
  data: { name: string; value: number }[];
  height?: number;
  /** Cor fixa; se omitida, usa positiva/negativa pelo sinal. */
  color?: string;
  positiveColor?: string;
  negativeColor?: string;
  /** Força o eixo simétrico em torno de 0 (fluxo de caixa). */
  symmetric?: boolean;
}) {
  const top = niceCeil(Math.max(...data.map((d) => Math.abs(d.value)), 1));
  const domain: [number, number] = symmetric ? [-top, top] : [0, top];
  const ticks = symmetric ? [-top, 0, top] : [0, top / 2, top];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barCategoryGap="30%" margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <XAxis
          dataKey="name"
          tick={<MonthTick />}
          axisLine={false}
          tickLine={false}
          interval={0}
          height={36}
        />
        <YAxis
          tickFormatter={compactBRL}
          tick={{ fill: AXIS, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={40}
          domain={domain}
          ticks={ticks}
        />
        <Tooltip content={<TipBox />} cursor={{ fill: "rgba(120,130,150,0.08)" }} />
        <Bar dataKey="value" name="Valor" shape={<PillSeg />} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={color ?? (d.value >= 0 ? positiveColor : negativeColor)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Barras largas e bem arredondadas das Metas (planejado × mês atual). */
function GoalShape(props: unknown) {
  const { x, y, width, height: h, payload } = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    payload: { active: boolean };
  };
  if (!h || h <= 0) return <g />;
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={h}
      rx={Math.min(16, width / 2.6)}
      fill={payload.active ? "#f0a818" : "#f3e3b3"}
    />
  );
}

export function GoalBars({
  data,
  height = 300,
}: {
  data: { name: string; value: number; active: boolean }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barCategoryGap="14%" margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <XAxis
          dataKey="name"
          tick={{ fill: "#8a919d", fontSize: 13 }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tickFormatter={(v: number) => `R$ ${compactBRL(v)}`}
          tick={{ fill: AXIS, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={52}
          tickCount={4}
        />
        <Tooltip content={<TipBox />} cursor={{ fill: "rgba(120,130,150,0.08)" }} />
        <Bar dataKey="value" name="Aportes" shape={<GoalShape />} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Hero da home: gasto acumulado (vermelho) vs ritmo do limite (tracejado). */
export function BudgetPace({
  cumulative,
  daysInMonth,
  budget,
}: {
  /** Gasto acumulado por dia, do dia 1 até hoje. */
  cumulative: number[];
  daysInMonth: number;
  budget: number;
}) {
  const hide = useHideValues();
  const W = 360;
  const H = 150;
  const today = cumulative.length;
  const spentNow = cumulative[cumulative.length - 1] ?? 0;
  const max = Math.max(spentNow, budget, 1) * 1.25;

  const xd = (day: number) => ((day - 1) / (daysInMonth - 1)) * W;
  const yv = (v: number) => H - (v / max) * (H - 18);

  const pts = cumulative.map((v, i) => `${xd(i + 1).toFixed(1)},${yv(v).toFixed(1)}`);
  const lastX = xd(today);
  const lastY = yv(spentNow);
  const area = `M ${pts.join(" L ")} L ${lastX.toFixed(1)},${H} L 0,${H} Z`;

  // Diferença vs o ritmo do limite no dia de hoje
  const paceToday = (budget * today) / daysInMonth;
  const diff = spentNow - paceToday;
  const over = diff > 0;

  const badgeLeft = Math.min(Math.max((lastX / W) * 100, 18), 78);
  const badgeTop = Math.max((lastY / H) * 100 - 24, 2);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
        <defs>
          <linearGradient id="paceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b2f8f" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#2b2f8f" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {/* ritmo do limite */}
        <line
          x1={0}
          y1={yv(0)}
          x2={W}
          y2={yv(budget)}
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="2"
          strokeDasharray="6 7"
          strokeLinecap="round"
        />
        {cumulative.length > 1 && (
          <>
            <path d={area} fill="url(#paceFill)" />
            <polyline
              points={pts.join(" ")}
              fill="none"
              stroke="#ff4d67"
              strokeWidth="2.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}
        <circle cx={lastX} cy={lastY} r="7" fill="#fff" />
        <circle cx={lastX} cy={lastY} r="4" fill={over ? "#ff4d67" : "#22c55e"} />
      </svg>
      <div
        className={`absolute -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap ${
          over ? "bg-[#f43f5e]" : "bg-pos"
        }`}
        style={{ left: `${badgeLeft}%`, top: `${badgeTop}%` }}
      >
        {maskAmount(brl(Math.abs(diff)), hide)} {over ? "acima" : "abaixo"}
      </div>
    </div>
  );
}

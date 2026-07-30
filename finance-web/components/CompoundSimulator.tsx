"use client";

// "E se eu cortar X por mês e investir a diferença?" — aos 21 anos o tempo é
// o ativo mais valioso, e ver o efeito composto de um corte pequeno é o
// argumento mais convincente que os dados conseguem dar.

import { useMemo, useState } from "react";
import { brl0, HabitCost } from "@/lib/api";
import { catMeta } from "@/lib/categories";
import { Amount, Card, CardHeader } from "@/components/ui";

const ANOS = [5, 10, 20, 30];

/** Taxa anual usada na simulação (ordem de grandeza de CDI/Selic). */
const TAXA_ANUAL = 0.1;

/**
 * Valor futuro de um aporte mensal constante.
 * A taxa anual é convertida para mensal de forma composta (não dividida por
 * 12), senão o resultado sai otimista demais.
 */
function valorFuturo(mensal: number, anos: number, taxaAnual: number) {
  const i = Math.pow(1 + taxaAnual, 1 / 12) - 1;
  const n = anos * 12;
  if (i === 0) return mensal * n;
  return mensal * ((Math.pow(1 + i, n) - 1) / i);
}

export default function CompoundSimulator({ habits = [] }: { habits?: HabitCost[] }) {
  // Sugestão inicial: metade do maior hábito de estilo de vida — um corte
  // plausível, não uma promessa de cortar tudo.
  const sugestao = habits[0] ? Math.round(habits[0].monthly / 2) : 200;
  const [mensal, setMensal] = useState(sugestao);
  const [anos, setAnos] = useState(10);

  const { futuro, aportado, juros } = useMemo(() => {
    const f = valorFuturo(mensal, anos, TAXA_ANUAL);
    const a = mensal * anos * 12;
    return { futuro: f, aportado: a, juros: f - a };
  }, [mensal, anos]);

  const parteJuros = futuro > 0 ? (juros / futuro) * 100 : 0;

  return (
    <Card>
      <CardHeader title="E se eu investisse essa diferença?" />

      {habits[0] && (
        <p className="text-sm text-ink-dim mb-3 leading-relaxed">
          Você gasta cerca de <Amount>{brl0(habits[0].monthly)}</Amount>/mês com{" "}
          {catMeta(habits[0].category).label.toLowerCase()}. Cortar metade libera{" "}
          <Amount>{brl0(sugestao)}</Amount> por mês.
        </p>
      )}

      <label className="block">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-ink-dim">Guardando por mês</span>
          <span className="font-bold text-ink">
            <Amount>{brl0(mensal)}</Amount>
          </span>
        </div>
        <input
          type="range"
          min={50}
          max={1000}
          step={50}
          value={mensal}
          onChange={(e) => setMensal(Number(e.target.value))}
          className="w-full accent-[var(--color-accent)]"
          aria-label="Valor guardado por mês"
        />
      </label>

      <div className="flex gap-2 mt-4">
        {ANOS.map((a) => (
          <button
            key={a}
            onClick={() => setAnos(a)}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
              a === anos ? "bg-accent text-white" : "bg-soft text-ink-dim"
            }`}
          >
            {a} anos
          </button>
        ))}
      </div>

      <div className="mt-5 text-center">
        <div className="text-sm text-ink-dim">Você teria</div>
        <div className="text-4xl font-semibold text-pos mt-0.5">
          <Amount>{brl0(futuro)}</Amount>
        </div>
        <div className="text-sm text-ink-dim mt-1">
          em {anos} anos, guardando <Amount>{brl0(mensal)}</Amount>/mês
        </div>
      </div>

      <div className="flex h-2.5 rounded-full overflow-hidden mt-4">
        <div
          className="bg-azure-400"
          style={{ width: `${100 - parteJuros}%` }}
        />
        <div className="bg-pos flex-1" />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-2.5 text-sm">
        <div className="flex gap-2.5">
          <span className="w-1 rounded-full bg-azure-400" />
          <div>
            <div className="text-ink-dim">Você depositou</div>
            <div className="font-semibold text-ink">
              <Amount>{brl0(aportado)}</Amount>
            </div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <span className="w-1 rounded-full bg-pos" />
          <div>
            <div className="text-ink-dim">Rendimento</div>
            <div className="font-semibold text-ink">
              <Amount>{brl0(juros)}</Amount>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-ink-faint mt-4 leading-relaxed">
        Simulação a {(TAXA_ANUAL * 100).toFixed(0)}% ao ano, ordem de grandeza do
        CDI. Rendimento passado não garante rendimento futuro, e o valor não
        considera imposto de renda nem inflação.
      </p>
    </Card>
  );
}

"use client";

// Consumo dividido entre custo de viver e escolha. Responde "dá pra cortar
// quanto?" melhor que a lista de 20 categorias da Pluggy.

import { brl0, HabitCost, LifestyleSplit } from "@/lib/api";
import { catMeta } from "@/lib/categories";
import { Amount, Card, CardHeader } from "@/components/ui";

export default function LifestyleCard({
  lifestyle,
  habits = [],
}: {
  lifestyle?: LifestyleSplit;
  habits?: HabitCost[];
}) {
  if (!lifestyle) return null;
  const total = lifestyle.essential + lifestyle.lifestyle;
  if (total <= 0) return null;

  const essentialWidth = (lifestyle.essential / total) * 100;
  const acimaDaRegua =
    lifestyle.lifestylePct !== null && lifestyle.lifestylePct > 30;

  return (
    <Card>
      <CardHeader title="Essencial x estilo de vida" />

      <div className="flex h-3 rounded-full overflow-hidden mt-1">
        <div className="bg-azure-400" style={{ width: `${essentialWidth}%` }} />
        <div className="bg-amber flex-1" />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="flex gap-2.5">
          <span className="w-1 rounded-full bg-azure-400" />
          <div>
            <div className="text-sm text-ink-dim">Essencial</div>
            <div className="text-lg font-bold text-ink">
              <Amount>{brl0(lifestyle.essential)}</Amount>
            </div>
            {lifestyle.essentialPct !== null && (
              <div className="text-xs text-ink-faint">
                {lifestyle.essentialPct}% da renda
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2.5">
          <span className="w-1 rounded-full bg-amber" />
          <div>
            <div className="text-sm text-ink-dim">Estilo de vida</div>
            <div className="text-lg font-bold text-ink">
              <Amount>{brl0(lifestyle.lifestyle)}</Amount>
            </div>
            {lifestyle.lifestylePct !== null && (
              <div className="text-xs text-ink-faint">
                {lifestyle.lifestylePct}% da renda
              </div>
            )}
          </div>
        </div>
      </div>

      {habits.length > 0 && (
        <div className="mt-4 pt-3 border-t border-edge space-y-3">
          <div className="text-xs font-semibold text-ink-faint uppercase tracking-wide">
            Quanto isso custa no ano
          </div>
          {habits.slice(0, 3).map((h) => {
            const meta = catMeta(h.category);
            return (
              <div key={h.category} className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink-dim flex items-center gap-2 min-w-0">
                  <span className="shrink-0">{meta.icon}</span>
                  <span className="truncate">{meta.label}</span>
                </span>
                <span className="text-right shrink-0">
                  <div className="text-sm font-semibold text-ink">
                    <Amount>{brl0(h.annual)}</Amount>/ano
                  </div>
                  {h.inSalaries !== null && (
                    <div className="text-xs text-ink-faint">
                      {h.inSalaries.toFixed(1).replace(".", ",")}{" "}
                      {h.inSalaries < 2 ? "salário seu" : "salários seus"}
                    </div>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-sm text-ink-dim mt-3 leading-relaxed">
        {acimaDaRegua ? (
          <>
            Estilo de vida está acima dos 30% de referência — é a folga mais
            fácil de transformar em poupança.
          </>
        ) : (
          <>
            Referência 50/30/20: metade da renda no essencial, 30% em escolhas e
            20% guardado.
          </>
        )}
      </div>
    </Card>
  );
}

"use client";

// Consumo dividido entre custo de viver e escolha. Responde "dá pra cortar
// quanto?" melhor que a lista de 20 categorias da Pluggy.

import { brl0, LifestyleSplit } from "@/lib/api";
import { catMeta } from "@/lib/categories";
import { Amount, Card, CardHeader } from "@/components/ui";

export default function LifestyleCard({
  lifestyle,
}: {
  lifestyle?: LifestyleSplit;
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

      {lifestyle.topLifestyle.length > 0 && (
        <div className="mt-4 pt-3 border-t border-edge space-y-2">
          <div className="text-xs font-semibold text-ink-faint uppercase tracking-wide">
            Onde estão as escolhas
          </div>
          {lifestyle.topLifestyle.slice(0, 3).map((c) => {
            const meta = catMeta(c.category);
            return (
              <div key={c.category} className="flex items-center justify-between">
                <span className="text-sm text-ink-dim flex items-center gap-2">
                  <span>{meta.icon}</span>
                  {meta.label}
                </span>
                <span className="text-sm font-semibold text-ink">
                  <Amount>{brl0(c.total)}</Amount>
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

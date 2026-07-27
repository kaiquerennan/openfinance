"use client";

// Sheet de insights do consultor (✦) — usado pelo BottomNav (mobile) e pela
// Sidebar (desktop).

import Sheet from "@/components/Sheet";
import { useInsights } from "@/lib/useInsights";
import { IconSparkle } from "@/components/icons";

export default function InsightsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { report, error, insights } = useInsights(open);

  return (
    <Sheet open={open} onClose={onClose} title="Insights ✦">
      {error ? (
        <p className="text-sm text-neg">{error}</p>
      ) : !report ? (
        <p className="text-sm text-ink-dim py-6 text-center">
          Analisando suas finanças…
        </p>
      ) : (
        <div className="space-y-3">
          {insights.slice(0, 10).map((t, i) => (
            <div
              key={i}
              className="flex gap-3 bg-soft rounded-2xl p-4 text-sm text-ink leading-relaxed"
            >
              <span className="text-accent shrink-0 mt-0.5">
                <IconSparkle size={16} />
              </span>
              {t}
            </div>
          ))}
          {insights.length === 0 && (
            <p className="text-sm text-ink-dim">Sem insights para este mês.</p>
          )}
        </div>
      )}
    </Sheet>
  );
}

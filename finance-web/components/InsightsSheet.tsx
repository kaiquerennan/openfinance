"use client";

// Sheet de insights do consultor (✦) — usado pelo BottomNav (mobile) e pela
// Sidebar (desktop). Tem os insights automáticos (regras) e uma caixa pra
// perguntar qualquer coisa sobre os dados do mês (Gemini).

import { useState } from "react";
import Sheet from "@/components/Sheet";
import { useInsights } from "@/lib/useInsights";
import { api } from "@/lib/api";
import { inputCls, PrimaryButton } from "@/components/ui";
import { IconSparkle } from "@/components/icons";

interface QA {
  question: string;
  answer: string;
}

export default function InsightsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { report, error, insights } = useInsights(open);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<QA[]>([]);

  async function ask() {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setAskError(null);
    try {
      const { answer } = await api.askAssistant(q);
      setConversation((prev) => [...prev, { question: q, answer }]);
      setQuestion("");
    } catch (e) {
      setAskError((e as Error).message);
    } finally {
      setAsking(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Insights ✦">
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder="Pergunte algo sobre seus gastos…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
          />
          <div className="shrink-0">
            <PrimaryButton onClick={ask} disabled={asking || !question.trim()}>
              {asking ? "…" : "Perguntar"}
            </PrimaryButton>
          </div>
        </div>
        {askError && <p className="text-xs text-neg">{askError}</p>}

        {conversation.length > 0 && (
          <div className="space-y-3">
            {conversation.map((qa, i) => (
              <div key={i} className="space-y-1.5">
                <div className="text-sm font-semibold text-ink-dim">
                  {qa.question}
                </div>
                <div className="bg-soft rounded-2xl p-4 text-sm text-ink leading-relaxed whitespace-pre-wrap">
                  {qa.answer}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-1 border-t border-edge">
          <div className="text-xs font-semibold text-ink-faint uppercase tracking-wide mt-3 mb-2">
            Insights automáticos
          </div>
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
        </div>
      </div>
    </Sheet>
  );
}

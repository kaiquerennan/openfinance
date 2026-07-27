"use client";

// Chat "Visor BETA": pergunta livre pro Gemini (com contexto financeiro) +
// sugestões rápidas + insights automáticos (regras) como mensagens iniciais.

import { useEffect, useRef, useState } from "react";
import { useInsights } from "@/lib/useInsights";
import { api } from "@/lib/api";
import {
  IconChat,
  IconMic,
  IconPlus,
  IconSend,
  IconSparkle,
  IconTrash,
  IconX,
} from "@/components/icons";

interface QA {
  question: string;
  answer: string;
}

const SUGGESTIONS = [
  { text: "Posso jantar fora esse mês?", icon: <IconMic size={14} /> },
  { text: "Me ajude a planejar uma viagem", icon: <IconMic size={14} /> },
  { text: "Me ajude a planejar uma compra grande", icon: <IconMic size={14} /> },
  { text: "Quanto vou gastar em assinaturas esse ano?", icon: <IconChat size={14} /> },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function InsightsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { report, insights } = useInsights(open);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<QA[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation, asking]);

  async function ask(text?: string) {
    const q = (text ?? question).trim();
    if (!q || asking) return;
    setAsking(true);
    setAskError(null);
    setQuestion("");
    try {
      const { answer } = await api.askAssistant(q);
      setConversation((prev) => [...prev, { question: q, answer }]);
    } catch (e) {
      setAskError((e as Error).message);
    } finally {
      setAsking(false);
    }
  }

  if (!open) return null;

  const empty = conversation.length === 0;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70 fade-in" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md">
        <div className="sheet-up bg-base rounded-t-[2rem] h-[92dvh] flex flex-col overflow-hidden border border-edge">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-edge shrink-0">
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg bg-accent grid place-items-center text-white">
                <IconSparkle size={15} />
              </span>
              <span className="font-bold text-ink">Visor</span>
              <span className="text-[10px] font-bold tracking-wide text-accent bg-accent/15 rounded-full px-2 py-0.5">
                BETA
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                aria-label="Nova conversa"
                onClick={() => setConversation([])}
                className="h-9 w-9 rounded-full grid place-items-center text-ink-dim bg-soft"
              >
                <IconChat size={16} />
              </button>
              <button
                aria-label="Limpar conversa"
                onClick={() => setConversation([])}
                className="h-9 w-9 rounded-full grid place-items-center text-ink-dim bg-soft"
              >
                <IconTrash size={16} />
              </button>
              <button
                aria-label="Fechar"
                onClick={onClose}
                className="h-9 w-9 rounded-full grid place-items-center text-ink-dim bg-soft"
              >
                <IconX size={16} />
              </button>
            </div>
          </div>

          {/* Corpo */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
            {empty ? (
              <div className="flex flex-col items-center text-center pt-8">
                <span className="h-16 w-16 rounded-3xl bg-accent grid place-items-center text-white mb-5">
                  <IconSparkle size={28} />
                </span>
                <p className="text-xl text-ink-dim">
                  {greeting()}, <b className="text-ink font-semibold">Kaique</b>. Como o
                  Visor pode te ajudar hoje?
                </p>

                <div className="w-full space-y-2.5 mt-8">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.text}
                      onClick={() => ask(s.text)}
                      className="w-full flex items-center gap-3 bg-soft rounded-full px-4 py-3 text-left text-sm font-medium text-ink"
                    >
                      <span className="text-ink-faint shrink-0">{s.icon}</span>
                      {s.text}
                    </button>
                  ))}
                </div>

                {!report ? (
                  <p className="text-sm text-ink-faint mt-8">Analisando suas finanças…</p>
                ) : insights.length > 0 ? (
                  <div className="w-full text-left mt-8">
                    <div className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">
                      Insights automáticos
                    </div>
                    <div className="space-y-2.5">
                      {insights.slice(0, 5).map((t, i) => (
                        <div
                          key={i}
                          className="flex gap-3 bg-soft rounded-2xl p-4 text-sm text-ink-dim leading-relaxed"
                        >
                          <span className="text-accent shrink-0 mt-0.5">
                            <IconSparkle size={14} />
                          </span>
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-5">
                {conversation.map((qa, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-end">
                      <div className="bg-accent text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm max-w-[85%]">
                        {qa.question}
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-soft text-ink rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap max-w-[85%]">
                        {qa.answer}
                      </div>
                    </div>
                  </div>
                ))}
                {asking && (
                  <div className="flex justify-start">
                    <div className="bg-soft text-ink-dim rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
                      Pensando…
                    </div>
                  </div>
                )}
              </div>
            )}
            {askError && <p className="text-xs text-neg mt-3">{askError}</p>}
          </div>

          {/* Input */}
          <div className="shrink-0 px-4 pt-2 pb-4 border-t border-edge">
            <div className="flex items-center gap-2 bg-soft rounded-3xl px-2 py-2">
              <button
                aria-label="Anexar"
                className="h-9 w-9 rounded-full grid place-items-center text-ink-faint shrink-0"
              >
                <IconPlus size={16} />
              </button>
              <input
                className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-ink-faint"
                placeholder="Digite a sua pergunta"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask()}
              />
              <button
                aria-label="Enviar"
                onClick={() => ask()}
                disabled={asking || !question.trim()}
                className="h-9 w-9 rounded-full grid place-items-center bg-accent text-white shrink-0 disabled:opacity-40"
              >
                <IconSend size={15} />
              </button>
            </div>
            <p className="text-center text-[11px] text-ink-faint mt-2.5">
              O Visor pode cometer erros, confira os valores.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

// Busca o relatório de análises só quando o sheet de insights é aberto, e
// monta a lista de textos exibidos. Compartilhado entre BottomNav (mobile)
// e Sidebar (desktop).

import { useEffect, useState } from "react";
import { api, AnalyticsReport } from "@/lib/api";

export function useInsights(open: boolean) {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || report) return;
    api.report().then(setReport).catch((e) => setError(e.message));
  }, [open, report]);

  const insights = report
    ? [
        ...report.narrative.avisos,
        ...report.narrative.insightsAutomaticos,
        ...report.narrative.alertas,
        ...report.narrative.oportunidades,
        ...report.narrative.recomendacoes,
      ]
    : [];

  return { report, error, insights };
}

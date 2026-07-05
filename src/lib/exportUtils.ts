import type { FrictionPoint, AnalysisResult } from "./mockData";
import { categoryLabels, analysisTypeLabels } from "./mockData";

const severityLabels: Record<string, string> = { high: "Critical", med: "Warning", low: "Info" };

export function exportCSV(result: AnalysisResult, points: FrictionPoint[]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [
    ["Title", "Category", "Severity", "Impact", "Description", "Selector", "Fix", "A/B Test", "Hypothesis", "Metric", "Duration", "Duration Rationale"].join(","),
    ...points.map((p) =>
      [
        escape(p.title),
        escape(categoryLabels[p.category] ?? p.category),
        severityLabels[p.severity] ?? p.severity,
        p.impactScore,
        escape(p.description),
        escape(p.selector),
        escape(p.fix),
        escape(p.abTest.testName),
        escape(p.abTest.hypothesis),
        escape(p.abTest.metric),
        escape(p.abTest.duration),
        escape(p.abTest.durationRationale ?? ""),
      ].join(",")
    ),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const domain = new URL(result.url).hostname.replace(/^www\./, "");
  a.download = `genuinecro-${domain}-${result.analysisType}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function copyAsJiraTickets(result: AnalysisResult, points: FrictionPoint[]): string {
  const type = analysisTypeLabels[result.analysisType];
  const header = `GenuineCRO Analysis — ${result.url} (${type})\n${"═".repeat(50)}\n\n`;

  const tickets = points.map((p, i) => {
    const sev = severityLabels[p.severity] ?? p.severity;
    const cat = categoryLabels[p.category] ?? p.category;
    return [
      `── Ticket ${i + 1} ──`,
      `*Summary:* [${sev}] ${p.title}`,
      `*Priority:* ${p.severity === "high" ? "High" : p.severity === "med" ? "Medium" : "Low"}`,
      `*Labels:* ux-friction, ${p.category}, impact-${p.impactScore}`,
      `*Component:* ${cat}`,
      ``,
      `*Description:*`,
      p.description,
      ``,
      `*Element:* {{${p.selector}}}`,
      ``,
      `*Recommended Fix:*`,
      p.fix,
      ``,
      `*A/B Test:* ${p.abTest.testName}`,
      `*Hypothesis:* ${p.abTest.hypothesis}`,
      `*Control:* ${p.abTest.control}`,
      `*Variant:* ${p.abTest.variant}`,
      `*Primary Metric:* ${p.abTest.metric}`,
      `*Duration:* ${p.abTest.duration}`,
      ...(p.abTest.durationRationale ? [`*Why this duration:* ${p.abTest.durationRationale}`] : []),
    ].join("\n");
  });

  return header + tickets.join("\n\n");
}

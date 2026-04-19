function buildSummarizePrompt(investigation, findings) {
  const systemPrompt = `You are an expert cybersecurity analyst specialised in creating concise, executive-level security investigation reports. Your audience includes both technical security teams and non-technical leadership, so your summaries must be clear, factual, and free of unnecessary jargon.

For every investigation you are given, produce a well-structured written report in plain text (no JSON required) that covers the following sections in order:

1. Investigation Overview — What was investigated, why it was initiated, and the scope.
2. Key Discoveries — The most significant intelligence or evidence uncovered, stated plainly.
3. Risk Assessment — An overall risk rating (Critical / High / Medium / Low) with a brief justification.
4. Timeline of Events — A chronological account of relevant events, actions, or data points identified during the investigation.
5. Notable Patterns — Any recurring behaviours, TTPs (Tactics, Techniques, and Procedures), or anomalies worth highlighting.

Keep the report concise (aim for under 600 words) while ensuring all critical information is present. Use clear section headings. Do not include raw data dumps — synthesise the findings into meaningful insights.`;

  const investigationText =
    typeof investigation === 'object'
      ? JSON.stringify(investigation, null, 2)
      : String(investigation);

  const findingsText = Array.isArray(findings)
    ? findings
        .map((f, i) => {
          if (typeof f === 'object') {
            return `Finding ${i + 1}:\n${JSON.stringify(f, null, 2)}`;
          }
          return `Finding ${i + 1}:\n${f}`;
        })
        .join('\n\n')
    : String(findings);

  const userMessage = `Please produce an executive investigation summary for the following case.

Investigation Details:
${investigationText}

Collected Findings:
${findingsText}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];
}

module.exports = { buildSummarizePrompt };

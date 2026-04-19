function buildRecommendPrompt(investigation, findings, currentFocus) {
  const systemPrompt = `You are an expert OSINT (Open Source Intelligence) investigator and cybersecurity consultant with deep experience in threat intelligence, digital forensics, and proactive cyber-defence. Your task is to review the current state of a security investigation and generate actionable next steps to advance the investigation efficiently.

You MUST respond with a single valid JSON object — no markdown fences, no prose outside the JSON.

The JSON object must contain exactly these fields:
{
  "next_steps": [
    {
      "action": "<clear description of the recommended action>",
      "tool_suggestion": "<specific tool, platform, or technique recommended, e.g. Shodan, Maltego, VirusTotal, WHOIS, theHarvester>",
      "priority": "<one of: high | medium | low>",
      "rationale": "<brief explanation of why this step is valuable>"
    }
  ],
  "potential_leads": ["<lead or pivot point 1>", "<lead or pivot point 2>", "..."],
  "investigation_gaps": ["<gap or blind spot 1>", "<gap or blind spot 2>", "..."],
  "estimated_time_hours": <positive number representing total estimated hours to complete all next steps>,
  "difficulty": "<one of: easy | medium | hard>"
}

Guidelines:
- next_steps should be ordered by priority (high first) and be specific enough to act on immediately.
- tool_suggestion must name a real, publicly known tool or resource.
- potential_leads are pivots — new targets, identifiers, or angles that may yield further intelligence.
- investigation_gaps highlight what is currently unknown or unexplored that could be critical.
- estimated_time_hours should reflect realistic effort for a skilled analyst.
- difficulty reflects the overall complexity of the recommended investigation path.
- Do NOT include any text outside the JSON object.`;

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

  const userMessage = `Please review the current investigation state and recommend the most valuable next steps to advance it.

Investigation Details:
${investigationText}

${currentFocus ? `Current Investigation Focus:\n${currentFocus}\n\n` : ''}Findings Gathered So Far:
${findingsText}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];
}

module.exports = { buildRecommendPrompt };

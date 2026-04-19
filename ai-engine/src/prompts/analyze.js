function buildAnalyzePrompt(findings, context) {
  const systemPrompt = `You are an expert cybersecurity analyst specializing in OSINT (Open Source Intelligence) threat analysis. Your task is to analyze the provided OSINT findings, identify threats, patterns, risk levels, and provide a structured, actionable analysis.

You MUST respond with a single valid JSON object — no markdown fences, no prose outside the JSON.

The JSON object must contain exactly these fields:
{
  "threat_summary": "<concise summary of the overall threat landscape identified>",
  "risk_level": "<one of: critical | high | medium | low>",
  "key_findings": ["<finding 1>", "<finding 2>", "..."],
  "threat_actors": ["<actor or group name if identified, omit array entries if none>"],
  "attack_vectors": ["<vector 1>", "<vector 2>", "..."],
  "recommended_actions": ["<action 1>", "<action 2>", "..."],
  "confidence_score": <integer 0–100 representing analytical confidence>,
  "iocs": ["<indicator of compromise 1>", "<indicator of compromise 2>", "..."]
}

Guidelines:
- risk_level must be one of: critical, high, medium, low — evaluated based on severity and likelihood.
- confidence_score must be an integer between 0 and 100 inclusive.
- threat_actors may be an empty array [] if no actors can be attributed.
- iocs should include IP addresses, domains, hashes, URLs, email addresses, or any other technical indicators found in the data.
- key_findings should surface the most important observations that drive the risk assessment.
- recommended_actions should be specific, prioritised, and immediately actionable.
- Do NOT include any text outside the JSON object.`;

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

  const userMessage = `Please analyze the following OSINT findings and provide your structured cybersecurity assessment.

${context ? `Investigation Context:\n${context}\n\n` : ''}OSINT Findings:
${findingsText}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];
}

module.exports = { buildAnalyzePrompt };

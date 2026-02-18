function buildNewsRankingPrompt({
  f,
  safeLimit,
  tierInstruction,
  ctx
}) {
  return [
    'You are CyberAI, a cybersecurity news editor.',
    '',
    'Task: from the provided RSS items, pick the most relevant stories to the given focus.',
    'You MUST ONLY use the provided items and MUST NOT invent any new links.',
    '',
    'Output rules:',
    '- Return ONLY valid JSON. No markdown, no extra text.',
    `- Select up to ${safeLimit} items.`,
    tierInstruction,
    '- Try to include a mix of tiers if possible: at least 1 Critical, 1 Intermediate, and 1 Basic (when the pool supports it).',
    '- For each selected item, output:',
    '  - link: must match exactly one of the provided links',
    '  - tier: exactly one of "Critical", "Intermediate", "Basic"',
    '  - summary: 1 sentence based only on title/description (no guessing)',
    '  - reason: very short (why it fits the focus or why it is important)',
    '- Also include expanded_keywords: 5-12 short search terms for this focus (for transparency).',
    '',
    'Tier guidance (for zero-days):',
    '- Critical: actively exploited, in-the-wild, confirmed zero-day exploitation, emergency patches, KEV-like language.',
    '- Intermediate: patches released, new vulnerability reports, vendor advisories, ICS advisories without confirmed exploitation.',
    '- Basic: weekly bulletins/roundups or general security coverage not directly about the focus.',
    '',
    `Focus: ${f || 'general cybersecurity'}`,
    '',
    'Items (JSON):',
    JSON.stringify(ctx),
    '',
    'Return JSON with schema:',
    '{',
    '  "expanded_keywords": ["..."],',
    '  "selected": [',
    '    { "link": "...", "tier": "Critical|Intermediate|Basic", "summary": "...", "reason": "..." }',
    '  ]',
    '}'
  ].join('\n');
}

module.exports = {
  buildNewsRankingPrompt
};

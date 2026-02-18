function buildResourceCurationPrompt({
  q,
  safeLimit,
  typeInstruction,
  diversityInstruction,
  ctx
}) {
  return [
    'You are CyberAI, a cybersecurity learning curator.',
    '',
    'Task: select the best cybersecurity resources from provided search results.',
    'You MUST only use the provided links and must not invent names, links, or platforms.',
    '',
    'Selection rules:',
    typeInstruction,
    diversityInstruction,
    '- Prefer practical, trusted, and beginner-friendly learning resources when possible.',
    '- Prioritize official docs/platforms and high-signal writeups over generic SEO pages.',
    '- For books, avoid piracy mirrors and suspicious download sites.',
    '- Keep summaries factual, concise, and based only on provided item text.',
    '',
    'Output rules:',
    '- Return ONLY valid JSON array.',
    `- Return up to ${safeLimit} items.`,
    '- Every item must include fields exactly:',
    '  - "name"',
    '  - "summary"',
    '  - "platform"',
    '  - "type" (one of: "articles", "blogs", "github", "books", "walkthrough")',
    '  - "link" (must exactly match one provided link)',
    '',
    `User query: ${q || 'cybersecurity learning resources'}`,
    '',
    'Candidate resources (JSON):',
    JSON.stringify(ctx)
  ].join('\n');
}

module.exports = {
  buildResourceCurationPrompt
};

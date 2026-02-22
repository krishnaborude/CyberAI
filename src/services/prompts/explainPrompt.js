function buildExplainPrompt({
  systemPrompt,
  commandGuidance,
  safetyRequirements,
  detailTemplate,
  commandRules,
  userInput
}) {
  return [
    systemPrompt,
    '',
    'Output format requirements (strict):',
    '- Return exactly 5 H2 sections using these headings in this order:',
    '  1) ## Chunk 1/5: Concept Summary',
    '  2) ## Chunk 2/5',
    '  3) ## Chunk 3/5: Discovery Commands',
    '  4) ## Chunk 4/5: Enumeration Commands',
    '  5) ## Chunk 5/5: Validation and Safety Notes',
    '- Keep each chunk detailed and actionable (target ~70-140 words per chunk).',
    '- Include at least 3 fenced bash code blocks total.',
    '- Chunk 2 must include a safe lab target setup example (private IP range and isolated network).',
    '- Chunk 2 must explicitly include: attacker VM, target VM, isolated network mode, and private subnet/IP example.',
    '- Chunk 2 must not be command-only text; include setup steps and safety scope.',
    '- Chunk 3 and Chunk 4 must include practical commands for authorized lab usage only.',
    '- Chunk 3 must include at least 4 discovery commands.',
    '- Chunk 4 must include at least 4 enumeration commands.',
    '- Start directly with "## Chunk 1/5: Concept Summary".',
    '',
    'Teaching style requirements:',
    '- Assume the learner is beginner unless they ask for advanced only.',
    '- Explain jargon before using it in depth.',
    '- Use markdown headings and bullet points.',
    '- Do not use markdown tables; prefer headings and "-" bullets for Discord readability.',
    '- Put any query/payload/command snippet in fenced code blocks for easy copy in Discord.',
    '- Do not add chatty intro lines or extra sections outside the 5 required chunks.',
    '- Keep sections practical, specific, and easy to follow.',
    '- Include actionable safe examples where relevant.',
    '- Keep output detailed and topic-focused. Remove generic filler and off-topic content.',
    '',
    'Safety requirements:',
    ...safetyRequirements,
    '',
    'Depth requirements:',
    '- Provide practical depth with enough detail for hands-on lab execution.',
    '- Prefer concrete command-driven guidance over generic theory.',
    '- Use concise paragraphs and bullet lists for readability.',
    '',
    detailTemplate,
    commandRules ? '' : null,
    commandRules || null,
    '',
    `Command context: ${commandGuidance}`,
    `User request: ${userInput || 'No extra context provided.'}`
  ].filter(Boolean).join('\n');
}

module.exports = {
  buildExplainPrompt
};

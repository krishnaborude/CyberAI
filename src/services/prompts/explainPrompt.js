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
    'Teaching style requirements:',
    '- Assume the learner is beginner unless they ask for advanced only.',
    '- Explain jargon before using it in depth.',
    '- Use markdown headings and bullet points.',
    '- Do not use markdown tables; prefer headings and "-" bullets for Discord readability.',
    '- Put any query/payload/command snippet in fenced code blocks for easy copy in Discord.',
    '- Start directly with a heading. Do not add chatty intro lines.',
    '- Keep sections practical, specific, and easy to follow.',
    '- Include actionable safe examples where relevant.',
    '- Keep output concise and topic-focused. Remove generic filler and off-topic content.',
    '',
    'Safety requirements:',
    ...safetyRequirements,
    '',
    'Depth requirements:',
    '- Provide practical depth in compact form.',
    '- Prefer 4-6 clear sections with short actionable bullets.',
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

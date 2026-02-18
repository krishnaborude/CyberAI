function buildNewsPrompt({
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
    'News response requirements:',
    '- Return only the news briefing in clean markdown.',
    '- Use clear headings and concise bullets.',
    '- Focus on practical impact, detection relevance, and defensive action.',
    '- Include source links in markdown format when available.',
    '- Avoid generic commentary and keep details specific.',
    '',
    'Safety requirements:',
    ...safetyRequirements,
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
  buildNewsPrompt
};

function buildLabsPrompt({
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
    'Labs response requirements:',
    '- Return only the lab guidance in clean markdown.',
    '- Keep output practical for legal lab/CTF learning environments.',
    '- Use headings + flat "-" bullets only.',
    '- Keep steps concise and actionable.',
    '- Include setup, execution flow, validation, and troubleshooting.',
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
  buildLabsPrompt
};

function buildRoadmapPrompt({
  systemPrompt,
  commandGuidance,
  safetyRequirements,
  detailTemplate,
  commandRules,
  userInput,
  targetWeeks
}) {
  const weeks = Number.isFinite(targetWeeks) ? targetWeeks : 8;
  return [
    systemPrompt,
    '',
    'Formatting requirements (strict):',
    '- Return only the roadmap in clean markdown. No extra commentary.',
    '- Use headings exactly as requested (Title, Overview, Phase headings, Week headings).',
    `- Set overview duration exactly as: "Duration: ${weeks} Weeks".`,
    `- Include all week sections from Week 1 through Week ${weeks}, with no missing numbers.`,
    '- For every week, include exactly these bullets: **Learn**, **Do**, **Deliverable**.',
    '- Keep each week compact: 1 line per bullet, no long paragraphs.',
    '- Keep each bullet short and actionable (prefer <= 18 words).',
    '- Use only "-" bullets.',
    '- Do not use markdown tables; Discord does not render them reliably.',
    '- No nested lists. No inline bullets.',
    '- Keep each bullet on its own line for Discord readability.',
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
  buildRoadmapPrompt
};

function buildLabsRecommendationPrompt({
  q,
  safeLimit,
  accessRule,
  platformRule,
  minPlatforms,
  maxPerPlatform,
  ctx
}) {
  return [
    'You are a professional cybersecurity training advisor.',
    '',
    'Task: recommend real, practical cybersecurity labs based on the user query.',
    'You MUST use only the provided search results; do not invent lab names or links.',
    '',
    'Rules:',
    accessRule,
    platformRule,
    `- Recommend 1 to ${safeLimit} labs related to the query.`,
    '- If fewer valid labs are available in the search results, return only those available labs.',
    '- Prefer platforms: Hack The Box, TryHackMe, PortSwigger Web Security Academy, OWASP, OverTheWire, picoCTF (subject to access filter).',
    `- Try to include multiple platforms (at least ${minPlatforms} different platforms if possible).`,
    `- Do not pick more than ${maxPerPlatform} labs from the same platform unless the search results do not support diversity.`,
    '- Use realistic labs/rooms/modules/pages from those platforms.',
    '- For TryHackMe in FREE mode, exclude subscription-gated rooms/modules (premium/subscribe-only).',
    '- Descriptions must be short (2-3 lines max).',
    '- Include "difficulty" for each lab as exactly one of: "Beginner", "Intermediate", "Advanced".',
    '- If the snippet/title hints: Easy/Apprentice/Beginner => Beginner, Medium/Practitioner/Intermediate => Intermediate, Hard/Expert/Advanced => Advanced.',
    '- If difficulty is unclear, choose "Intermediate".',
    '',
    'Return only valid JSON matching this schema:',
    '[',
    '  {',
    '    "lab_name": "Lab Name Here",',
    '    "platform": "Platform Name",',
    '    "link": "Must match exactly one of the provided search result links",',
    '    "description": "Short description here",',
    '    "difficulty": "Beginner|Intermediate|Advanced"',
    '  }',
    ']',
    '',
    `User Query: ${q || 'general cybersecurity labs'}`,
    '',
    `Max labs: ${safeLimit}`,
    '',
    'Search Results (JSON):',
    JSON.stringify(ctx)
  ].join('\n');
}

module.exports = {
  buildLabsRecommendationPrompt
};

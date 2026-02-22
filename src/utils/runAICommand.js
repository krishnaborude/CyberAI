const {
  sanitizeUserInput,
  hasPromptInjection,
  validateUserInput,
  hasAuthorizedScopeEvidence
} = require('./inputGuard');
const { smartSplitMessage } = require('./smartSplitMessage');
const { sendChunkedResponse } = require('./discordResponse');
const { formatResponseByCommand } = require('./formatResponse');

function isGeminiRateLimited(error) {
  const message = error?.message || String(error);
  return /GEMINI_RATE_LIMITED|429|resource exhausted|too many requests|rate limit/i.test(message);
}

function buildExplainSectionChunks(text) {
  const input = typeof text === 'string' ? text.replace(/\r\n/g, '\n').trim() : '';
  if (!input) return null;

  const headingRegex = /(^|\n)\s*(?:#{1,6}\s*)?Chunk\s*([1-5])\s*\/\s*5(?:\s*:\s*([^\n]*))?/gmi;
  const headings = [];
  let match = headingRegex.exec(input);
  while (match) {
    headings.push({
      index: match.index + (match[1] ? match[1].length : 0),
      number: Number.parseInt(match[2], 10),
      title: String(match[3] || '').trim()
    });
    match = headingRegex.exec(input);
  }

  if (headings.length < 5) return null;

  const deduped = [];
  const seen = new Set();
  for (const heading of headings) {
    if (seen.has(heading.number)) continue;
    seen.add(heading.number);
    deduped.push(heading);
  }

  if (deduped.length !== 5) return null;
  for (let i = 1; i <= 5; i += 1) {
    if (!seen.has(i)) return null;
  }

  const defaultTitles = {
    1: 'Concept Summary',
    2: '',
    3: 'Discovery Commands',
    4: 'Enumeration Commands',
    5: 'Validation and Safety Notes'
  };

  const sectionByNumber = new Map();
  for (let i = 0; i < deduped.length; i += 1) {
    const start = deduped[i].index;
    const end = i < deduped.length - 1 ? deduped[i + 1].index : input.length;
    let section = input.slice(start, end).trim();
    section = section.replace(
      /^(?:#{1,6}\s*)?Chunk\s*([1-5])\s*\/\s*5(?:\s*:\s*([^\n]*))?/i,
      (lineMatch, numberRaw, titleRaw) => {
        const number = Number.parseInt(numberRaw, 10);
        const title = number === 2
          ? ''
          : (String(titleRaw || '').trim() || defaultTitles[number] || '');
        return title ? `## Chunk ${number}/5: ${title}` : `## Chunk ${number}/5`;
      }
    );

    if (deduped[i].number === 2) {
      section = section
        .replace(/^##\s*Chunk\s*2\s*\/\s*5(?:\s*:\s*[^\n]*)?\s*\n*/i, '')
        .trim();
    }

    sectionByNumber.set(deduped[i].number, section);
  }

  const ordered = [];
  for (let i = 1; i <= 5; i += 1) {
    const section = sectionByNumber.get(i);
    if (!section) return null;
    ordered.push(section);
  }

  return ordered;
}

function stripExplainChunkHeadings(text) {
  const value = typeof text === 'string' ? text : '';
  return value
    .replace(/(^|\n)\s*(?:#{1,6}\s*)?Chunk\s*[1-5]\s*\/\s*5(?:\s*:\s*[^\n]*)?\s*(?=\n|$)/gmi, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function runAICommand({
  interaction,
  services,
  rateLimiter,
  logger,
  config,
  command,
  input,
  required = false,
  requireAuthorizedScope = false,
  prependText = '',
  appendText = ''
}) {
  const sanitizedInput = sanitizeUserInput(input || '', {
    maxChars: config.limits.maxPromptChars
  });

  const validation = validateUserInput(sanitizedInput, { required });
  if (!validation.valid) {
    await interaction.reply({ content: validation.reason, ephemeral: true });
    return;
  }

  if (hasPromptInjection(sanitizedInput)) {
    await interaction.reply({
      content: 'Your input appears to include unsafe instruction patterns. Please rephrase as a direct cybersecurity learning question.',
      ephemeral: true
    });
    return;
  }

  if (requireAuthorizedScope && !hasAuthorizedScopeEvidence(sanitizedInput)) {
    await interaction.reply({
      content: 'For this command, include explicit authorized scope (e.g., lab, CTF, or approved internal test with permission).',
      ephemeral: true
    });
    return;
  }

  const rate = rateLimiter.check(interaction.user.id);
  if (rate.limited) {
    const retryAfterSec = Math.ceil(rate.retryAfterMs / 1000);
    await interaction.reply({
      content: `Rate limit reached. Please wait ${retryAfterSec}s before sending another request.`,
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply();

  let aiResponse = '';
  try {
    aiResponse = await services.gemini.generateCyberResponse({
      command,
      userInput: sanitizedInput
    });
  } catch (error) {
    if (isGeminiRateLimited(error)) {
      const fallback = [
        prependText,
        '## AI Busy Right Now',
        '- The AI provider hit a temporary rate limit (429 Resource Exhausted).',
        '- Please retry in 30-60 seconds.',
        '- Tip: use a lighter model (for example `gemini-2.5-flash`) or lower request volume.',
        appendText
      ].filter(Boolean).join('\n\n');

      const chunks = smartSplitMessage(fallback, { minChunks: 1, maxChunks: 2 });
      await sendChunkedResponse(interaction, chunks);
      logger.warn('Command served with rate-limit fallback', {
        command,
        userId: interaction.user.id
      });
      return;
    }
    throw error;
  }

  aiResponse = formatResponseByCommand(command, aiResponse);

  const userInputLine = sanitizedInput && command !== 'studyplan'
    ? `**User Input:** ${sanitizedInput}`
    : '';

  const finalResponse = [prependText, userInputLine, aiResponse, appendText]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join('\n\n');

  const explainSections = command === 'explain'
    ? buildExplainSectionChunks(finalResponse)
    : null;

  const chunks = Array.isArray(explainSections) && explainSections.length === 5
    ? explainSections.map((section, index) => {
      const cleanSection = stripExplainChunkHeadings(section);
      const withInput = index === 0 && userInputLine
        ? `${userInputLine}\n\n${cleanSection}`
        : cleanSection;
      return `**\u{1F4D8} CyberAI Response (${index + 1}/5)**\n\n${withInput}`;
    })
    : (() => {
      const explainSafeResponse = command === 'explain'
        ? stripExplainChunkHeadings(finalResponse)
        : finalResponse;
      const minChunks = command === 'explain'
        ? 5
        : (explainSafeResponse.length > 1700 ? 2 : 1);
      const maxChunks = command === 'studyplan' || command === 'quiz'
        ? 5
        : (command === 'explain' ? 5 : 3);
      return smartSplitMessage(explainSafeResponse, { minChunks, maxChunks });
    })();
  await sendChunkedResponse(interaction, chunks);

  logger.info('Command completed', {
    command,
    userId: interaction.user.id,
    chunks: chunks.length
  });
}

module.exports = {
  runAICommand
};

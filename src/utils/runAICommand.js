const { MessageFlags } = require('discord.js');
const {
  sanitizeUserInput,
  hasPromptInjection,
  validateUserInput,
  hasAuthorizedScopeEvidence
} = require('./inputGuard');
const { smartSplitMessage } = require('./smartSplitMessage');
const { sendChunkedResponse } = require('./discordResponse');
const { formatResponseByCommand } = require('./formatResponse');

const EXPLAIN_CHUNK_TITLES = {
  1: 'Concept Summary',
  2: 'Foundational Basics',
  3: 'Core Technical Breakdown',
  4: 'Defensive Use Cases',
  5: 'Safe Basic Commands (Authorized Lab Environments Only)'
};

function isGeminiRateLimited(error) {
  const message = error?.message || String(error);
  return /GEMINI_RATE_LIMITED|429|resource exhausted|too many requests|rate limit/i.test(message);
}

function isLowSignalExplainInput(input) {
  const normalized = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!normalized) return true;

  const cleaned = normalized.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return true;

  const commonShortInputs = new Set([
    'hi',
    'hello',
    'hey',
    'yo',
    'sup',
    'ok',
    'okay',
    'thanks',
    'thank you',
    'test',
    'ping'
  ]);
  if (commonShortInputs.has(cleaned)) return true;

  const cybersecurityKeywords = [
    'xss',
    'csrf',
    'sqli',
    'sql',
    'siem',
    'soc',
    'cve',
    'osint',
    'nmap',
    'burp',
    'metasploit',
    'phishing',
    'malware',
    'firewall',
    'pentest',
    'recon',
    'enumeration',
    'vulnerability',
    'exploit',
    'mitre',
    'owasp'
  ];

  const tokens = cleaned.split(' ').filter(Boolean);
  const hasCyberKeyword = tokens.some((token) => cybersecurityKeywords.includes(token));
  if (hasCyberKeyword) return false;

  if (tokens.length === 1) {
    return tokens[0].length <= 2 || commonShortInputs.has(tokens[0]);
  }

  const conversationalPattern = /^(how are you|what is up|what's up|who are you|good morning|good afternoon|good evening|thank you)$/i;
  if (conversationalPattern.test(cleaned)) return true;

  return false;
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

  const defaultTitles = EXPLAIN_CHUNK_TITLES;

  const sectionByNumber = new Map();
  for (let i = 0; i < deduped.length; i += 1) {
    const start = deduped[i].index;
    const end = i < deduped.length - 1 ? deduped[i + 1].index : input.length;
    let section = input.slice(start, end).trim();
    section = section.replace(
      /^(?:#{1,6}\s*)?Chunk\s*([1-5])\s*\/\s*5(?:\s*:\s*([^\n]*))?/i,
      (lineMatch, numberRaw, titleRaw) => {
        const number = Number.parseInt(numberRaw, 10);
        const title = String(titleRaw || '').trim() || defaultTitles[number] || '';
        return title ? `## Chunk ${number}/5: ${title}` : `## Chunk ${number}/5`;
      }
    );

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

function extractExplainChunkHeadingMeta(text) {
  const input = typeof text === 'string' ? text : '';
  const match = input.match(/^\s*(?:#{1,6}\s*)?Chunk\s*([1-5])\s*\/\s*5(?:\s*:\s*([^\n]*))?/i);
  if (!match) return { number: null, title: '' };

  const number = Number.parseInt(match[1], 10);
  const title = String(match[2] || '').trim() || EXPLAIN_CHUNK_TITLES[number] || '';
  return { number, title };
}

function formatExplainChunkMessage({ index, total, title, body, userInputLine }) {
  const chunkIndex = Number.parseInt(index, 10) || 0;
  const chunkTotal = Number.parseInt(total, 10) || 5;
  const safeTitle = typeof title === 'string' ? title.trim() : '';
  let safeBody = typeof body === 'string' ? body.trim() : '';

  if (safeTitle && safeBody) {
    const lowerTitle = safeTitle.toLowerCase();
    const bodyLines = safeBody.split('\n');
    if ((bodyLines[0] || '').trim().toLowerCase() === lowerTitle) {
      safeBody = bodyLines.slice(1).join('\n').trim();
    }
  }

  const lines = [`\u{1F4D8} **CyberAI Response (${chunkIndex + 1}/${chunkTotal})**`, ''];
  if (chunkIndex === 0 && userInputLine) {
    lines.push(`> ${userInputLine}`, '');
  }
  if (safeTitle) {
    lines.push(`## ${safeTitle}`, '');
  }
  if (safeBody) {
    lines.push(safeBody);
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function buildExplainChunkMessages({ sections, userInputLine }) {
  const list = Array.isArray(sections) ? sections : [];
  const total = list.length || 5;

  return list.map((section, index) => {
    const { number, title } = extractExplainChunkHeadingMeta(section);
    const defaultTitle = EXPLAIN_CHUNK_TITLES[index + 1] || '';
    const cleanSection = stripExplainChunkHeadings(section);
    return formatExplainChunkMessage({
      index,
      total,
      title: title || EXPLAIN_CHUNK_TITLES[number] || defaultTitle,
      body: cleanSection,
      userInputLine
    });
  });
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
    await interaction.reply({ content: validation.reason, flags: MessageFlags.Ephemeral });
    return;
  }

  if (command === 'explain' && isLowSignalExplainInput(sanitizedInput)) {
    await interaction.reply({
      content: [
        'Hello 👋 I\'m CyberCortex, your ethical cybersecurity assistant. What would you like to explore today?',
        'Share a cybersecurity concept with `/explain`.',
        'Examples: `XSS`, `SQL injection`, `SIEM alert triage`.'
      ].join('\n'),
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (hasPromptInjection(sanitizedInput)) {
    await interaction.reply({
      content: 'Your input appears to include unsafe instruction patterns. Please rephrase as a direct cybersecurity learning question.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (requireAuthorizedScope && !hasAuthorizedScopeEvidence(sanitizedInput)) {
    await interaction.reply({
      content: 'For this command, include explicit authorized scope (e.g., lab, CTF, or approved internal test with permission).',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const rate = rateLimiter.check(interaction.user.id);
  if (rate.limited) {
    const retryAfterSec = Math.ceil(rate.retryAfterMs / 1000);
    await interaction.reply({
      content: `Rate limit reached. Please wait ${retryAfterSec}s before sending another request.`,
      flags: MessageFlags.Ephemeral
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
    ? (
      command === 'explain'
        ? `**User Input:** \`/explain concept:${sanitizedInput}\``
        : `**User Input:** ${sanitizedInput}`
    )
    : '';

  const finalResponse = [
    prependText,
    command === 'explain' ? '' : userInputLine,
    aiResponse,
    appendText
  ]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join('\n\n');

  const explainSections = command === 'explain'
    ? buildExplainSectionChunks(finalResponse)
    : null;

  let chunks;
  if (Array.isArray(explainSections) && explainSections.length === 5) {
    chunks = buildExplainChunkMessages({
      sections: explainSections,
      userInputLine
    });
  } else {
    const explainSafeResponse = command === 'explain'
      ? stripExplainChunkHeadings(finalResponse)
      : finalResponse;
    const minChunks = command === 'explain'
      ? 5
      : (explainSafeResponse.length > 1700 ? 2 : 1);
    const maxChunks = command === 'studyplan' || command === 'quiz'
      ? 5
      : (command === 'explain' ? 5 : 3);
    const splitChunks = smartSplitMessage(explainSafeResponse, {
      minChunks,
      maxChunks,
      addPageHeader: command !== 'explain'
    });

    chunks = command === 'explain'
      ? splitChunks.map((chunk, index) => formatExplainChunkMessage({
        index,
        total: splitChunks.length,
        title: EXPLAIN_CHUNK_TITLES[index + 1] || '',
        body: chunk,
        userInputLine
      }))
      : splitChunks;
  }
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

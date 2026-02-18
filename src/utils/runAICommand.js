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

  const userInputLine = sanitizedInput ? `**User Input:** ${sanitizedInput}` : '';

  const finalResponse = [prependText, userInputLine, aiResponse, appendText]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join('\n\n');

  const minChunks = finalResponse.length > 1700 ? 2 : 1;
  const chunks = smartSplitMessage(finalResponse, { minChunks, maxChunks: 3 });
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

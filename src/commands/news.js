const { SlashCommandBuilder } = require('discord.js');
const { sanitizeUserInput, hasPromptInjection, validateUserInput } = require('../utils/inputGuard');
const { smartSplitMessage } = require('../utils/smartSplitMessage');
const { sendChunkedResponse } = require('../utils/discordResponse');
const { MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('news')
    .setDescription('Get live cybersecurity news with source links')
    .addStringOption((option) =>
      option
        .setName('focus')
        .setDescription('Focus area (threat intel, ransomware, cloud, zero-days)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('tier')
        .setDescription('Show only one tier (optional)')
        .addChoices(
          { name: 'All', value: 'all' },
          { name: 'Critical only', value: 'critical' },
          { name: 'Intermediate only', value: 'intermediate' },
          { name: 'Basic only', value: 'basic' }
        )
        .setRequired(false)
    ),

  async execute(ctx) {
    const rawFocus = ctx.interaction.options.getString('focus', true);
    const focus = sanitizeUserInput(rawFocus, { maxChars: 120 });
    const tier = (ctx.interaction.options.getString('tier') || 'all').toLowerCase();

    const validation = validateUserInput(focus, { required: false });
    if (!validation.valid) {
      await ctx.interaction.reply({ content: validation.reason, flags: MessageFlags.Ephemeral });
      return;
    }

    if (hasPromptInjection(focus)) {
      await ctx.interaction.reply({
        content: 'Unsafe input pattern detected. Please provide a normal news topic.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const rate = ctx.rateLimiter.check(ctx.interaction.user.id);
    if (rate.limited) {
      const retryAfterSec = Math.ceil(rate.retryAfterMs / 1000);
      await ctx.interaction.reply({
        content: `Rate limit reached. Please wait ${retryAfterSec}s before sending another request.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await ctx.interaction.deferReply();

    // Fetch a larger pool from RSS, then let Gemini select + tier the final items (with heuristic fallback).
    const seed = await ctx.services.news.getLatestNews({ focus, limit: 24 });
    const newsData = await ctx.services.news.selectAndEnrich({ ...seed, limit: 7, tier });
    const body = ctx.services.news.formatDigest(newsData);
    const response = [`**User Input:** ${focus}`, '', body]
      .filter(Boolean)
      .join('\n');
    const chunks = smartSplitMessage(response);

    await sendChunkedResponse(ctx.interaction, chunks);

    ctx.logger.info('News command completed', {
      userId: ctx.interaction.user.id,
      focus,
      tier,
      articles: newsData.articles.length,
      chunks: chunks.length
    });
  }
};

const { SlashCommandBuilder } = require('discord.js');
const { sanitizeUserInput, hasPromptInjection, validateUserInput } = require('../utils/inputGuard');
const { smartSplitMessage } = require('../utils/smartSplitMessage');
const { sendChunkedResponse } = require('../utils/discordResponse');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('news')
    .setDescription('Get live cybersecurity news with source links')
    .addStringOption((option) =>
      option
        .setName('focus')
        .setDescription('Focus area (threat intel, ransomware, cloud, zero-days)')
        .setRequired(false)
    ),

  async execute(ctx) {
    const rawFocus = ctx.interaction.options.getString('focus') || 'general cybersecurity';
    const focus = sanitizeUserInput(rawFocus, { maxChars: 120 });

    const validation = validateUserInput(focus, { required: false });
    if (!validation.valid) {
      await ctx.interaction.reply({ content: validation.reason, ephemeral: true });
      return;
    }

    if (hasPromptInjection(focus)) {
      await ctx.interaction.reply({
        content: 'Unsafe input pattern detected. Please provide a normal news topic.',
        ephemeral: true
      });
      return;
    }

    const rate = ctx.rateLimiter.check(ctx.interaction.user.id);
    if (rate.limited) {
      const retryAfterSec = Math.ceil(rate.retryAfterMs / 1000);
      await ctx.interaction.reply({
        content: `Rate limit reached. Please wait ${retryAfterSec}s before sending another request.`,
        ephemeral: true
      });
      return;
    }

    await ctx.interaction.deferReply();

    const newsData = await ctx.services.news.getLatestNews({ focus, limit: 7 });
    const response = ctx.services.news.formatDigest(newsData);
    const chunks = smartSplitMessage(response);

    await sendChunkedResponse(ctx.interaction, chunks, { suppressEmbeds: true });

    ctx.logger.info('News command completed', {
      userId: ctx.interaction.user.id,
      focus,
      articles: newsData.articles.length,
      chunks: chunks.length
    });
  }
};

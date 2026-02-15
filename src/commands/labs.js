const { SlashCommandBuilder } = require('discord.js');
const { smartSplitMessage } = require('../utils/smartSplitMessage');
const { sendChunkedResponse } = require('../utils/discordResponse');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('labs')
    .setDescription('Get legal cybersecurity lab links by track and level')
    .addStringOption((option) =>
      option
        .setName('topic')
        .setDescription('Specific topic/tool (e.g., Burp Suite, SQL injection, Wireshark)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('level')
        .setDescription('Skill level')
        .setRequired(false)
        .addChoices(
          { name: 'Beginner', value: 'beginner' },
          { name: 'Intermediate', value: 'intermediate' },
          { name: 'Advanced', value: 'advanced' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('track')
        .setDescription('Track')
        .setRequired(false)
        .addChoices(
          { name: 'General', value: 'general' },
          { name: 'Web', value: 'web' },
          { name: 'Network', value: 'network' },
          { name: 'Cloud', value: 'cloud' },
          { name: 'Forensics', value: 'forensics' },
          { name: 'Detection / SOC', value: 'detection' }
        )
    ),

  async execute(ctx) {
    const topic = ctx.interaction.options.getString('topic') || '';
    const level = ctx.interaction.options.getString('level') || 'beginner';
    const track = ctx.interaction.options.getString('track') || 'general';

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

    let response = '';
    let discovered = false;

    try {
      if (ctx.services.search?.enabled?.()) {
        const data = await ctx.services.labsDiscovery.discover({ track, level, topic, limit: 8 });
        if (Array.isArray(data.links) && data.links.length > 0) {
          response = ctx.services.labsDiscovery.format(data);
          discovered = true;
        } else {
          const linkPayload = ctx.services.labsCatalog.getLinks({ track, level, limit: 8 });
          response = ctx.services.labsCatalog.formatLinksSection(linkPayload);
        }
      } else {
        const linkPayload = ctx.services.labsCatalog.getLinks({ track, level, limit: 8 });
        response = ctx.services.labsCatalog.formatLinksSection(linkPayload);
      }
    } catch (error) {
      ctx.logger.warn('Labs discovery failed, falling back to curated', {
        error: error?.message || String(error)
      });

      const linkPayload = ctx.services.labsCatalog.getLinks({ track, level, limit: 8 });
      response = ctx.services.labsCatalog.formatLinksSection(linkPayload);
    }

    const finalText = response || 'No lab links found for this selection.';
    const chunks = smartSplitMessage(finalText, { minChunks: 1, maxChunks: 2 });

    // Avoid Discord auto-embeds for a cleaner reading experience.
    await sendChunkedResponse(ctx.interaction, chunks, { suppressEmbeds: true });

    ctx.logger.info('Labs command completed', {
      userId: ctx.interaction.user.id,
      topic,
      track,
      level,
      discovered
    });
  }
};

const { SlashCommandBuilder } = require('discord.js');
const { runAICommand } = require('../utils/runAICommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('labs')
    .setDescription('Get legal, hands-on cybersecurity lab ideas and setups')
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
        .setDescription('Track (web, network, cloud, forensics, detection)')
        .setRequired(false)
    ),

  async execute(ctx) {
    const level = ctx.interaction.options.getString('level') || 'beginner';
    const track = ctx.interaction.options.getString('track') || 'general';

    const linkPayload = ctx.services.labsCatalog.getLinks({ track, level, limit: 6 });
    const linksSection = ctx.services.labsCatalog.formatLinksSection(linkPayload);

    await runAICommand({
      interaction: ctx.interaction,
      services: ctx.services,
      rateLimiter: ctx.rateLimiter,
      logger: ctx.logger,
      config: ctx.config,
      command: 'labs',
      input: `Level: ${level}; Track: ${track}`,
      prependText: linksSection
    });
  }
};
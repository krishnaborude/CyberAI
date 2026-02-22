const { SlashCommandBuilder } = require('discord.js');
const { runAICommand } = require('../utils/runAICommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tools')
    .setDescription('Get recommended cybersecurity tools and safe basic commands')
    .addStringOption((option) =>
      option
        .setName('focus')
        .setDescription('Focus area (network, web, blue-team, recon, malware-analysis)')
        .setRequired(true)
    ),

  async execute(ctx) {
    const focus = ctx.interaction.options.getString('focus', true);

    await runAICommand({
      interaction: ctx.interaction,
      services: ctx.services,
      rateLimiter: ctx.rateLimiter,
      logger: ctx.logger,
      config: ctx.config,
      command: 'tools',
      input: focus
    });
  }
};

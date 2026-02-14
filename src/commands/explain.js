const { SlashCommandBuilder } = require('discord.js');
const { runAICommand } = require('../utils/runAICommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('explain')
    .setDescription('Explain a cybersecurity concept in a structured way')
    .addStringOption((option) =>
      option
        .setName('concept')
        .setDescription('Concept to explain (e.g., XSS, SIEM, CVE)')
        .setRequired(true)
    ),

  async execute(ctx) {
    const concept = ctx.interaction.options.getString('concept', true);

    await runAICommand({
      interaction: ctx.interaction,
      services: ctx.services,
      rateLimiter: ctx.rateLimiter,
      logger: ctx.logger,
      config: ctx.config,
      command: 'explain',
      input: concept,
      required: true
    });
  }
};
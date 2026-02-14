const { SlashCommandBuilder } = require('discord.js');
const { runAICommand } = require('../utils/runAICommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roadmap')
    .setDescription('Generate a structured cybersecurity learning roadmap')
    .addStringOption((option) =>
      option
        .setName('goal')
        .setDescription('Your goal (e.g., SOC analyst, bug bounty, pentesting)')
        .setRequired(false)
    ),

  async execute(ctx) {
    const goal = ctx.interaction.options.getString('goal') || 'Beginner to intermediate ethical cybersecurity path';

    await runAICommand({
      interaction: ctx.interaction,
      services: ctx.services,
      rateLimiter: ctx.rateLimiter,
      logger: ctx.logger,
      config: ctx.config,
      command: 'roadmap',
      input: goal
    });
  }
};
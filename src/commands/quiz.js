const { SlashCommandBuilder } = require('discord.js');
const { runAICommand } = require('../utils/runAICommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quiz')
    .setDescription('Generate a cybersecurity quiz for practice')
    .addStringOption((option) =>
      option
        .setName('topic')
        .setDescription('Quiz topic (e.g., OWASP Top 10, networking, Linux security)')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('questions')
        .setDescription('Number of questions (3-10)')
        .setRequired(false)
        .setMinValue(3)
        .setMaxValue(10)
    ),

  async execute(ctx) {
    const topic = ctx.interaction.options.getString('topic') || 'General cybersecurity fundamentals';
    const questions = ctx.interaction.options.getInteger('questions') || 5;

    await runAICommand({
      interaction: ctx.interaction,
      services: ctx.services,
      rateLimiter: ctx.rateLimiter,
      logger: ctx.logger,
      config: ctx.config,
      command: 'quiz',
      input: `Topic: ${topic}; Questions: ${questions}`
    });
  }
};

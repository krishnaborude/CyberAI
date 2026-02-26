const { SlashCommandBuilder } = require('discord.js');
const { runAICommand } = require('../utils/runAICommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('studyplan')
    .setDescription('Generate a structured offensive security certification study plan')
    .addStringOption((option) =>
      option
        .setName('certification')
        .setDescription('Certification name (e.g., OSCP, PNPT, CEH Practical, CRTO)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('experience_level')
        .setDescription('Current experience level')
        .setRequired(true)
        .addChoices(
          { name: 'Beginner', value: 'Beginner' },
          { name: 'Intermediate', value: 'Intermediate' },
          { name: 'Advanced', value: 'Advanced' }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName('hours_per_week')
        .setDescription('Available study time each week')
        .setRequired(true)
        .setMinValue(2)
        .setMaxValue(40)
    )
    .addIntegerOption((option) =>
      option
        .setName('duration_weeks')
        .setDescription('Plan duration in weeks')
        .setRequired(true)
        .setMinValue(4)
        .setMaxValue(24)
    )
    .addStringOption((option) =>
      option
        .setName('focus_area')
        .setDescription('Primary focus area (e.g., web exploitation, AD, red team ops)')
        .setRequired(true)
    ),

  async execute(ctx) {
    const certification = ctx.interaction.options.getString('certification', true);
    const experienceLevel = ctx.interaction.options.getString('experience_level', true);
    const hoursPerWeek = ctx.interaction.options.getInteger('hours_per_week', true);
    const durationWeeks = ctx.interaction.options.getInteger('duration_weeks', true);
    const focusArea = ctx.interaction.options.getString('focus_area', true);

    await runAICommand({
      interaction: ctx.interaction,
      services: ctx.services,
      rateLimiter: ctx.rateLimiter,
      logger: ctx.logger,
      config: ctx.config,
      command: 'studyplan',
      required: true,
      input: [
        `Certification: ${certification}`,
        `Experience Level: ${experienceLevel}`,
        `Hours Per Week: ${hoursPerWeek}`,
        `Duration (Weeks): ${durationWeeks}`,
        `Primary Focus Area: ${focusArea}`,
        'Scope: authorized labs/CTFs/internal approved environments only.'
      ].join('\n')
    });
  }
};

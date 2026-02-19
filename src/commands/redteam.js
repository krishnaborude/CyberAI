const { SlashCommandBuilder } = require('discord.js');
const { runAICommand } = require('../utils/runAICommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('redteam')
    .setDescription('Get operator-grade authorized red-team guidance for labs/CTFs/internal testing')
    .addStringOption((option) =>
      option
        .setName('objective')
        .setDescription('Learning objective (e.g., AD enumeration, web auth testing, privilege escalation)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('scope')
        .setDescription('Authorized scope details (lab/CTF/internal approved assets only)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('level')
        .setDescription('Difficulty level')
        .setRequired(false)
        .addChoices(
          { name: 'Beginner', value: 'beginner' },
          { name: 'Intermediate', value: 'intermediate' },
          { name: 'Advanced', value: 'advanced' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('environment')
        .setDescription('Environment type')
        .setRequired(false)
        .addChoices(
          { name: 'CTF', value: 'ctf' },
          { name: 'Lab VM', value: 'lab_vm' },
          { name: 'TryHackMe', value: 'tryhackme' },
          { name: 'Hack The Box', value: 'hack_the_box' },
          { name: 'Internal Approved Test', value: 'internal_approved' }
        )
    ),

  async execute(ctx) {
    const objective = ctx.interaction.options.getString('objective', true);
    const scope = ctx.interaction.options.getString('scope', true);
    const level = ctx.interaction.options.getString('level') || 'intermediate';
    const environment = ctx.interaction.options.getString('environment') || 'lab_vm';

    await runAICommand({
      interaction: ctx.interaction,
      services: ctx.services,
      rateLimiter: ctx.rateLimiter,
      logger: ctx.logger,
      config: ctx.config,
      command: 'redteam',
      required: true,
      requireAuthorizedScope: true,
      input: [
        `Objective: ${objective}`,
        `Scope: ${scope}`,
        `Level: ${level}`,
        `Environment: ${environment}`,
        'Constraint: authorized assets only, legal testing only.'
      ].join('; ')
    });
  }
};

const { SlashCommandBuilder } = require('discord.js');
const { runAICommand } = require('../utils/runAICommand');

const ROADMAP_GOAL_SUGGESTIONS = [
  'SOC analyst',
  'Bug bounty hunter',
  'Pentesting',
  'Web application security testing',
  'Active Directory penetration testing',
  'Red team operator',
  'Blue team analyst',
  'Security engineer',
  'Cloud security (AWS/Azure)',
  'OSCP preparation',
  'CRTP preparation',
  'Cybersecurity beginner to job-ready',
  'Network penetration testing',
  'Malware analysis fundamentals',
  'Threat hunting and detection engineering'
];

function clipChoiceValue(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  return text.length <= 100 ? text : text.slice(0, 100);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roadmap')
    .setDescription('Generate a structured cybersecurity learning roadmap')
    .addStringOption((option) =>
      option
        .setName('goal')
        .setDescription('Your goal (e.g., SOC analyst, bug bounty, pentesting)')
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('weeks')
        .setDescription('Roadmap duration in weeks (4-12)')
        .setMinValue(4)
        .setMaxValue(12)
        .setRequired(false)
    ),

  async autocomplete(ctx) {
    const focused = (ctx.interaction.options.getFocused() || '').toLowerCase().trim();
    const ranked = ROADMAP_GOAL_SUGGESTIONS
      .filter((item) => !focused || item.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((item) => {
        const value = clipChoiceValue(item);
        return { name: value, value };
      })
      .filter((item) => item.name && item.value);

    if (ranked.length > 0) {
      await ctx.interaction.respond(ranked);
      return;
    }

    const fallback = clipChoiceValue(focused || 'SOC analyst');
    await ctx.interaction.respond([{ name: fallback, value: fallback }]);
  },

  async execute(ctx) {
    const goal = ctx.interaction.options.getString('goal', true);
    const weeks = ctx.interaction.options.getInteger('weeks');
    const input = Number.isInteger(weeks)
      ? `Goal: ${goal}\nDuration: ${weeks} weeks`
      : goal;

    await runAICommand({
      interaction: ctx.interaction,
      services: ctx.services,
      rateLimiter: ctx.rateLimiter,
      logger: ctx.logger,
      config: ctx.config,
      command: 'roadmap',
      input
    });
  }
};

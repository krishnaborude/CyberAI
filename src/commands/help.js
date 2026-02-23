const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands and safe usage guidance'),

  async execute(ctx) {
    const { interaction } = ctx;

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    const commands = interaction.client?.commands;
    let applicationCommands = null;

    try {
      if (interaction.guildId) {
        applicationCommands = await interaction.client.application.commands.fetch({
          guildId: interaction.guildId
        });
      } else {
        applicationCommands = await interaction.client.application.commands.fetch();
      }
    } catch {
      applicationCommands = null;
    }

    const lines = [];

    lines.push('**CyberCortex Help**');
    lines.push('');
    lines.push('Available commands:');

    if (commands && commands.size > 0) {
      for (const command of commands.values()) {
        const name = command?.data?.name;
        const description = command?.data?.description;

        if (!name) continue;

        const appCommand = applicationCommands?.find((ac) => ac.name === name) || null;
        const mention = appCommand ? `</${name}:${appCommand.id}>` : `\`/${name}\``;

        const label = `- ${mention}${description ? ` — ${description}` : ''}`;
        lines.push(label);
      }
    } else {
      lines.push('- Commands are not loaded. Please re-register and restart the bot.');
    }

    lines.push('');
    lines.push(
      'Use these commands only in authorized labs, CTFs, or internal test environments. ' +
        'The bot is designed for ethical cybersecurity learning and will refuse unsafe or out-of-scope requests.'
    );

    const message = lines.join('\n').trim() || 'No help information is available.';

    await interaction.editReply({
      content: message
    });
  }
};


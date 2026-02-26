const { MessageFlags } = require('discord.js');

async function safeExecute(interaction, fn, logger) {
  try {
    await fn();
  } catch (error) {
    logger.error('Command execution failed', {
      command: interaction.commandName,
      userId: interaction.user?.id,
      error: error?.message || String(error)
    });

    const payload = {
      content: 'An internal error occurred while processing your request. Please try again in a moment.',
      flags: MessageFlags.Ephemeral
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
  }
}

module.exports = {
  safeExecute
};

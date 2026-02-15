const { MessageFlags } = require('discord.js');

async function sendChunkedResponse(interaction, chunks, options = {}) {
  const list = Array.isArray(chunks) && chunks.length > 0 ? chunks : ['No response generated.'];
  const flags = options.suppressEmbeds ? MessageFlags.SuppressEmbeds : undefined;
  const payload = (content) => (flags ? { content, flags } : { content });

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload(list[0]));
  } else {
    await interaction.reply(payload(list[0]));
  }

  for (let i = 1; i < list.length; i += 1) {
    await interaction.followUp(payload(list[i]));
  }
}

module.exports = {
  sendChunkedResponse
};

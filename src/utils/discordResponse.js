const { smartSplitMessage } = require('./smartSplitMessage');

function toDiscordSafeChunks(chunks) {
  const input = Array.isArray(chunks) ? chunks : [];
  const safe = [];

  for (const chunk of input) {
    const text = typeof chunk === 'string' ? chunk.trim() : '';
    if (!text) continue;

    if (text.length <= 1900) {
      safe.push(text);
      continue;
    }

    const maxChunks = Math.min(8, Math.max(2, Math.ceil(text.length / 1500)));
    const split = smartSplitMessage(text, {
      minChunks: 1,
      maxChunks,
      addPageHeader: false
    });

    for (const part of split) {
      const value = typeof part === 'string' ? part.trim() : '';
      if (value) safe.push(value);
    }
  }

  return safe;
}

async function sendChunkedResponse(interaction, chunks) {
  const safeList = toDiscordSafeChunks(
    Array.isArray(chunks) && chunks.length > 0 ? chunks : ['No response generated.']
  );
  const list = safeList.length > 0 ? safeList : ['No response generated.'];

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content: list[0] });
  } else {
    await interaction.reply({ content: list[0] });
  }

  for (let i = 1; i < list.length; i += 1) {
    await interaction.followUp({ content: list[i] });
  }
}

module.exports = {
  sendChunkedResponse
};

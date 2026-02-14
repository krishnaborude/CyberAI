async function sendChunkedResponse(interaction, chunks) {
  const list = Array.isArray(chunks) && chunks.length > 0 ? chunks : ['No response generated.'];

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
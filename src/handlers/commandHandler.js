const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');

function loadCommands(commandsDir) {
  const commands = new Collection();
  const files = fs.readdirSync(commandsDir).filter((file) => file.endsWith('.js'));

  for (const file of files) {
    const fullPath = path.join(commandsDir, file);
    const command = require(fullPath);

    if (!command.data || typeof command.execute !== 'function') {
      throw new Error(`Command file ${file} is missing required exports.`);
    }

    commands.set(command.data.name, command);
  }

  return commands;
}

module.exports = {
  loadCommands
};
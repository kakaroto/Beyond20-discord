require('dotenv-expand')(require('dotenv').config({ path: '.env' }));
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs-extra');
const path = require('path');

const commandsDir = path.resolve(__dirname, './commands');
const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));

const commands = [];
for (const file of commandFiles) {
    const command = require(path.join(commandsDir, file));
	commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(process.env.BOT_TOKEN);

const route = process.env.GUILD_ID ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID) : Routes.applicationCommands(process.env.CLIENT_ID);

rest.put(route, { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);
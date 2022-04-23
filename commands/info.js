const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription('Replies with instructions on how to use the Beyond20 bot'),
	async execute(interaction) {
		await interaction.reply({
            content: `To get the secret key to send rolls to it, type \`/secret\` in any channel of a server you own and which the bot has access to.
For more information, visit : https://beyond20.here-for-more.info/discord`,
            ephemeral: true
        });
	},
};
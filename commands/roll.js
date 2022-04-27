const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require("discord.js");
const { DNDBRoll } = require("../dice");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('roll')
		.setDescription('Roll a dice formula')
        .addStringOption(option => 
            option.setName('formula')
                .setDescription("The dice formula to roll")
                .setRequired(true))
        .addStringOption(option => 
            option.setName('title')
                .setDescription("The title of the roll"))
        .addStringOption(option => 
            option.setName('name')
                .setDescription("The character name to display"))
        .addStringOption(option => 
            option.setName('description')
                .setDescription("The description for the roll"))
        .addBooleanOption(option => 
            option.setName('whisper')
                .setDescription("Whisper the result to self")),
	async execute(interaction, bot) {
        const formula = interaction.options.getString("formula");
        const whisper = interaction.options.getBoolean("whisper");
        const title = interaction.options.getString("title");
        const name = interaction.options.getString("name");
        const description = interaction.options.getString("description");
        const roll = new DNDBRoll(formula);
        await roll.roll();
        const rollData = roll.toJSON();
        const rollEmbed = new Discord.MessageEmbed()
            .setFooter({text: 'Rolled using Beyond 20', iconURL: 'https://beyond20.here-for-more.info/images/icon128.png'})
        if (title) {
            rollEmbed.setTitle(title)
        }
        if (name) {
            rollEmbed.setAuthor({name: name})
        }
        if (description) {
            rollEmbed.setDescription(description)
        }
        const critical_success = rollData['critical-success'];
        const critical_fail = rollData['critical-failure'];
        if (critical_success && critical_fail)
            rollEmbed.setColor('#000099')
        else if (critical_success)
            rollEmbed.setColor('#009900')
        else if (critical_fail)
            rollEmbed.setColor('#990000')
        else
            rollEmbed.setColor('#999999')
        rollEmbed.addField(bot.rollToDetails(rollData), bot.rollToSpoiler(rollData));
		await interaction.reply({
            embeds: [rollEmbed],
            ephemeral: whisper === true
        });
	},
};

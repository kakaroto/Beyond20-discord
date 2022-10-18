const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require("discord.js");
const { DNDBRoll } = require("../dice");
const { WhisperType } = require("../constants");

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
                .setDescription("Whisper the result to self"))
        .addBooleanOption(option => 
            option.setName('spoilers')
                .setDescription("Set whether or not roll details should be hidden behind spoiler tags")),
	async execute(interaction, bot) {
        const formula = interaction.options.getString("formula");
        const whisper = interaction.options.getBoolean("whisper");
        const title = interaction.options.getString("title");
        const name = interaction.options.getString("name");
        const description = interaction.options.getString("description");
        const spoilers = interaction.options.getBoolean("spoilers") ?? true;
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
        // set up options
        const options = [];
        if (!spoilers) options.push("nospoilers");
        rollEmbed.addField(bot.rollToDetails(rollData), bot.rollToSpoiler(rollData, WhisperType.NO, options));
		await interaction.reply({
            embeds: [rollEmbed],
            ephemeral: whisper === true
        });
	},
};

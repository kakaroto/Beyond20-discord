const { SlashCommandBuilder } = require('@discordjs/builders');
const Cryptr = require("cryptr");
const crypt = new Cryptr(process.env.SECRET_KEY_CHANNEL_PASSWORD);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('secret')
		.setDescription('Request a secret key to send rolls to Discord')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription("The destination channel to send the rolls to"))
        .addChannelOption(option => 
            option.setName('whisper')
                .setDescription("The destination channel to send whispers to"))
        .addUserOption(option => 
            option.setName('whisper-user')
                .setDescription("The Discord user to send whispers to as Direct Messages"))
        .addBooleanOption(option => 
            option.setName('spoilers')
                .setDescription("Set whether or not roll details should be hidden behind spoiler tags")),
	async execute(interaction) {
        const owner = interaction.guild.ownerId;
        if (interaction.user.id !== owner) {
            return interaction.reply({content: 'Only the server owner can use this command.', ephemeral: true});
        }

        let destination = interaction.channelId;
        const channel = interaction.options.getChannel("channel");
        const whisper = interaction.options.getChannel("whisper");
        const whisperDM = interaction.options.getUser("whisper-user");
        const spoilers = interaction.options.getBoolean("spoilers");
        if (channel) {
            if (!['GUILD_TEXT', 'GUILD_PUBLIC_THREAD', 'GUILD_PRIVATE_THREAD'].includes(channel.type)) {
                return interaction.reply({ content: "Error: Can only specify a text channel", ephemeral: true});
            }
            destination = channel.id;
        }
        if (whisper && whisperDM) {
            return interaction.reply({ content: "Error: Cannot specify both a whisper channel and a whisper DM destination", ephemeral: true});
        }
        let whisperDestination = null;
        if (whisper) {
            if (!['GUILD_TEXT', 'GUILD_PUBLIC_THREAD', 'GUILD_PRIVATE_THREAD'].includes(whisper.type)) {
                return interaction.reply({ content: "Error: Can only specify a text channel for whisper destination", ephemeral: true});
            }
            whisperDestination = whisper.id;
        } else if (whisperDM) {
            whisperDestination = whisperDM.id;
        }

        const options = [];
        if (spoilers === false) options.push("nospoilers"); // Defaults to true
        const plainSecret = {destination, whisper: whisperDestination, options: options.join(" ")};
        const secret = crypt.encrypt(JSON.stringify(plainSecret));
        await interaction.reply({
            content: `The secret key to send the Beyond20 rolls to the channel #${destination.name} is : \`${secret}\`\nYou can share it with your party as anyone with the key can send rolls to the channel.`,
            ephemeral: true
        });
	},
};
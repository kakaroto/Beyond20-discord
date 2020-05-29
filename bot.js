const logger = require("./logger");
const Discord = require("discord.js");
const TurndownService = require('turndown')
const Cryptr = require("cryptr");
const { WhisperType } = require("./constants");

const crypt = new Cryptr(process.env.SECRET_KEY_CHANNEL_PASSWORD);

const turndownService = new TurndownService()

class Bot {
    constructor() {
        this.client = new Discord.Client({shards: "auto"});

        this.client.once('ready', async () => {
            logger.info(`Logged in as ${this.client.user.username}!`);
        });
        this.client.on('shardReady', async (id) => {
            logger.info(`Shard ${id} is now ready!`);
        });
        this.client.on('message', this._onMessageReceived.bind(this));
        this.client.on('messageReactionAdd', this._onMessageReactionAdded.bind(this));
        this.client.login(process.env.BOT_TOKEN);
    }

    async _onMessageReceived(message) {
        const prefix = message.channel.type === "dm" ? "" : process.env.BEYOND20_MESSAGE_PREFIX;

        if (process.env.RESTRICT_TO_AUTHOR && message.author.id !== process.env.RESTRICT_TO_AUTHOR) return;
        if (message.author.bot || !message.content.startsWith(prefix)) return;
        const from = message.channel.type === "dm" ? `from ${message.author.username}` : `on '${message.channel.guild.name}'#${message.channel.name}`
        logger.debug(`Received message ${from} (${message.channel.type})  : ${message.content}`);
        let content = message.content.slice(prefix.length).trim();
        if (content.startsWith(process.env.BEYOND20_MESSAGE_PREFIX)) content = content.slice(process.env.BEYOND20_MESSAGE_PREFIX.length).trim();
        if (content.startsWith('!')) content = content.slice(1).trim();

        const args = content === "" ? ["info"] : content.split(/ +/);
        const command = args.shift().toLowerCase();
        try {
            if (this[`command_${command}`] instanceof Function)
                await this[`command_${command}`](message, ...args)
        } catch (err) {
            try {
                message.channel.send('Error executing command.', {reply: message})
            } catch {}
            logger.error(err);
        }
    }
    _onMessageReactionAdded(messageReaction, user) {
        logger.debug(`Message reaction added by ${user.username} : ${messageReaction.emoji.name}`);
    }

    command_ping(message) {
        message.channel.send("pong!", {reply: message});
    }
	command_stats(message) {
		message.channel.send(`Server count: ${this.client.guilds.cache.size}`);
    }
    
    async getMentionFromMessage(message, destination) {
        const isChannel = destination.startsWith("<#") && destination.endsWith(">");
        const isUser = destination.startsWith("<@") && !destination.startsWith("<@&") && destination.endsWith(">");
        if (!isChannel && !isUser)
            throw new Error("Invalid syntax. Argument must be a channel or a user.")
        if (isChannel) {
            const channel = destination.slice(2, -1);
            if (!message.mentions.channels.has(channel))
                throw new Error("Invalid syntax. Destination channel must be in this server.")
            destination = channel;
        }
        if (isUser) {
            const user = destination.slice(destination[2] === '!' ? 3 : 2, -1);
            if (!message.mentions.users.has(user))
                throw new Error("Invalid syntax. Destination user must be in this server.")
            const dm = await this.client.users.resolve(user).createDM();
            destination = dm.id;
        }
        return destination;
    }
    async command_secret(message, rollDestination, whisper, whisperDestination, options="") {
        const isDM = message.channel.type === "dm";
        const owner = isDM ? message.author.id : message.channel.guild.ownerID;
        if (message.author.id !== owner)
            return message.channel.send(`Only the server owner can use this command.`, {reply: message});
        const dm = isDM ? message.channel : await this.client.users.resolve(owner).createDM();
        let destination = message.channel.id;
        if (rollDestination) {
            if (isDM)
                throw new Error("Invalid syntax. Can only mention destination when used in a server.");
            destination = await this.getMentionFromMessage(message, rollDestination);
        }
        if (whisper && whisper !== "whisper")
            throw new Error("Third argument can only be set to 'whisper'");
        if (whisper)
            whisperDestination = await this.getMentionFromMessage(message, whisperDestination);
        else
            whisperDestination = null;

        if (dm) {
            const plainSecret = {destination, whisper: whisperDestination, options};
            const secret = crypt.encrypt(JSON.stringify(plainSecret));
            const to = isDM ? 'this channel' : (rollDestination ? `your selection` : `the channel #${message.channel.name}`);
            try {
                await dm.send(`The secret key to send the Beyond20 rolls to ${to} is : \`${secret}\`\nYou can share it with your party as anyone with the key can send rolls to the channel.`);
            } catch (err) {
                return message.channel.send(`Error sending Secret key in private : ${err.message}`, {reply: message})
            }
            if (!isDM)
                return message.channel.send('Secret key sent in private.', {reply: message})
        } else {
            throw new Error("Can't create DM channel with owner.")
        }

    }
    command_info(message) {
        message.channel.send(`To get the secret key to send rolls to it, type \`${process.env.BEYOND20_MESSAGE_PREFIX} secret\` in any channel of a server you own and which the bot has access to.\nFor more information, visit : https://beyond20.here-for-more.info/discord`, {reply: message});
    }

    async roll(data) {
        if (process.env.RESTRICT_TO_SECRET && data.secret !== process.env.RESTRICT_TO_SECRET) return;
        logger.info("Received roll request for character : ", data && data.character && data.character.name ? data.character.name : "Unknown");
        logger.debug("Roll data", data);
        let channelID = null;
        try {
            channelID = crypt.decrypt(data.secret);
        } catch (err) {}
        if (!channelID)
            return {error: "An invalid Secret Key was provided"};
        let channel = this.client.channels.resolve(channelID);
        if (!channel)
            channel = await this.client.channels.fetch(channelID);
        if (!channel)
            return {error: "This key is invalid or the Beyond20 Discord Bot is not in the channel anymore."};

        if (data.request.type === "avatar") {
            const imageMessage = new Discord.MessageAttachment(data.request.character.avatar);
            try {
                await channel.send(imageMessage);
            } catch (err) {
                return {error: `Error sending message : ${err}`}
            }
            return {}
        }

        const title = data.request.whisper === WhisperType.HIDE_NAMES ? "???" : data.title;
        const url = (data.request.whisper === WhisperType.NO ? data.request.character.url : null) || 'https://beyond20.here-for-more.info/'
        const rollEmbed = new Discord.MessageEmbed()
            .setTitle(title)
            .setURL(url)
            .setFooter('Rolled using Beyond 20', 'https://beyond20.here-for-more.info/images/icon128.png')
        if (data.request.whisper === WhisperType.NO)
            rollEmbed.setThumbnail(data.request.preview)
        if (data.request.character.name && data.request.whisper !== WhisperType.HIDE_NAMES)
            rollEmbed.setAuthor(data.request.character.name, data.request.character.avatar, url)
        if (data.description && data.open && data.request.whisper !== WhisperType.HIDE_NAMES) {
            let description = ''
            if (data.source)
                description += `**${data.source}**\n`
            for (let attr in data.attributes)
                description += `__${attr}__ : _${data.attributes[attr]}_\n`
            description += (description != "" ? "\n" : "") + turndownService.turndown(data.description)
            if (description.length >= 2048)
                description = description.substr(0, 2040) + "\n**...**"
            rollEmbed.setDescription(description)
        }
        for (let [name, value] of data.roll_info)
            rollEmbed.addField(name, value)

        const rollToDetails = (roll) => {
            const total = roll.total || 0;
            if (roll.discarded) return `~~${total}~~`;
            let string = String(total).replace(/-/g, ':no_entry:')
                .replace(/\+/g, ':heavy_plus_sign:')
                .replace(/10/g, ':keycap_ten:')
                .replace(/1/g, ':one:')
                .replace(/2/g, ':two:')
                .replace(/3/g, ':three:')
                .replace(/4/g, ':four:')
                .replace(/5/g, ':five:')
                .replace(/6/g, ':six:')
                .replace(/7/g, ':seven:')
                .replace(/8/g, ':eight:')
                .replace(/9/g, ':nine:')
                .replace(/0/g, ':zero:');
            if (roll['critical-success']) string += ' :green_circle:';
            if (roll['critical-failure']) string += ' :red_circle:';
            return string;
        }
        const rollToSpoiler = (roll) => {
            if (data.request.whisper === WhisperType.HIDE_NAMES) return '||:game_die:||'
            const formula = roll.formula || "";
            const parts = roll.parts || [];
            let result =  `||:game_die: ${formula} :arrow_right: `;
            let plus = '';
            for (let part of parts) {
                if (part.rolls) {
                    result += `${plus}(`
                    let part_plus = '';
                    for (let die of part.rolls) {
                        result += die.discarded ? `~~${part_plus}${die.roll}~~` : `${part_plus}${die.roll}`;
                        part_plus = ' + ';
                    }
                    result += ')';
                } else {
                    if (['+', '-'].includes(String(part).trim())) {
                        plus = ` ${part} `;
                    } else {
                        part = isNaN(part) ? part : Number(part);
                        if (part < 0) {
                            part = -1 * part;
                            plus = ' - ';
                        }
                        result += `${plus}${part}`;
                    }
                }
                plus = ' + ';
            }
            result += '||';
            return result;
        };
        const critical_success = data.attack_rolls.some(roll => !roll.discarded && roll['critical-success']);
        const critical_fail = data.attack_rolls.some(roll => !roll.discarded && roll['critical-failure']);
        if (critical_success && critical_fail)
            rollEmbed.setColor('#000099')
        else if (critical_success)
            rollEmbed.setColor('#009900')
        else if (critical_fail)
            rollEmbed.setColor('#990000')
        else
            rollEmbed.setColor('#999999')
        for (let attack of data.attack_rolls) {
            rollEmbed.addField(rollToDetails(attack), rollToSpoiler(attack), true)
        }
        for (let [name, roll, flags] of data.damage_rolls) {
            if (typeof(roll) === "string") {
                rollEmbed.addField(name, roll)
            } else {
                const detail = rollToDetails(roll)
                const spoiler = rollToSpoiler(roll)
                rollEmbed.addField(`**${name.trim()} :** ${detail}`, spoiler)
            }
        }
        for (let name in data.total_damages) {
            const detail = rollToDetails(data.total_damages[name])
            const spoiler = rollToSpoiler(data.total_damages[name])
            rollEmbed.addField(`**Total ${name} :** ${detail}`, spoiler)
        }

        try {
            await channel.send(rollEmbed);
        } catch (err) {
            return {error: `Error sending message : ${err}`}
        }
        return {}
    }
}

module.exports = Bot;
const logger = require("./logger");
const Discord = require("discord.js");
const TurndownService = require('turndown')
const Cryptr = require("cryptr");
const crypt = new Cryptr(process.env.SECRET_KEY_CHANNEL_PASSWORD);

const turndownService = new TurndownService()

class Bot {
    constructor() {
        this.client = new Discord.Client();

        this.client.once('ready', async () => {
            logger.info(`Logged in as ${this.client.user.username}!`);
        });
        this.client.on('message', this._onMessageReceived.bind(this));
        this.client.on('messageReactionAdd', this._onMessageReactionAdded.bind(this));
        this.client.login(process.env.BOT_TOKEN);
    }

    async _onMessageReceived(message) {
        const prefix = message.channel.type === "dm" ? "" : process.env.BEYOND20_MESSAGE_PREFIX;
        
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
    async command_secret(message) {
        const isDM = message.channel.type === "dm";
        const owner = isDM ? message.author.id : message.channel.guild.ownerID;
        if (message.author.id !== owner)
            return message.channel.send(`Only the server owner can use this command.`, {reply: message});
        const dm = isDM ? message.channel : await this.client.users.resolve(owner).createDM();
        
        if (dm) {
            const secret = crypt.encrypt(message.channel.id);
            const to = isDM ? 'this channel' : `the channel #${message.channel.name}`;
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
        const rollEmbed = new Discord.MessageEmbed()
            .setTitle(data.title)
            .setURL('https://beyond20.here-for-more.info/discord')
            .setThumbnail(data.request.preview)
            .setFooter('Rolled using Beyond 20', 'https://beyond20.here-for-more.info/images/icon128.png')
        if (data.request.character.name)
            rollEmbed.setAuthor(data.request.character.name, data.request.character.avatar, data.request.character.url || 'https://beyond20.here-for-more.info/')
        if (data.description && data.open) {
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
            if (roll.discarded) return `~~${roll.total}~~`;
            let string = String(roll.total).replace(/-/g, ':no_entry:')
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
            let result =  `||:game_die: ${roll.formula} :arrow_right: `;
            let plus = '';
            for (let part of roll.parts) {
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
            if (roll.formula) {
                const detail = rollToDetails(roll)
                const spoiler = rollToSpoiler(roll)
                rollEmbed.addField(`**${name.trim()} :** ${detail}`, spoiler)
            } else {
                rollEmbed.addField(name, roll)
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
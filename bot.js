const logger = require("./logger");
const Discord = require("discord.js");
const TurndownService = require('turndown')
const Cryptr = require("cryptr");
const { WhisperType } = require("./constants");
const fs = require('fs-extra');
const path = require('path');
const crypt = new Cryptr(process.env.SECRET_KEY_CHANNEL_PASSWORD);

const commandsDir = path.resolve(__dirname, './commands');

const turndownService = new TurndownService()

class Bot {
    constructor() {
        this.client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS] });
        this.client.commands = new Discord.Collection();
        const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const command = require(path.join(commandsDir, file));
            // Set a new item in the Collection
            // With the key as the command name and the value as the exported module
            this.client.commands.set(command.data.name, command);
        }

        this.client.once('ready', () => {
            logger.info(`Logged in as ${this.client.user.username}!`);
        });
        this.client.on('shardReady', (id) => {
            logger.info(`Shard ${id} is now ready!`);
        });
        if (process.env.DEBUG) {
            this.client.on('debug', (info) => {
                console.log(info);
            });
        }
        this.client.on('error', (err) => {
            console.error("Discord Error ", err);
        });
        this.client.on('interactionCreate', this._onInteractionReceived.bind(this));
        this.client.login(process.env.BOT_TOKEN);
        this.client.Beyond20Bot = this;
    }

    async _onInteractionReceived(interaction) {
        if (!interaction.isCommand()) return;

        const command = this.client.commands.get(interaction.commandName);

        if (!command) return;

        try {
            await command.execute(interaction, this);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }


    static parseToChannel(data) {
        if (process.env.RESTRICT_TO_SECRET && data.secret !== process.env.RESTRICT_TO_SECRET) throw new Error("Invalid restricted secret");

        let secret = null;
        let channelID = null;
        let options = "";
        try {
            secret = crypt.decrypt(data.secret);
        } catch (err) {
            // ignore error
        }
        if (!secret)
            return {error: "An invalid Secret Key was provided"};
        try {
            const json = JSON.parse(secret);
            channelID = json.destination;
            if (data.request.whisper === WhisperType.YES && json.whisper) {
                channelID = json.whisper;
                data.request.whisper = WhisperType.NO;
            }
            options = json.options || "";
        } catch(err) {
            // ignore error
        }
        if (!channelID)
            return {error: "An invalid Secret Key was provided"};
        return {channelID, options};
    }

    async roll(data) {
        const {channelID, options} = this.constructor.parseToChannel(data);
        return this.rollToChannel(data, channelID, options);
    }
    async rollToChannel(data, channelID, options) {
        let channel = null;
        try {
            if (channelID) {
                channel = this.client.channels.resolve(channelID);
                if (!channel) {
                    channel = await this.client.channels.fetch(channelID);
                }
            }
        } catch {
            channel = null;
        }
        if (!channel)
            return {error: "This key is invalid or the Beyond20 Discord Bot is not in the channel anymore.", noguild: true};

        logger.info("Received roll request for character : " + data && data.request.character && data.request.character.name ? data.request.character.name : "Unknown");
        logger.debug("Roll data", data);
        if (data.request.type === "avatar") {
            try {
                await channel.send({files: [data.request.character.avatar]});
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
            .setFooter({text: 'Rolled using Beyond 20', iconURL: 'https://beyond20.here-for-more.info/images/icon128.png'})
        if (data.request.whisper === WhisperType.NO)
            rollEmbed.setThumbnail(data.request.preview)
        if (data.request.character.name && data.request.whisper !== WhisperType.HIDE_NAMES)
            rollEmbed.setAuthor({name: data.request.character.name, iconURL: data.request.character.avatar, url})
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
            rollEmbed.addField(this.rollToDetails(attack), this.rollToSpoiler(attack, data.request.whisper, options), true)
        }
        for (let [name, roll] of data.damage_rolls) {
            if (typeof(roll) === "string") {
                rollEmbed.addField(name, roll)
            } else {
                const detail = this.rollToDetails(roll)
                const spoiler = this.rollToSpoiler(roll, data.request.whisper, options)
                rollEmbed.addField(`**${name.trim()} :** ${detail}`, spoiler)
            }
        }
        for (let name in data.total_damages) {
            const detail = this.rollToDetails(data.total_damages[name])
            const spoiler = this.rollToSpoiler(data.total_damages[name], data.request.whisper, options)
            rollEmbed.addField(`**Total ${name} :** ${detail}`, spoiler)
        }

        if (data.request.type === "chat-message") {
            rollEmbed.setDescription(data.request.message);
        }
        try {
            await channel.send({embeds: [rollEmbed]});
        } catch (err) {
            return {error: `Error sending message : ${err}`}
        }
        return {}
    }

    rollToDetails(roll, options="") {
        const total = roll.total || 0;
        if (roll.discarded) return `~~${total}~~`;
        if (options.includes("plaintext")) return String(total); // skip all emoji and criticals
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
    rollToSpoiler(roll, whisper=WhisperType.NO, options="") {
        const nospoiler = options.includes("nospoilers");
        const plaintext = options.includes("plaintext");
        if (whisper === WhisperType.HIDE_NAMES) return nospoiler ? ':game_die:' : '||:game_die:||'
        const formula = roll.formula || "";
        const parts = roll.parts || [];
        let result = nospoiler ? "" : `||`;
        result += plaintext ? `${formula} → ` : `:game_die: ${formula} :arrow_right: `;
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
                plus = ' + ';
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
                    plus = ' + ';
                }
            }
        }
        if (!nospoiler)
            result += '||';
        return result;
    }
}

module.exports = Bot;
const { ShardingManager } = require('discord.js');
const Bot = require("./bot");

class ShardedBot {
    constructor() {
        this.manager = new ShardingManager('./shard.js', { token: process.env.BOT_TOKEN });

        this.manager.on('shardCreate', shard => console.log(`Launched shard ${shard.id}`));

        this.manager.spawn();
    }

    async roll(data) {
        const {channelID, options} = Bot.parseToChannel(data);
        // Execute the roll on all shards
        const results = await this.manager.broadcastEval(function (client, context) {
            const {data, channelID, options} = context;
            return client.Beyond20Bot.rollToChannel(data, channelID, options).then(r => {
                return r;
            }).catch(e => {
                return {error: e.message};
            });
        }, {context: {data, channelID, options}}).catch(err => {
            return [{error: err.message}];
        });
        // Find the response from the shard that handles the guild
        return results.find(r => !r.noguild) || results[0];
    }
}

module.exports = ShardedBot;
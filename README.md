# Beyond20 Discord server

Beyond20 Discord bot. Receives roll information on the `/roll` endpoint, builds a Discord embed and posts it on the channel if the secret key is valid.

To run your own bot, you need a .env file with the following information in it:

```
HOST=0.0.0.0
PORT=80
NODE_ENV=production
LOG_LEVEL=info

CLIENT_ID=<client id>
BOT_INVITE_PERMISSIONS=2112
INVITE_URL=https://discordapp.com/oauth2/authorize?&client_id=${CLIENT_ID}&scope=bot&permissions=${BOT_INVITE_PERMISSIONS}
MAIN_URL=https://beyond20.here-for-more.info/discord
BOT_TOKEN=<bot token>

BEYOND20_MESSAGE_PREFIX=!beyond20
SECRET_KEY_CHANNEL_PASSWORD=<secret encryption key>
```

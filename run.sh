#!/bin/bash
docker run --name beyond20-discord-bot -p 8080:8080 -v ${PWD}/.env:/home/node/beyond20-bot/.env -d --restart on-failure:10 beyond20-discord:1.1.0

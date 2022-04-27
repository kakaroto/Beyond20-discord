#!/bin/sh
VERSION=$(awk -F \" '/"version": ".+"/ { print $4; exit; }' package.json)
docker run --rm -it -v ${PWD}/.env:/home/node/beyond20-bot/.env beyond20-discord:${VERSION} register-slash-commands.js

#!/bin/sh
VERSION=$(awk -F \" '/"version": ".+"/ { print $4; exit; }' package.json)
docker build -t beyond20-discord:${VERSION} .

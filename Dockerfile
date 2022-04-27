FROM node:18-alpine

USER node
RUN mkdir -p /home/node/beyond20-bot

# Create app directory
WORKDIR /home/node/beyond20-bot

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# RUN npm install
RUN npm ci

# Bundle app source
COPY *.js ./
COPY commands commands/
COPY public public/


EXPOSE 8080
ENTRYPOINT [ "node" ]
CMD [ "index.js" ]

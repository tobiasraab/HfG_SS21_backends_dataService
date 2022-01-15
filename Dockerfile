FROM node:16

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies

COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

EXPOSE 9080

CMD [ "node", "index.js" ]
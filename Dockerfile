FROM node:latest

ARG email="tarasov.sasha@list.ru"
ARG user="Rack-Pro"
ARG nameProject="Server-TG-chatGPT-Landensky"


LABEL "maintainer"=$email
LABEL "user"=$user
LABEL "NameProject"=$nameProject
ENV AP /usr/src/app

WORKDIR $AP

COPY package*.json ./
RUN npm install nodemon
RUN npm install
COPY . .
# EXPOSE 5000
CMD ["node" , "index.js"]
"use strict";

const express = require("express");
const linebot = require('linebot');
const BodyParser = require('body-parser');
const fetchData = require("./app");

const port = process.env.PORT || 3000;

const bot = linebot({
  channelId: process.env.LINE_CHANNEL_ID,
  channelSecret: process.env.LIEN_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const linebotParser = bot.parser();
const app = express();

app.post('/linewebhook', linebotParser);

app.use(BodyParser.urlencoded({ extended: true }));
app.use(BodyParser.json());

app.post('/broadcast', (req, res) => {
  bot.broadcast(req.body.message).then(() => {
    res.send('broadcast ok');
  }).catch(function (error) {
    res.send('broadcast fail');
  });
});

app.listen(port, () => {
  console.log(`Server is up on port ${port}`);
});
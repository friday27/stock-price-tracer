"use strict";

const express = require("express");
const linebot = require("linebot");
const BodyParser = require("body-parser");
const { broadcastMovingAvg } = require("./app");

const port = process.env.PORT;

const bot = linebot({
  channelId: process.env.LINE_CHANNEL_ID,
  channelSecret: process.env.LIEN_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const linebotParser = bot.parser();
const app = express();

app.post("/linewebhook", linebotParser);

app.use(BodyParser.urlencoded({ extended: true }));
app.use(BodyParser.json());

app.post("/broadcast", async (req, res) => {
  const today = new Date();
  await bot.broadcast(
    `===================\nStart fetching\n${today.getFullYear()}-${
      today.getMonth() + 1
    }-${today.getDate()} stock data\n===================`
  );
  await broadcastMovingAvg(bot);
  return res.send("ok");
});

app.listen(port, () => {
  console.log(`Server is up on port ${port}`);
});

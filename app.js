"use strict";

const axios = require("axios");
const fs = require("fs");

const DAYS = 90;
const URL =
  "https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=";
const GOOGLE_URL = "https://www.google.com/search?q=%E8%82%A1%E5%83%B9+";

const dir = "./data/";

function sleep(ms = 5000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchStockCodes() {
  const data = await fs.readFileSync("./tw-stock-codes", "utf-8");
  return data.split("\n");
}

async function fetchData(bot) {
  const stocks = {};
  const stockCodes = await fetchStockCodes();

  const today = new Date();
  const date = `${today.getFullYear()}${today.getMonth() + 1}01`;

  for (const stockCode of stockCodes) {
    let run = 0;
    while (run < 3) {
      try {
        const res = await axios.get(URL + `${date}&stockNo=${stockCode}`);

        if (res.data.stat !== "OK") {
          console.log(stockCode, date, "no data", res.data.stat);
          break;
        }

        fs.writeFileSync(
          `${dir}${stockCode}-${date}.json`,
          JSON.stringify(stocks, null, 2)
        );
        run += 3;
      } catch (e) {
        console.log(
          `failed (${++run}) to fetch stock ${stockCode} on ${date}: ${
            e.message
          }`
        );
      } finally {
        await sleep((run + 1) * 2 * 1000);
      }
    }
  }
}

function combineData() {
  const files = fs.readdirSync(dir);
  const data = {};

  for (const file of files) {
    let d = fs.readFileSync(dir + file);
    d = JSON.parse(d);

    let stockCode = file.split("-")[0];
    if (!data[stockCode]) data[stockCode] = {};

    for (const dateRow of d.data) {
      let [
        date,
        _totalShare,
        totalAmount,
        open,
        hi,
        lo,
        end,
        _delta,
        _total,
      ] = dateRow;
      date = date.split("/");
      date = parseInt(date[0]) + 1911 + date[1] + date[2];
      data[stockCode][date] = {
        totalAmount,
        open,
        end,
        hi,
        lo,
      };
    }
  }
  console.log(files.length, "files found");
  console.log(Object.keys(data).length, "stocks saved");

  fs.writeFileSync("./stock-prices.json", JSON.stringify(data, null, 2));
}

async function broadcastMovingAvg(bot) {
  const stocks = JSON.parse(fs.readFileSync("./stock-prices.json"));
  let targets = 0;

  for (const stock of Object.keys(stocks)) {
    const prices = [];

    let dates = Object.keys(stocks[stock]);
    dates.sort((a, b) => parseInt(b) - parseInt(a));
    dates = dates.slice(0, DAYS);

    for (const date of dates) {
      const avg =
        (parseFloat(stocks[stock][date].open) +
          parseFloat(stocks[stock][date].end)) /
        2;
      prices.push(avg);
    }

    const daysAvg = prices.reduce((a, b) => a + b) / prices.length;
    let dev = 0;
    for (const price of prices) dev += (price - daysAvg) ** 2;
    dev = (dev / prices.length) ** 0.5;

    const targetPrice = daysAvg - dev * 2;
    if (prices[0] <= targetPrice) {
      const msg = `${stock}\ntarget:   ${targetPrice.toFixed(
        2
      )}\ncurrent: ${prices[0].toFixed(2)} (${
        dates[0]
      })\n${GOOGLE_URL}${stock}`;
      await bot.broadcast(msg);
      targets++;
    }
  }
  bot.broadcast(
    `===================\nfound ${targets} targets\n===================`
  );
}

module.exports = {
  fetchData,
  combineData,
  broadcastMovingAvg,
};

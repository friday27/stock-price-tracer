"use strict";

const axios = require("axios");
const fs = require("fs");
const Dropbox = require("dropbox").Dropbox;

const DAYS = process.env.DAYS;
const TWSE_URL = process.env.TWSE_URL;
const GOOGLE_URL = process.env.GOOGLE_URL;
const DROPBOX_TOKEN = process.env.DROPBOX_TOKEN;

const dir = "./data/";
const today = new Date();

const dbx = new Dropbox({ accessToken: DROPBOX_TOKEN });

function sleep(ms = 5000) {
  return new Promise((res) => setTimeout(res, ms));
}

async function fetchStockCodes() {
  const data = await fs.readFileSync("./tw-stock-codes", "utf-8");
  return data.split("\n");
}

async function fetchData() {
  const stocks = {};
  const stockCodes = await fetchStockCodes();

  const date = `${today.getFullYear()}${("0" + today.getMonth() + 1).slice(
    -2
  )}01`;

  for (const stockCode of stockCodes) {
    if (stockCode.length === 0) continue;
    stocks[stockCode] = {};
    let run = 0;
    while (run < 3) {
      try {
        const res = await axios.get(TWSE_URL + `${date}&stockNo=${stockCode}`);

        if (res.data.stat !== "OK") {
          console.log(stockCode, date, "no data", res.data.stat);
          break;
        }

        for (let dateRow of res.data.data) {
          let [
            stockDate,
            _totalShare,
            totalAmount,
            open,
            hi,
            lo,
            end,
            _delta,
            _total,
          ] = dateRow;

          let d = stockDate.split("/");
          d = parseInt(d[0]) + 1911 + d[1] + d[2];

          stocks[stockCode][d] = {
            totalAmount,
            open,
            end,
            hi,
            lo,
          };
        }

        console.log("fetched", stockCode);
        run += 3;
      } catch (e) {
        console.error(
          `failed (${++run}) to fetch stock ${stockCode} on ${date}: ${
            e.message
          }`
        );
      } finally {
        await sleep((run + 1) * 2 * 1000);
      }
    }
  }

  return stocks;
}

async function fetchOldData() {
  const filename = "./stock-prices.json";
  let latestFileDate = 0;

  await dbx
    .filesListFolder({ path: "" })
    .then((res) => {
      for (const entry of res.result.entries) {
        let [_1, _2, date] = entry.name.split("-");
        date = date.replace(".json", "");
        latestFileDate = Math.max(parseInt(date), latestFileDate);
      }

      dbx
        .filesDownload({
          path: `/stock-prices-${latestFileDate}.json`,
        })
        .then((data) => {
          fs.writeFile(filename, data.result.fileBinary, "binary", (err) => {
            if (err) throw err;
            console.log(`File: ${filename} (${latestFileDate}) saved`);
          });
        });
    })
    .catch((err) => {
      console.error(err);
    });

  const currentData = await JSON.parse(fs.readFileSync(filename));
  return currentData;
}

async function broadcastMovingAvg(bot) {
  const newData = await fetchData();
  const stocks = await fetchOldData();

  for (const s of Object.keys(newData)) {
    if (!stocks[s]) stocks[s] = {};
    stocks[s] = await { ...stocks[s], ...newData[s] };
  }
  delete stocks[""];
  console.log(`fetched prices for ${Object.keys(stocks).length} stocks`);

  try {
    const filename = `/stock-prices-${today.getFullYear()}${(
      "0" +
      (today.getMonth() + 1)
    ).slice(-2)}${("0" + today.getDate()).slice(-2)}.json`;
    dbx
      .filesUpload({ path: filename, contents: JSON.stringify(stocks) })
      .then((res) => {
        console.log("new file uploaded to Dropbox: ", res.result.path_display);
      });
  } catch (e) {
    console.error("failed to upload file to Dropbox:", e.message);
  }

  for (const stock of Object.keys(stocks)) {
    if (stock.length === 0) continue;
    const prices = [];

    let dates = Object.keys(stocks[stock]);
    dates.sort((a, b) => parseInt(b) - parseInt(a));
    dates = dates.slice(0, DAYS);

    // TODO: find the source of old data
    // if (dates[0].includes("2020")) continue;

    for (const date of dates) {
      prices.push(stocks[stock][date].open);
      prices.push(stocks[stock][date].end);
    }

    const daysAvg = prices.reduce((a, b) => a + b, 0) / prices.length;
    let dev = 0;
    for (const price of prices) dev += (price - daysAvg) ** 2;
    dev = (dev / prices.length) ** 0.5;

    const targetSellingPrice = daysAvg + dev * 2;
    const targetBuyingPrice = daysAvg - dev * 2;
    if (prices[0] <= targetBuyingPrice) {
      const msg = `[Buy] TW ${stock}\ntarget:   ${targetBuyingPrice.toFixed(
        2
      )}\ncurrent: ${prices[0].toFixed(2)} (${
        dates[0]
      })\n${GOOGLE_URL}${stock}`;
      bot.broadcast(msg);
      console.log(msg, "prices[0]:", prices[0]);
    } else if (prices[0] >= targetSellingPrice) {
      const msg = `[Sell] TW ${stock}\ntarget:   ${targetSellingPrice.toFixed(
        2
      )}\ncurrent: ${prices[0].toFixed(2)} (${
        dates[0]
      })\n${GOOGLE_URL}${stock}`;
      bot.broadcast(msg);
      console.log(msg, "prices[0]:", prices[0]);
    }
  }
}

module.exports = {
  broadcastMovingAvg,
};

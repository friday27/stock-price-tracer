"use strict";

const axios = require("axios");
const fs = require("fs");

const DAYS = 90;
const URL = "https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=";

const today = new Date();

function sleep(ms=2500) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function calDates() {
  const dates = [];

  for (let i = parseInt(DAYS/30); i >= 0; i--) {
    let date = today.getTime() - i * 30 * 24 * 60 * 60 * 1000;
    date = new Date(date);
    date = `${date.getFullYear()}${("0"+(date.getMonth()+1)).slice(-2)}01`;
    dates.push(date);
  }
  return dates;
}

async function fetchStockCodes() {
  const data = await fs.readFileSync("./tw-stock-codes", "utf-8");
  return data.split("\n");
}

async function fetchData() {
  const stocks = {};

  const dates = await calDates();
  const stockCodes = await fetchStockCodes();

  for (const stockCode of stockCodes) {
    let countDays = 0;
    const prices = [];

    for (const date of dates) {
      const res = await axios.get(URL+`${date}&stockNo=${stockCode}`);
      await sleep();
      for (const dailyInfo of res.data.data) {
        prices.push((parseFloat(dailyInfo[3])+parseFloat(dailyInfo[6])/2));
        if (++countDays === DAYS) break;
      }
    }

    const avgPrice = prices.reduce((a, b) => a+b)/prices.length;

    let dev = 0;
    prices.forEach((p) => dev += (p-avgPrice)**2);
    dev = (dev/prices.length)**0.5;

    const targetPrice = avgPrice - dev * 2;
    const isTarget = prices.slice(-1) < targetPrice ? true: false;

    stocks[stockCode] = {
      prices,
      avgPrice,
      dev,
      targetPrice,
      isTarget,
    };

    if (isTarget === true)
      console.log(`${stockCode} target: ${targetPrice.toFixed(2)} current: ${prices.slice(-1)}`);
  }
  fs.writeFileSync(`./data/${today.getFullYear()}${("0"+(today.getMonth()+1)).slice(-2)}${today.getDate()}-stocks.json`, JSON.stringify(stocks, null, 4));
  return stocks;
}

module.exports = fetchData;

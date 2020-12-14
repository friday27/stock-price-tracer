"use strict";

const axios = require("axios");
const fs = require("fs");

const URL =
  "http://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL?response=open_dat";

async function getDailyData() {
  try {
    const res = await axios.get(URL);
    const date = res.data.date;

    const stocks = {};
    res.data.data.forEach((stockArr) => {
      stocks[stockArr[0]] = {
        avgPrice: (parseFloat(stockArr[4]) + parseFloat(stockArr[7])) / 2,
        totalAmount: stockArr[2],
      };
    });

    // concat data
    let pastData = {};
    const filename = `./data/${date.slice(0, 6)}-stock-prices.json`;
    try {
      pastData = JSON.parse(fs.readFileSync(filename));
    } catch (e) {
      // skip if the data doesn't exist
    }
    pastData[date] = stocks;

    fs.writeFileSync(filename, JSON.stringify(pastData, null, 2));

    console.log(`${date} data saved`);
  } catch (e) {
    console.log(`getDailyData: ${e}`);
  }
}

function calculateAvg(days = 7) {
  let dates = [];
  const today = new Date();
  const time = today.getTime();
  for (let i = days; i >= 0; i--) {
    const tmpDate = new Date(time - 24 * 60 * 60 * 1000 * i);
    dates.push(
      `${tmpDate.getFullYear()}${tmpDate.getMonth() + 1}${(
        "0" + tmpDate.getDate()
      ).slice(-2)}`
    );
  }

  const stocks = {};
  for (let date of dates) {
    try {
      let monthlyData = JSON.parse(
        fs.readFileSync(`./data/${date.slice(0, 6)}-stock-prices.json`)
      );
      const data = monthlyData[date];
      const stockIds = Object.keys(data);
      for (const stockId of stockIds) {
        if (!stocks[stockId]) stocks[stockId] = { prices: [], amounts: [] };
        stocks[stockId].prices.push(data[stockId].avgPrice);
        stocks[stockId].amounts.push(data[stockId].totalAmount);
      }
    } catch (e) {
      // skip if the data doesn't exist
    }
  }

  for (let stockId of Object.keys(stocks)) {
    let prices = stocks[stockId].prices;
    const lastPrice = prices[prices.length - 1];
    prices = prices.slice(0, prices.length - 1);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

    // calculate deviation
    let dev = 0;
    for (let p of prices) dev += (p - avg) ** 2;
    dev = (dev / prices.length) ** 0.5;

    stocks[stockId].avgPrice = avg;
    stocks[stockId].targetPrice = avg - dev * 2;

    let avgAmount = 0;
    stocks[stockId].amounts.forEach(a => avgAmount += parseInt(a.replace(",", "")));
    stocks[stockId].avgAmount = avgAmount / stocks[stockId].amounts.length;
  }

  // sort stocks by avg amounts and the gap between target and avg prices
  const sortedStocks = Object.keys(stocks).sort(
    (a, b) =>
      stocks[b].avgAmount -
      stocks[a].avgAmount +
      (stocks[b].avgPrice -
        stocks[b].targetPrice -
        (stocks[a].avgPrice - stocks[a].targetPrice))
  );

  for (let i = 0; i < 20; i++) {
    if (stocks[sortedStocks[i]].targetPrice < stocks[sortedStocks[i]].prices.slice(-1)) {
      console.log("No more target");
      break;
    }
    console.log(sortedStocks[i], stocks[sortedStocks[i]]);
  }
}

async function start() {
  await getDailyData();
  calculateAvg();
}

start();

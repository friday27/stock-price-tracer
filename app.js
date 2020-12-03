"use strict";

const axios = require("axios");
const fs = require("fs");

const URL = "http://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL?response=open_dat"

async function getDailyData() {
  try {
    const res = await axios.get(URL);
    const date = res.data.date;
    const d = ["./data", date.slice(0,4), date.slice(4,6), date.slice(6)];

    for (let i = 0; i < 3; i++) {
      const dir = d.slice(0, i+1).join("/");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
        console.log(`dir ${dir} created`);
      }
    }

    fs.writeFileSync(`./data/${d[1]}/${d[2]}/${date}.json`, JSON.stringify(res.data, null, 4));
    console.log(`${date} data saved`);
  } catch (e) {
    console.log(`getDailyData: ${e}`);
  }
}

function calculateAvg(days=7) {
  let dates = [];
  const today = new Date();
  const time = today.getTime();
  for (let i = days; i >= 0 ; i--) {
    const tmpDate = new Date(time - (24*60*60*1000*i)); 
    dates.push(`${tmpDate.getFullYear()}${tmpDate.getMonth()+1}${("0"+tmpDate.getDate()).slice(-2)}`);
  }

  const stocks = {};
  
  for (let date of dates) {
    try {
      const res = fs.readFileSync(`./data/${date.slice(0,4)}/${date.slice(4,6)}/${date}.json`);
      const data = JSON.parse(res).data;
      for (let row of data) {
        const [stockId, , , , open, , , close, , ] = row;
        if (!stocks[stockId]) stocks[stockId] = [];
        stocks[stockId].push((parseFloat(open)+parseFloat(close))/2);
      }
    } catch (e) { // skip if the data doesn't exist
      continue;
    }
  }

  const targets = [];
  for (let stockId of Object.keys(stocks)) {
    let prices = stocks[stockId];
    const lastPrice = prices[prices.length-1];
    prices = prices.slice(0, prices.length-1);
    const avg = prices.reduce((a, b) => a+b, 0) / prices.length;

    // calculate deviation
    let dev = 0;
    for (let p of prices) dev += (p-avg)**2;
    dev = (dev/prices.length)**0.5;

    if (lastPrice < avg-2*dev) {
      targets.push(stockId);
      console.log(`${stockId} price: ${Math.round(lastPrice, 2)} avg: ${Math.round(avg, 2)} threshold: ${Math.round(avg-2*dev, 2)}`);
    }
  }
  console.log(`Targets: ${targets}`);
}

async function start() {
  await getDailyData();
  calculateAvg();  
}

start();
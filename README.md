# stock-price-tracer

[Line ChatBot 微專案 — 股票推薦機器人 (NodeJS/Heroku/Cronjob)](https://sytw1989.medium.com/line-chatbot-%E5%BE%AE%E5%B0%88%E6%A1%88-%E8%82%A1%E7%A5%A8%E6%8E%A8%E8%96%A6%E6%A9%9F%E5%99%A8%E4%BA%BA-nodejs-heroku-cronjob-f21ac98ea58a)

## To Dos

* US version

## Steps

1. Create a file named **.env** with the following environment variables

```
PORT=

LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=

DROPBOX_TOKEN=

DAYS=180
TWSE_URL=https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=
GOOGLE_URL=https://www.google.com/search?q=%E8%82%A1%E5%83%B9+
```

2. `npm run dev`

3. Use ngrok and set the endpoint as [your Line webhook URL](https://developers.line.biz/console/)

4. `curl -XPOST localhost:PORT/broadcast`

5. (optional) Deploy on Heroku

6. (optional) Use [cronjobs](https://cron-job.org/) to trigger the process periodically

## Reference

* [Dropbox Node SDK Doc](https://dropbox.github.io/dropbox-sdk-js/index.html)

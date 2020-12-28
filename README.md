# stock-price-tracer

## To Dos

* update stock list
* clean
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
* [手把手教你建聊天機器人(linebot+nodjes+ngrok)](https://medium.com/@mengchiang000/%E6%89%8B%E6%8A%8A%E6%89%8B%E6%95%99%E4%BD%A0%E5%BB%BA%E8%81%8A%E5%A4%A9%E6%A9%9F%E5%99%A8%E4%BA%BA-linebot-nodjes-ngrok-7ad028d97a07)

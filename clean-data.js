
const fs = require("fs");

const oldFilename = "./stock-prices-20210114.json";
const newFilename = "./stock-prices-20210115.json";

let stockCodes = fs.readFileSync("./tw-stock-codes");
stockCodes = new Set(stockCodes.toString().split("\n"));

let data = fs.readFileSync(oldFilename);
data = JSON.parse(data);
console.log("Before:", Object.keys(data).length);

for (const s of Object.keys(data)) {
  if (!stockCodes.has(s)) delete data[s];
}
delete data[""];
console.log("After: ", Object.keys(data).length);

fs.writeFile(newFilename, JSON.stringify(data), (err) => {
  if (err) throw err;
  console.log(`File: ${newFilename} saved`);

  let data = fs.readFileSync(newFilename);
  data = JSON.parse(data);
  console.log("Test:  ", Object.keys(data).length);
});

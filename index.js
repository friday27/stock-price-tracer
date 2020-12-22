"use strict";

const express = require("express");
const fetchData = require("./app");

const app = express();
const port = process.env.PORT || 3000;

app.get("", (req, res) => {
  console.log("Received request");
  return res.send(fetchData());
});

app.listen(port, () => {
  console.log(`Server is up on port ${port}`);
});
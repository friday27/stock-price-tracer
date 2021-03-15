"use strict";

const axios = require("axios");
const fs = require("fs");

const TWSE_URL = process.env.TWSE_URL;

// use postgres-cache for local env
db = require('./db/postgres');

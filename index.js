require('dotenv-expand')(require('dotenv').config({ path: '.env' }));

const express = require("./express");

const app = new express()
app.listen();
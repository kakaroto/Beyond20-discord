const dotenv = require('dotenv').config({ path: '.env' })
const config = require('dotenv-expand')(dotenv);
const express = require("./express");

const app = new express()
app.listen();
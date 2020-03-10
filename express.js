const http = require("http");
const express = require('express');
const bodyParser = require('body-parser');
const logger = require('morgan');
const path = require('path');
const errorHandler = require('errorhandler');
const createError = require('http-errors');
const cors = require('cors')({origin: true, credentials: true})
const bot = require("./bot");

class Server {
    constructor() {
        const app = this.app = express();
        this.bot = new bot();

        app.set('host', process.env.HOST || '127.0.0.1');
        app.set('port', process.env.PORT || 80);
        app.disable('x-powered-by');

        app.use(logger('dev'));
        app.use(bodyParser.json());
        app.get('/', (req, res, next)  => {
            res.redirect(process.env.MAIN_URL)
        });

        app.get("/invite", (req, res, next) => {
            res.redirect(process.env.INVITE_URL);
        });

        app.options("/roll", cors);
        app.post("/roll", cors, async (req, res, next) => {
            try {
                res.json(await this.bot.roll(req.body));
            } catch (err) {
                res.json({error: err.message})
            }
        });

        app.use(function(req, res, next) {
            next(createError(404));
        });
        if (process.env.NODE_ENV === 'development') {
            // only use in development
            app.use(errorHandler());
        } else {
            app.use((err, req, res, next) => {
            if (err.status != 404) console.error(err);
            res.locals.message = err.message;
            res.locals.error = req.app.get('env') === 'development' ? err : {};
            res.status(err.status || 500);
            res.send('error');
            });
        }
    }
 
    listen() {
        console.log(`Starting server`);
        http.createServer(this.app).listen(this.app.get('port'), this.app.get('host'), () => {
            console.log(' App is running at http://%s:%d in %s mode', this.app.get('host'), this.app.get('port'), this.app.get('env'));
            console.log('  Press CTRL-C to stop\n');
        });
    }
}

module.exports = Server;
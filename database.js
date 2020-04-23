const Datastore = require("nedb");
const logger = require("./logger");

class Database {
    constructor(filename) {
        this.db = new Datastore({ filename: process.env.DATABASE_PATH });
        this.db.loadDatabase((err) => {
            if (err) logger.error(err)
            else logger.info("Database loaded")
        });
    }

    find(key) {
        
    }
}

module.exports = Database;
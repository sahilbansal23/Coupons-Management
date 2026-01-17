const { pino } = require("pino");
// const {  PinoPretty } = require("pino-pretty");


const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      translateTime: "SYS:dd-mm-yyyy HH:MM:SS",
      ignore: "pid,hostname",
    },
  },
});

module.exports = logger;

var express = require("express");
const cors = require("cors");
const logger = require("./utils/logger");

const app = express();
// const port = Number(process.env.PORT) || 5000;
const port =  4000;


// Middlewares
// app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const couponRoutes = require("./route");

app.use("/api", couponRoutes);

// 404 handler
app.use((req, res) => {
  logger.error("Unknown URL endpoint");
  res.status(404).send("ERROR 404 Page not found");
});

// Server
app.listen(port, async () => {
  //app
  // logger.info({ port: port }, `app listening on port`);
  console.log("SERVER STARTED ON", port);
  
});


module.exports = {app};

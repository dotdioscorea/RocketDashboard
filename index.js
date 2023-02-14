const express = require("express");
const app = express();
const http = require("http").createServer(app);
global.ws = require("./helpers/ws")
global.sp = require("./helpers/sp")

global.activeport = undefined;
global.dataCache = [];
global.dataCacheSize = 100;

// Serve the public folder as the static directory
app.use(express.static("public"));

http.listen(3000, () => {
  console.log("Web server listening on http://localhost:3000");
});

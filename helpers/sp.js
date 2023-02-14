const SerialPort = require("serialport").SerialPort;
const ReadLine = require("serialport").ReadlineParser;
const parser = new ReadLine();

port = undefined;

module.exports.getAvailablePorts = async () => {
  let ports = await SerialPort.list();
  return ports.map(function (object) {
    return object.path;
  });
};

module.exports.choosePort = async (path, callback) => {
  port = await new SerialPort({ path: path, baudRate: 9600 });
  port.pipe(parser);

  port.on("open", async () => {
    console.log("Successfully opened port " + port.path);
    global.activeport = path;
    callback(true);
  });

  port.on("close", async () => {
    global.ws.informPortDisconnect("PORT CLOSED");
  });

  port.on("error", async (err) => {
    callback(err);
    console.log("Error opening port");
  });
};

module.exports.closePort = async () => {
  global.activeport = undefined;
  port.close();
};

parser.on("data", (line) => {
  global.dataCache.push(line);
  if (global.dataCache.length > global.dataCacheSize) global.dataCache.shift();

  global.ws.pushData(line);
});

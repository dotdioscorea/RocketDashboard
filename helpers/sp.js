const SerialPort = require("serialport").SerialPort;

const RATIO = 1;
var COUNT = 0;

port = undefined;
OLDTIME = undefined;
VELOCITY = { X: 0, Y: 0, Z: 0 };
POSITION = { X: 0, Y: 0, Z: 0 };

module.exports.getAvailablePorts = async () => {
  let ports = await SerialPort.list();
  return ports.map(function (object) {
    return object.path;
  });
};

module.exports.choosePort = async (path, callback) => {
  port = await new SerialPort({ path: path, baudRate: 115200 });
  //port.pipe(parser);

  port.on("open", async () => {
    console.log("Successfully opened port " + port.path);
    VELOCITY = { X: 0, Y: 0, Z: 0 };
    POSITION = { X: 0, Y: 0, Z: 0 };
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

  port.on("data", (DATA) => {
    if (DATA.readInt8(0) != 10) return;

    if (COUNT++ <= RATIO) return;
    COUNT = 0;

    try {
      let OFFSET = 0;
      while (OFFSET < DATA.length) {
        if (DATA.readUInt32LE(2 + OFFSET) == OLDTIME) return;

        let MESSAGE = new Object();
        MESSAGE.TIME = DATA.readUInt32LE(2 + OFFSET);
        MESSAGE.DATATYPE = DATA.readInt8(6 + OFFSET);

        let DELTATIME = (MESSAGE.TIME - OLDTIME) / 1000;
        OLDTIME = MESSAGE.TIME;

        //MPU6050 DATA PACKET
        if (MESSAGE.DATATYPE == 0x00) {
          MESSAGE.ROTATION = new Object();
          MESSAGE.ROTATION.YAW = DATA.readFloatLE(7 + OFFSET);
          MESSAGE.ROTATION.PITCH = DATA.readFloatLE(11 + OFFSET);
          MESSAGE.ROTATION.ROLL = DATA.readFloatLE(15 + OFFSET);

          MESSAGE.ACC = new Object();
          MESSAGE.ACC.X = DATA.readInt16LE(19 + OFFSET);
          MESSAGE.ACC.Y = DATA.readInt16LE(21 + OFFSET);
          MESSAGE.ACC.Z = DATA.readInt16LE(23 + OFFSET) + 9.81;

          if (DELTATIME) {
            VELOCITY.X = MESSAGE.ACC.X * DELTATIME;
            VELOCITY.Y = MESSAGE.ACC.Y * DELTATIME;
            VELOCITY.Z = MESSAGE.ACC.Z * DELTATIME;

            POSITION.X += VELOCITY.X * DELTATIME;
            POSITION.Y += VELOCITY.Y * DELTATIME;
            POSITION.Z += VELOCITY.Z * DELTATIME;

            MESSAGE.DISP = new Object();
            MESSAGE.DISP.X = POSITION.X;
            MESSAGE.DISP.Y = POSITION.Y;
            MESSAGE.DISP.Z = POSITION.Z;
          }
        }

        //GPS DATA PACKET
        if (MESSAGE.DATATYPE == 0x01) {
          MESSAGE.LATITUDE = DATA.readFloatLE(7 + OFFSET);
          MESSAGE.LONGITUDE = DATA.readFloatLE(11 + OFFSET);
          MESSAGE.ALTITUDE = DATA.readInt32LE(15 + OFFSET) / 100;
          MESSAGE.SATTELITES = DATA.readUInt16LE(19 + OFFSET);
          MESSAGE.PRECISION = DATA.readUInt32LE(21 + OFFSET);
        }

        global.dataCache.push(MESSAGE);
        if (global.dataCache.length > global.dataCacheSize)
          global.dataCache.shift();
        global.ws.pushData(MESSAGE);

        OFFSET += DATA.readInt8(1 + OFFSET);
      }
    } catch (error) {
      //console.log(error);
    }
  });
};

module.exports.closePort = async () => {
  global.activeport = undefined;
  port.close();
};

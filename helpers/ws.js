const WebSocket = require("ws");
const ws = new WebSocket.Server({ port: 8081 });

ws.on("connection", async function connection(client) {
  client.on("message", async (message) => {
    message = JSON.parse(message);
    console.log(message)

    if (message.GET)
      switch(message.GET) {
        case "SERIALPORTS":
          client.send(JSON.stringify({PUSH : "SERIALPORTS", DATA : await global.sp.getAvailablePorts()}));
        break;
        case "ACTIVEPORT":
          client.send(JSON.stringify({PUSH : "ACTIVEPORT", "DATA" : global.activeport}));
        break;
        case "DATACACHE":
          if (global.activeport)
            global.dataCache.forEach((value) => {pushData(value)});
        break;
      }

    if (message.SET)
      switch(message.SET) {
        case "PORT":
          global.sp.choosePort(message.DATA, async (result) => {
            if(result == true) {informPortConnect();}
             else {client.send(JSON.stringify({PUSH: "ERROR", DATA: result.message}))};
          })
        break;
        case "DISCONNECT":
          global.sp.closePort();
          informPortDisconnect("USER DISCONNECTED");
        break;
      }
  });
});

function informPortDisconnect(reason) {
  ws.clients.forEach((client) => {
    client.send(JSON.stringify({PUSH: "DISCONNECT", DATA: reason}));
  })
}

function informPortConnect() {
  ws.clients.forEach(async (client) => {
    client.send(JSON.stringify({PUSH: "CONNECT"}));
    client.send(JSON.stringify({PUSH: "SERIALPORTS", DATA: await global.sp.getAvailablePorts()}));
    client.send(JSON.stringify({PUSH: "ACTIVEPORT", DATA: global.activeport}));
  })
}

function pushData (data) {
  ws.clients.forEach(async (client) => {
    client.send(JSON.stringify({PUSH: "DATA", DATA: {TIME: Time(), VALUES: data}}))
  })
}

function Time() {
  const date = new Date();
  return date.getHours().toString().padStart(2, '0') + ":" + date.getMinutes().toString().padStart(2, '0') + ":" + date.getSeconds().toString().padStart(2, '0') + "  ";
}

module.exports = { ws, pushData, informPortDisconnect };
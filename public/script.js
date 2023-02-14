const selectElement = document.getElementById("serial-port-input");
const errorElement = document.getElementById("serial-port-error-message");
const connectElement = document.getElementById("serial-port-live");
const connectButton = document.getElementById("connect-button");
const disconnectButton = document.getElementById("disconnect-button");
const reconnectButton = document.getElementById("reconnect-button");
const refreshButton = document.getElementById("refresh-button");
const sessionStatusElement = document.getElementById("session-status");
const rawDataElement = document.getElementById("raw-data");
const dataDiv = document.getElementById("data-wrapper");

ws = undefined;
dataPoints = [];
dataPointsCache = [];

const MAXDATAPOINTS = 100;
const MAXMESSAGES = 10;
const DATAPOINTCACHESIZE = 5;

let onopen = function onopen() {
  ws.send(JSON.stringify({ GET: "SERIALPORTS" }));
  ws.send(JSON.stringify({ GET: "ACTIVEPORT" }));
  ws.send(JSON.stringify({ GET: "DATACACHE" }));
  reconnectButton.style.display = 'none';
  sessionStatusElement.style.color = "darkgreen";
  sessionStatusElement.innerHTML = "Connected";
  LogMessage(Time(), `Connected to server`);
};

let onclose = function onclose(err) {
  SetStatus("DISCONNECTED");
  reconnectButton.style.display = 'block';
  sessionStatusElement.style.color = "brown";
  sessionStatusElement.innerHTML = "Connection Lost";
  while(selectElement.lastElementChild) {selectElement.removeChild(selectElement.lastChild)}
  LogMessage(Time(), `Disconnected from server: ${err}`);
};

var chart = new CanvasJS.Chart("chartContainer", {
  exportEnabled: true,
  title :{
    text: "Sine wave"
  },
  data: [{
    type: "spline",
    markerSize: 0,
    dataPoints: dataPoints 
  }]
});  

let onmessage = function onmessage(event) {
  const message = JSON.parse(event.data);
  console.log(message.PUSH);
  switch (message.PUSH) {
    case "SERIALPORTS":
      while(selectElement.lastElementChild) {selectElement.removeChild(selectElement.lastChild)}
      for (const serialport of message.DATA) {
        const option = document.createElement("option");
        option.value = serialport;
        option.text = serialport;
        selectElement.add(option);
      }
      break;
    case "ACTIVEPORT":
      if(!message.DATA) break;
      SetStatus("CONNECTED");
      ClearErrorMessage();
      selectElement.childNodes.forEach((element) => {
        if ((element.value == message.DATA))
          element.setAttribute("selected", "selected");
        else element.removeAttribute("selected");
      });
      LogMessage(Time(), `Serial port connected: ${message.DATA}`);
      break;
    case "DISCONNECT":
      SetStatus("DISCONNECTED");
      LogMessage(Time(), `Serial port disconnected: ${message.DATA}`);
      ws.send(JSON.stringify({ GET: "SERIALPORTS" }));
      LogMessage(Time(), 'Sending GET request: "SERIAL PORTS"');
    break;
    case "ERROR":
      ShowErrorMessage(message.DATA);
      LogMessage(Time(), message.DATA);
    break;  
    case "DATA":
      LogMessage(message.DATA.TIME, "Recieved data: " + message.DATA.VALUES);
      PlotData(message.DATA.VALUES);
    break;  
  }
};

function LogMessage(time, message) {
  let strings = rawDataElement.innerHTML.split('\n');
  if (strings.length > MAXMESSAGES) strings.shift();
  strings.push(time + message);
  console.log(strings)
  rawDataElement.innerHTML = strings.join('\n').trimStart();
  rawDataElement.scrollTop = rawDataElement.scrollHeight;
}

function PlotData(data) {
  data = data.split(",");
  data.forEach((value) => {if (parseFloat(value) == NaN) return}); //CHECK FOR INVALID LINES
  dataPointsCache.push({ x: parseInt(data[0]), y: parseFloat(data[1])});

  if (dataPointsCache.length < DATAPOINTCACHESIZE) return; 

  if (dataPoints.length > MAXDATAPOINTS - DATAPOINTCACHESIZE) dataPoints.shift(5);

  dataPointsCache.forEach((value) => {dataPoints.push(value)});
  chart.render();
}

function ConnectSerialPort() {
  ClearErrorMessage();
  LogMessage(Time(), `Sending SET request: "PORT" "${selectElement.value}"`);
  ws.send(JSON.stringify({"SET": "PORT", "DATA": selectElement.value}));
}

function DisconnectSerialPort() {
    ClearErrorMessage();
    SetStatus("DISCONNECTED")
    ws.send(JSON.stringify({"SET": "DISCONNECT"}));
    LogMessage(Time(), 'Sending SET request: "DISCONNECT"')
  }

function RefreshSerialPorts() {
  ws.send(JSON.stringify({ GET: "SERIALPORTS" }));
  LogMessage(Time(), 'Sending GET request: "SERIAL PORTS"')
}

function ClearErrorMessage() {
  errorElement.style.display = "none";
}

function ShowErrorMessage(msg) {
  errorElement.innerHTML = msg;
  errorElement.style.display = "inline";
}

function Time() {
  const date = new Date();
  return date.getHours().toString().padStart(2, '0') + ":" + date.getMinutes().toString().padStart(2, '0') + ":" + date.getSeconds().toString().padStart(2, '0') + "  ";
}

function SetStatus(status) {
  if (status == "DISCONNECTED") {
      connectButton.style.display = 'inline';
      connectElement.style.display = 'none';
      disconnectButton.style.display = 'none';
      selectElement.removeAttribute("disabled");
      refreshButton.removeAttribute("disabled");
  }
  if (status == "CONNECTED") {
      connectButton.style.display = 'none';
      connectElement.style.display = 'inline';
      disconnectButton.style.display = 'inline';
      selectElement.setAttribute("disabled", true);
      refreshButton.setAttribute("disabled", true);
  }
}

function ReconnectToServer() {
  LogMessage(Time(), "Attempting to connect to server");
  ws = new WebSocket("ws://localhost:8081");
  ws.onopen = onopen;
  ws.onclose = onclose;
  ws.onmessage = onmessage;
}

ReconnectToServer();
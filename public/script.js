const selectElement = document.getElementById("serial-port-input");
const errorElement = document.getElementById("serial-port-error-message");
const connectElement = document.getElementById("serial-port-live");
const maxAltitudeElement = document.getElementById("max-altitude");
const displacementXElement = document.getElementById("displacement-x");
const displacementYElement = document.getElementById("displacement-y");
const displacementZElement = document.getElementById("displacement-z");
const longitudeElement = document.getElementById("longitude");
const latitudeElement = document.getElementById("latitude");
const altitudeElement = document.getElementById("altitude");
const sattelitesElement = document.getElementById("sattelites");
const precisionElement = document.getElementById("precision");
const connectButton = document.getElementById("connect-button");
const pauseChartButton = document.getElementById("pause-chart-button");
const pauseMapButton = document.getElementById("pause-map-button");
const autofitCheckbox = document.getElementById("autofit");
const disconnectButton = document.getElementById("disconnect-button");
const reconnectButton = document.getElementById("reconnect-button");
const refreshButton = document.getElementById("refresh-button");
const sessionStatusElement = document.getElementById("session-status");
const rawDataElement = document.getElementById("raw-data");
const dataDiv = document.getElementById("data-wrapper");

ws = undefined;
dataPoints = new Object();
dataPoints.yaw = [];
dataPoints.pitch = [];
dataPoints.roll = [];
dataPointsCache = [];
chartPaused = false;
mapPaused = false;
var map;
var path = [];
var polyline;

const MAXDATAPOINTS = 400;
const MAXMESSAGES = 10;
const DATAPOINTCACHESIZE = 2;

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

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 51.5220, lng: -3.2099},
    zoom: 15
  });
}

var chart = new CanvasJS.Chart("chartContainer", {
  exportEnabled: true,
  axisY: {
    minimum: -100,
    maximum: 100
  },
  data: [{
    type: "spline",
    markerSize: 0,
    dataPoints: dataPoints.yaw,
  },
  {
    type: "spline",
    markerSize: 0,
    dataPoints: dataPoints.pitch,
  },
  {
    type: "spline",
    markerSize: 0,
    dataPoints: dataPoints.roll,
  }],
});
chart.render();

let onmessage = function onmessage(event) {
  const message = JSON.parse(event.data);
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
      LogMessage(Time(), "Recieved data packet: " + GetDataType(message.DATA.DATATYPE));
      if (!chartPaused && message.DATA.DATATYPE == 0)
        PlotMPUData(message.DATA);
      if (!mapPaused && message.DATA.DATATYPE == 1)
        PlotGPSData(message.DATA);
    break;  
  }
};

function GetDataType(type) {
  switch (type) {
    case 0:
      return "MPU6050 PACKET";
    case 1:
      return "GPS PACKET";
  }
}

function LogMessage(time, message) {
  let strings = rawDataElement.innerHTML.split('\n');
  if (strings.length > MAXMESSAGES) strings.shift();
  strings.push(time + message);
  rawDataElement.innerHTML = strings.join('\n').trimStart();
  rawDataElement.scrollTop = rawDataElement.scrollHeight;
}

function PlotGPSData(DATA) {
  longitudeElement.innerHTML = DATA.LONGITUDE.toFixed(4);
  latitudeElement.innerHTML = DATA.LATITUDE.toFixed(4);
  altitudeElement.innerHTML = DATA.ALTITUDE.toFixed(1);
  sattelitesElement.innerHTML = DATA.SATTELITES;
  precisionElement.innerHTML = DATA.PRECISION;

  path.push({lat: DATA.LATITUDE, lng: DATA.LONGITUDE});
  if (polyline) polyline.setMap(null);
  polyline = new google.maps.Polyline({
    path: path,
    geodesic: true,
    strokeColor: '#FF0000',
    strokeOpacity: 1.0,
    strokeWeight: 2
  });
  polyline.setMap(map);

  if (autofitCheckbox.checked) {
    var bounds = new google.maps.LatLngBounds();
    path.forEach((value) => {
      bounds.extend(new google.maps.LatLng(value.lat, value.lng));
    })
    map.fitBounds(bounds, 200);
  }
}

function PlotMPUData(DATA) {
  //let value = { x: DATA.TIME / 1000, y1: DATA.ROTATION.YAW, y2: DATA.ROTATION.PITCH};
  //if (parseInt(maxAltitudeElement.innerHTML) < value.y) maxAltitudeElement.innerHTML = value.y;
  dataPointsCache.push(DATA);

  if (dataPointsCache.length < DATAPOINTCACHESIZE) return; 

  dataPointsCache.forEach((value) => {
    dataPoints.yaw.push({ x: DATA.TIME / 1000, y: DATA.ROTATION.YAW});
    dataPoints.pitch.push({ x: DATA.TIME / 1000, y: DATA.ROTATION.PITCH});
    dataPoints.roll.push({ x: DATA.TIME / 1000, y: DATA.ROTATION.ROLL});

    displacementXElement.innerHTML = DATA.DISP.X.toFixed(2);
    displacementYElement.innerHTML = DATA.DISP.Y.toFixed(2);
    displacementZElement.innerHTML = DATA.DISP.Z.toFixed(2);
  });

  while (dataPoints.yaw.length > MAXDATAPOINTS - DATAPOINTCACHESIZE) {
    dataPoints.yaw.shift();
    dataPoints.pitch.shift();
    dataPoints.roll.shift();
  };

  dataPointsCache = [];
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

function ClearChart() {
  dataPoints.length = 0;
  dataPointsCache.length = 0;
  chart.render();
}

function PauseChart() {
  pauseChartButton.innerHTML = "Resume";
  pauseChartButton.onclick = ResumeChart;
  chartPaused = true;
}

function ResumeChart() {
  pauseChartButton.innerHTML = "Pause";
  pauseChartButton.onclick = PauseChart;
  chartPaused = false;
}

function ClearMap() {
  path.length = 0;
  if (polyline) polyline.setMap(null);
}

function PauseMap() {
  pauseMapButton.innerHTML = "Resume";
  pauseMapButton.onclick = ResumeMap;
  mapPaused = true;
}

function ResumeMap() {
  pauseMapButton.innerHTML = "Pause";
  pauseMapButton.onclick = PauseMap;
  mapPaused = false;
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
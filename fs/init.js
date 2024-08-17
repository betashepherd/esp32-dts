load('api_config.js');
load('api_gpio.js');
load('api_mqtt.js');
load('api_timer.js');
load('api_sys.js');
load('api_net.js');
load('api_events.js');
load('api_uart.js');

let uartNo = 1;   // Uart number used for this example
let rxAcc = '';   // Accumulated Rx data, will be echoed back to Tx
let value = false;

// Configure UART at 115200 baud
UART.setConfig(uartNo, {
  baudRate: 115200,
  esp32: {
    gpio: {
      rx: 16,
      tx: 17,
    },
  },
});

// Set dispatcher callback, it will be called whenver new Rx data or space in
// the Tx buffer becomes available
UART.setDispatcher(uartNo, function(uartNo) {
  let ra = UART.readAvail(uartNo);
  if (ra > 0) {
    // Received new data: print it immediately to the console, and also
    // accumulate in the "rxAcc" variable which will be echoed back to UART later
    let data = UART.read(uartNo);
    print('Received UART data:', data);
    rxAcc += data;
  }
}, null);

// Enable Rx
UART.setRxEnabled(uartNo, true);
let led = Cfg.get('board.led1.pin');              // Built-in LED GPIO number
let device_id = Cfg.get('device.id');
let topic = '/' + device_id + '/messages';

let pubData = function() {
  return JSON.stringify({
    up_time: Sys.uptime(),
    total_ram: Sys.total_ram(),
    free_ram: Sys.free_ram(),
    device_id: Cfg.get('device.id'),
    time: Timer.fmt("%F %T", Timer.now() + 28800),
    timestamp: Timer.now(),
    rxAcc: rxAcc
  });
};

// Blink built-in LED every second
GPIO.set_mode(led, GPIO.MODE_OUTPUT);
Timer.set(1000 /* 1 sec */, Timer.REPEAT, function() {
  // let value = GPIO.toggle(led);
  // print(value ? 'Tick' : 'Tock');
  GPIO.toggle(led);
  print(pubData());
}, null);

// Update state every second, and report to cloud if online
Timer.set(5000, Timer.REPEAT, function () {
    if (topic !== '') {
      MQTT.pub(topic, pubData(), 1);
      print("==== MQTT pub:", topic);
      rxAcc = '';
    }
}, null);

// Monitor network connectivity.
Event.addGroupHandler(Net.EVENT_GRP, function(ev, evdata, arg) {
  let evs = '???';
  if (ev === Net.STATUS_DISCONNECTED) {
    evs = 'DISCONNECTED';
  } else if (ev === Net.STATUS_CONNECTING) {
    evs = 'CONNECTING';
  } else if (ev === Net.STATUS_CONNECTED) {
    evs = 'CONNECTED';
  } else if (ev === Net.STATUS_GOT_IP) {
    evs = 'GOT_IP';
  }
  print('==== Net event:', ev, evs);
}, null);

//MQTT monitor
MQTT.setEventHandler(function(conn, ev, edata) {
  let evs = '???';
  if (ev !== 0) {
    if (ev === MQTT.EV_CONNACK) {
      evs = 'CONNACK';
    } else if (ev === MQTT.EV_PUBLISH) {
      evs = 'PUBLISH';
    } else if (ev === MQTT.EV_PUBACK) {
      evs = 'PUBACK';
    } else if (ev === MQTT.EV_SUBACK) {
      evs = 'SUBACK';
    } else if (ev === MQTT.EV_UNSUBACK) {
      evs = 'UNSUBACK';
    } else if (ev === MQTT.CLOSE) {
      evs = 'CLOSE';
    }
    print('==== MQTT event:', evs);
  }
}, null);

// // Send UART data every second
// Timer.set(1000 /* milliseconds */, Timer.REPEAT, function() {
//   value = !value;
//   UART.write(
//       uartNo,
//       'Hello UART! '
//       + (value ? 'Tick' : 'Tock')
//       + ' uptime: ' + JSON.stringify(Sys.uptime())
//       + ' RAM: ' + JSON.stringify(Sys.free_ram())
//       + (rxAcc.length > 0 ? (' Rx: ' + rxAcc) : '')
//       + '\n'
//   );
//   rxAcc = '';
// }, null);
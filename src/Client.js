// const EventEmitter = require("events");
import ClientError from "./ClientError.js";
import { EventEmitter } from "events";

const DIRECTION_MAP = {
  "+x": "forward",
  "-x": "backward",
  "+y": "right",
  "-y": "left"
};

class Client extends EventEmitter {
  constructor(opts) {
    super();
    this.endpoint = localStorage.getItem("endpoint") || opts.endpoint;
    this.ws = null;
    this.handlers = {
      hello: this._handleHello,
      stateUpdate: this._handleStateChange,
      timeUpdate: this._handleTimeUpdate
    };
  }

  _handleTimeUpdate(data) {
    this.initialControlTime = data.timeLeft;
    this.controlTimeEpoch = data.lastUpdate;
  }

  async _handleHello(data) {
    /*
{
ip: x.x.x.x,
streamURI: "http://localhost:3000/stream.webm",
motors: {
direction: "forward"
},
timeout: 567
controlTime: 0,
regenRate: 0.004,
maxTime: 10000
}
*/
    console.log("hi", this, data);
    this.controlTimeEpoch = new Date().getTime();
    this.direction = data.motor.direction;
    this.initialControlTime = data.controlTime;
    this.maxTime = data.maxTime;
    this.minTime = data.minTime;
    this.regenRate = data.regenRate;
    this.stream = data.streamURI;
    this.audioStream = data.audio;
    this.myDirection = data.motor.me ? data.motor.direction : null;
    this.myDirectionSince = data.motor.me
      ? new Date().getTime() - data.motor.since // It sends a relative time in case our clocks aren't synced (TODO: make the rest of them relative...)
      : null;
  }

  get controlTime() {
    const time =
      this.initialControlTime +
      this.regenRate * (new Date().getTime() - this.controlTimeEpoch);
    if (time >= this.maxTime) return this.maxTime;
    return time;
  }

  setDirection(direction) {
    this.myDirection = direction;
    this.myDirectionSince = new Date().getTime();
    this.send("setDirection", { direction });
  }

  get timeout() {
    const timeout = new Date().getTime() - this.timeoutEpoch;
    return timeout <= 0 ? 0 : timeout;
  }

  _handleStateChange(data) {
    /*
{
direction: "forward",
timeout: 1000
}
*/
    const { direction } = data;

    if (this.myDirection && direction != this.myDirection)
      this.myDirection = null;
    this.direction = direction;
    this.emit("directionChange", direction);
    if (data.timeout) {
      if (this.stimeout) clearTimeout(this.stimeout);
      this.stimeout = setTimeout(() => {
        if (this.direction != null) {
          this.emit("directionChange", null);
          this.direction = null;
        }
      }, data.timeout);
    }
  }

  async _onMessage(msg) {
    const { data } = msg;
    let packet;
    try {
      packet = JSON.parse(data);
    } catch (err) {
      return this.emit(
        "error",
        new ClientError(`Error decoding frame: ${err}`)
      );
    }
    const handler = this.handlers[packet.op];
    if (!handler) {
      return this.emit(
        "error",
        new ClientError(`Recieved unknown OP: ${packet.op}`)
      );
    }
    this.emit(`m_${packet.op}`);
    console.log("<-", packet);
    await handler.apply(this, [packet.d]);
  }

  async login() {
    return await this._wsConnect();
  }

  send(op, data) {
    const frame = JSON.stringify({
      op,
      d: data
    });
    return this.ws.send(frame);
  }

  _handleDisconnect() {
    console.log("oops.");
    this.emit("disconnect");
    return this._wsConnect();
  }

  async _wsConnect() {
    this.ws = new WebSocket(this.endpoint);
    this.ws.addEventListener("message", this._onMessage.bind(this));
    this.ws.addEventListener("disconnect", this._handleDisconnect.bind(this));
    await new Promise(res => this.ws.addEventListener("open", res));
    this.send("identify", {});
    return await new Promise((resolve, reject) => {
      let resolved = false;
      const disconnectListener = () => {
        reject(err);
        this.removeListener("m_hello", helloListener);
      };
      const helloListener = helloData => {
        resolve(helloData);
        this.removeListener("disconnect", disconnectListener);
      };
      this.once("disconnect", disconnectListener);
      this.once("m_hello", helloListener);
    });
  }
}

export default Client;

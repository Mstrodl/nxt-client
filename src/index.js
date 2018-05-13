import Client from "./Client.js";
import "babel-polyfill";
const client = new Client({
  endpoint: "wss://vrrr.strodl.co/ws"
});
window.client = client;
const loginPromise = client.login();

console.log("script loaded, client login initiated");
window.addEventListener("load", async function() {
  const video = document.getElementById("video");
  const videoWrap = video.parentNode;
  console.log("loaded");
  await loginPromise;
  const audio = new Audio(client.audioStream + "?_=" + new Date().getTime());
  console.log("audio!");
  audio.autoplay = true;
  audio.play();
  video.src = client.stream;
  setInterval(() => {
    renderControlTime();
  }, 30); // Every 30 ms, we render the the time remaining in the bar

  client.on("frame", function(stream) {
    video.src = stream;
  });

  video.addEventListener("error", function(err) {
    console.log(err);
    videoWrap.classList = "errored";
  });

  video.addEventListener("load", function() {
    videoWrap.classList = "";
  });

  const controls = ["up", "down", "left", "right"].map(id =>
    document.getElementById(id)
  );
  for (const control of controls) {
    control.addEventListener("mousedown", function(ev) {
      console.log(ev, "down");
      if (ev.button != 0) return; // Not left mouse button
      keydown(`ELEM#${control.id}`, ev);
    });
    control.addEventListener("mouseup", function(ev) {
      console.log("up", ev);
      if (ev.button != 0) return; // Not left mouse button
      keyup(`ELEM#${control.id}`, ev);
    });
  }

  const directionKeyMap = {
    forward: ["w", "ArrowUp", "ELEM#up"],
    backward: ["s", "ArrowDown", "ELEM#down"],
    left: ["a", "ArrowLeft", "ELEM#left"],
    right: ["d", "ArrowRight", "ELEM#right"]
  };
  let downDirection = null;
  document.addEventListener(
    "keydown",
    function(ev) {
      keydown(ev.key, ev);
    },
    true
  );
  function keydown(key, ev) {
    const directionK = Object.entries(directionKeyMap).find(
      ([direction, keys]) => keys.includes(key)
    );
    if (!directionK) return;
    const direction = directionK[0];
    if (!direction) return;
    ev.preventDefault();
    if (client.minTime > client.controlTime)
      return console.log("Skipperoo", client.minTime, client.controlTime);
    if (client.direction && !client.myDirection) return;
    if (downDirection) {
      if (downDirection != direction && client.myDirection) {
        client.setDirection(null);
      } else {
        return;
      }
    }
    downDirection = direction;
    client.setDirection(direction);
  }
  document.addEventListener(
    "keyup",
    function(ev) {
      keyup(ev.key, ev);
    },
    true
  );
  function keyup(key, ev) {
    const directionK = Object.entries(directionKeyMap).find(
      ([direction, keys]) => keys.includes(key)
    );
    if (!directionK) return;
    const direction = directionK[0];
    ev.preventDefault();
    if (client.minTime > client.controlTime)
      return console.log("Skipperoo", client.minTime, client.controlTime);
    if (client.direction && !client.myDirection) return;
    if (client.myDirection && direction == downDirection) {
      client.initialControlTime = liveControlTime();
      client.controlTimeEpoch = new Date().getTime();
      downDirection = null;
      client.setDirection(null);
    }
  }

  const controlBar = document.getElementById("control-bar");
  const controlTime = document.getElementById("control-time");
  const controlPercent = document.getElementById("control-percent");

  // const controls = {
  //   // forward,
  //   // backward,
  //   // left,
  //   // right
  // };

  // function renderControls() {
  //   for (const control in controls) {
  //     if (client.direction == control)
  //       controls[control].classList = "control active";
  //     else controls[control].classList = "control";
  //   }
  // }

  function liveControlTime() {
    return client.myDirection
      ? client.controlTime - (new Date().getTime() - client.myDirectionSince)
      : client.controlTime;
  }

  function renderControlTime() {
    controlBar.classList = "control-bar";
    const percent = liveControlTime() / client.maxTime;
    controlBar.style.width = `calc(${percent} * 100%)`;
    if (client.direction) {
      controlBar.classList += " in-use";
    }
    if (client.minTime > client.controlTime) {
      controlBar.classList += " unusable";
    }
    controlPercent.innerText = Math.round(percent * 100) + "%";
  }
});

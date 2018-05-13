import Client from "./Client.js";
import "babel-polyfill";
const client = new Client({
  endpoint: "wss://vrrr.strodl.co/ws"
});
window.client = client;
const loginPromise = client.login();

console.log("script loaded, client login initiated");
window.addEventListener("load", async function() {
  const videowrap = document.getElementById("videowrap");
  const video = document.createElement("img");
  video.id = "video";
  videowrap.appendChild(video);
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

  const directionKeyMap = {
    forward: ["w", "ArrowUp"],
    backward: ["s", "ArrowDown"],
    left: ["a", "ArrowLeft"],
    right: ["d", "ArrowRight"]
  };
  let downDirection = null;
  document.addEventListener(
    "keydown",
    function(ev) {
      const directionK = Object.entries(directionKeyMap).find(
        ([direction, keys]) => keys.includes(ev.key)
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
    },
    true
  );

  document.addEventListener("keyup", function(ev) {
    const directionK = Object.entries(directionKeyMap).find(
      ([direction, keys]) => keys.includes(ev.key)
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
  });

  const controlBar = document.getElementById("control-bar");
  const controlTime = document.getElementById("control-time");
  const controlPercent = document.getElementById("control-percent");

  const controls = {
    // forward,
    // backward,
    // left,
    // right
  };

  function renderControls() {
    for (const control in controls) {
      if (client.direction == control)
        controls[control].classList = "control active";
      else controls[control].classList = "control";
    }
  }

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

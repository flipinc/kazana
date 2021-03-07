import Websocket from "ws";

/**
 * Since clearTimeout only accepts `number` and ReturnType<typeof setTimeout> does not work, this is a workaround
 * https://stackoverflow.com/questions/45802988/typescript-use-correct-version-of-settimeout-node-vs-window
 */
interface CustomWebsocket extends Websocket {
  pingTimeout?: number;
}

let socket: CustomWebsocket | null = null;

const makeWsConnection = ({
  signature,
  userId,
  orgId,
}: {
  signature: string;
  userId: string;
  orgId: string;
}) => {
  socket = new Websocket(
    `http://localhost:4000/kiki/?type=kazana&signature=${signature}&userId=${userId}&orgId=${orgId}`,
  );

  const heartbeat = () => {
    if (!socket) return; // if previous heartbeat fails, socket will be none

    clearTimeout(socket.pingTimeout);
    socket.pingTimeout = (setTimeout(() => {
      if (!socket) return;
      if (!process.send) return process.exit();

      process.send(JSON.stringify({ action: "kiki-disconnected" }));
      socket.close();
      socket = null;
    }, 30000 + 1000) as unknown) as number;
  };

  socket.onopen = () => {
    if (!process.send) return process.exit();

    process.send(JSON.stringify({ action: "kiki-connected" }));
    heartbeat();
  };

  socket.onclose = () => {
    if (!socket) return;

    clearTimeout(socket.pingTimeout);
    socket = null;
  };

  socket.onmessage = (message) => {
    if (!socket) return;
    if (!process.send) return process.exit();

    const msg = JSON.parse(message.data.toString());
    switch (msg.action) {
      case "ping":
        heartbeat();
        socket.send(JSON.stringify({ action: "pong" }));
        break;
      case "start-talk":
        process.send(message.data);
        break;
      case "end-talk":
        process.send(message.data);
        break;
      default:
        process.send(message.data);
        break;
    }
  };
};

process.on("message", (message) => {
  const msg = JSON.parse(message);

  console.log(msg);

  switch (msg.action) {
    case "login":
      makeWsConnection(msg.payload);
      break;
    case "logout":
      if (socket) {
        socket.close();
        socket = null;
      }
      break;
    default:
      break;
  }
});

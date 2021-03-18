import Websocket from "ws";
import bindings from "bindings";

/**
 * Since clearTimeout only accepts `number` and ReturnType<typeof setTimeout> does not work, this is a workaround
 * https://stackoverflow.com/questions/45802988/typescript-use-correct-version-of-settimeout-node-vs-window
 */
interface CustomWebsocket extends Websocket {
  pingTimeout?: number;
}

/**
 * Websocket connection to KIKI
 *
 * TODO: if connection to kiki fails, retry connection every n seconds
 */
export default class Socket {
  socket: CustomWebsocket | null;

  messageCallback: ((payload: KIKIMessage) => void) | null;

  stream: Stream; // TODO

  constructor() {
    this.socket = null;
    this.messageCallback = null;

    const addon: Wormhole = bindings("wormhole");
    const encoderType = 0; // emformer
    const chunkSize = 20480; // 16000 (sample_rate) x 1.28
    const rightSize = 5120; // 16000 (sample_rate) x 0.32
    this.stream = new addon.Stream(encoderType, chunkSize, rightSize);
    this.stream.getDevices();
  }

  /**
   * Register callbacks
   */
  onMessage(callback: (payload: KIKIMessage) => void) {
    this.messageCallback = callback;
  }

  onBundle(callback: (buffer: Buffer) => void) {
    this.stream.onBundle(callback);
  }

  heartbeat() {
    if (!this.socket) return; // if previous heartbeat fails, socket will be none

    clearTimeout(this.socket.pingTimeout);
    this.socket.pingTimeout = (setTimeout(() => {
      if (!this.socket) return;
      if (this.messageCallback) {
        this.messageCallback({ action: "kiki-disconnected" });
      }

      this.socket.close();
      this.socket = null;
    }, 30000 + 1000) as unknown) as number;
  }

  connect({
    signature,
    userId,
    orgId,
  }: {
    signature: string;
    userId: string;
    orgId: string;
  }) {
    this.socket = new Websocket(
      `http://localhost:4000/kiki/?type=kazana&signature=${signature}&userId=${userId}&orgId=${orgId}`,
    );

    this.socket.onopen = () => {
      if (this.messageCallback) {
        this.messageCallback({ action: "kiki-connected" });
      }

      this.heartbeat();
    };

    this.socket.onclose = () => {
      if (!this.socket) return;

      clearTimeout(this.socket.pingTimeout);
      this.socket = null;
    };

    this.socket.onmessage = (message) => {
      if (!this.socket) return;

      const msg: KIKIMessage = JSON.parse(message.data.toString());
      switch (msg.action) {
        case "ping":
          this.heartbeat();
          this.socket.send(JSON.stringify({ action: "pong" }));
          break;
        case "start-talk":
          this.stream.start();
          break;
        default:
          if (this.messageCallback) {
            this.messageCallback(msg);
          }
          break;
      }
    };
  }

  disconnect() {
    this.stream.stop();
  }

  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

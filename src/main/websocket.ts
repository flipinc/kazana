import Websocket from "ws";

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

  callbacks: { [action in KIKIAction]: ((payload: any) => void) | null };

  constructor() {
    this.socket = null;
    this.callbacks = {
      message: null,
    };
  }

  /**
   * Register callbacks exposed
   * @param action
   * @param callback
   */
  onMessage(callback: (payload: KIKIMessage) => void) {
    this.callbacks.message = callback;
  }

  private execute(action: KIKIAction, message?: KIKIMessage) {
    switch (action) {
      case "message":
        if (!this.callbacks.message) {
          throw Error("Callback for `message` is not registered.");
        }
        this.callbacks.message(message);
        break;
      default:
        break;
    }
  }

  heartbeat() {
    if (!this.socket) return; // if previous heartbeat fails, socket will be none

    clearTimeout(this.socket.pingTimeout);
    this.socket.pingTimeout = (setTimeout(() => {
      if (!this.socket) return;

      this.execute("message", { action: "kiki-disconnected" });
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
      this.execute("message", { action: "kiki-connected" });
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
        default:
          this.execute("message", msg);
          break;
      }
    };
  }

  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

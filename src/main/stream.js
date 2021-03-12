const child_process = require("child_process");
const { PythonShell } = require("python-shell");

/** `true` means on, `false` means off and `undefined` means unable to use */
// type StreamStates = {
//   loopbackState?: boolean;
//   microphoneState?: boolean;
//   pokariState?: boolean;
// };

/**
 * A wrapper around audio APIs
 */
class Stream {
  // platform: string;

  // child: child_process.ChildProcessWithoutNullStreams | null;

  constructor(platform) {
    this.platform = platform;
    this.child = null;
  }

  start() {
    if (this.platform === "linux") {
      const pyshell = new PythonShell("engine/pulseaudio/stream.py");

      pyshell.on("message", (data) => {
        console.log(data);
      });

      pyshell.send("HELLO");
    } else {
      throw Error(`${this.platform} is not supported yet.`);
    }
  }
}

const stream = new Stream("linux");
stream.start();

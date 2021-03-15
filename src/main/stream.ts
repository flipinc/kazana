import addon from "bindings";

const encoderType = 0;
const chunkSize = 20480
const rightSize = 5120

Stream = new wormhole.addon.Stream(encoderType, chunkSize, rightSize);

Stream.onRecognize((msg) => console.log(msg)))

Stream.start();

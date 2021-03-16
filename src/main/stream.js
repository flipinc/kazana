const addon = require("../../build/Release/wormhole")

const encoderType = 0;
const chunkSize = 20480
const rightSize = 5120

const Stream = new addon.Stream(encoderType, chunkSize, rightSize, 4);

Stream.onRecognize((msg) => console.log(msg));

Stream.start();

// Stream.stop();
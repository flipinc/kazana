const addon = require("../../build/Release/wormhole")

const encoderType = 0; // emformer
const chunkSize = 20480 // 16000 (sample_rate) x 1.28
const rightSize = 5120 // 16000 (sample_rate) x 0.32

const Stream = new addon.Stream(encoderType, chunkSize, rightSize, 4);

Stream.onRecognize((msg) => console.log(msg));

Stream.start();

// Stream.stop();
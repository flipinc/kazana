const addon = require("../../build/Release/wormhole")

const encoderType = 0; // emformer
const chunkSize = 20480 // 16000 (sample_rate) x 1.28
const rightSize = 5120 // 16000 (sample_rate) x 0.32

const stream = new addon.Stream(encoderType, chunkSize, rightSize, 4);

stream.onRecognize((msg) => console.log(msg));

devices = stream.getDevices();
console.log(devices)

defaultInput = stream.getDefaultInputDevice()
console.log(defaultInput)

defaultOutput = stream.getDefaultOutputDevice()
console.log(defaultOutput)

stream.start();

module.exports = stream;
// Stream.stop();
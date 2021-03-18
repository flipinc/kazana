const addon = require("../../out/Release/wormhole.node")

const encoderType = 0; // emformer
const chunkSize = 20480; // 16000 (sample_rate) x 1.28
const rightSize = 5120; // 16000 (sample_rate) x 0.32

const stream = new addon.Stream(encoderType, chunkSize, rightSize);

stream.getDevices();
stream.onBundle((buffer) => {
    console.log(buffer.byteLength)
    // https://stackoverflow.com/questions/49132819/reading-raw-bytes-from-a-c-float-array-in-javascript-conversion-to-js-array
    console.log(buffer.readFloatLE())
    // pythonに送る流れ
    // https://stackoverflow.com/questions/37330746/javascript-smallest-json-stringify-for-float32array
    // https://stackoverflow.com/questions/57367036/pass-a-pickle-buffer-from-node-to-python
})

stream.start();

module.exports = stream

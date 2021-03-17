type EncoderType = 0 | 1

type Wormhole = {
  Stream: typeof Stream;
};

class Stream {
    encoderType: EncoderType
    chunkSize: int
    rightSize: int
  
    constructor(encoderType: EncoderType, chunkSize: int, rightSize: int)
  
    start()
    stop()
  
    onRecognize(callback: (transcript: string) => void)
  }
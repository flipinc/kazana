type EncoderType = 0 | 1;
type DeviceType = "microphone" | "loopback";

type Wormhole = {
  Stream: typeof Stream;
};

class Stream {
  /**
   * Constructor that sets default microphone, and loopback if possible.
   *
   * Supported platforms and its channels on rtaudio:
   * - Linux -> Microphone only
   * - Windows -> Microphone and Loopback
   * - macOS -> Microphone Only
   *
   * @param encoderType
   * @param chunkSize Chunk context size. Used for Emformer only.
   * @param rightSize Right context size. Used for Emformer only.
   */
  constructor(encoderType: EncoderType, chunkSize: int, rightSize: int);

  /**
   * Starts recording and recognition
   */
  start();
  /**
   * Stops recording and recognition
   */
  stop();

  /**
   * An event fired when recognition result is received
   *
   * @param callback
   */
  onBundle(callback: (buffer: Buffer) => void);

  /**
   * Set a target microphone device as microphone
   *
   * @param deviceType
   * @param deviceId
   */
  setDevice(deviceType: DeviceType, deviceId: int);
  /**
   * Get all availabel devices
   */
  getDevices();

  getDefaultInputDevice();
  getDefaultOutputDevice();
}

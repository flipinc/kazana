#include <thread>
#include <locale>
#include <codecvt>
#include <vector>
#include <array>

#include <napi.h>
#include <RtAudio.h>

#include "stream.h"

extern "C" {
#include "tensorflow/lite/c/c_api.h"
}

#if defined(_WIN32) || defined(_WIN64)
    #define PLATFORM_NAME "windows"
#elif defined(__APPLE__) && defined(__MACH__)
    #define PLATFORM_NAME "macos"
#elif defined(__linux__)
    #define PLATFORM_NAME "linux"
#else
    #define PLATFORM_NAME NULL
#endif

// from http://www.zedwood.com/article/cpp-utf8-char-to-codepoint
std::string upointToString(int cp) {
    char c[5]={ 0x00,0x00,0x00,0x00,0x00 };
    if     (cp<=0x7F) { c[0] = cp;  }
    else if(cp<=0x7FF) { c[0] = (cp>>6)+192; c[1] = (cp&63)+128; }
    else if(0xd800<=cp && cp<=0xdfff) {} //invalid block of utf8
    else if(cp<=0xFFFF) { c[0] = (cp>>12)+224; c[1]= ((cp>>6)&63)+128; c[2]=(cp&63)+128; }
    else if(cp<=0x10FFFF) { c[0] = (cp>>18)+240; c[1] = ((cp>>12)&63)+128; c[2] = ((cp>>6)&63)+128; c[3]=(cp&63)+128; }
    return std::string(c);
}

template <typename T>
Napi::Array arrayFromVector(Napi::Env env, std::vector<T> items) {
    Napi::Array array = Napi::Array::New(env, items.size());

    // For each element, convert it to Napi::Value and add it
    for (int i = 0; i < items.size(); i++) {
        array[i] = Napi::Value::From(env, items[i]);
    }

    return array;
};

/**
 * Note: if input_data_size != TfLiteTensorByteSize(tensor), the interpreter does not give any error,
 * instead it outputs 0 for upoint every time. This makes it really hard to debug.
 */
void Stream::recognize() {
    std::unique_lock microphoneLock(microphoneMutex, std::defer_lock);

    while (1) {
        microphoneLock.lock();
        hasDataArrived.wait(microphoneLock);

        TfLiteTensor* signalIt = TfLiteInterpreterGetInputTensor(interpreter, 0);
        unsigned int signalLength = TfLiteTensorDim(signalIt, 0);
        TfLiteTensorCopyFromBuffer(signalIt, microphoneSignal, signalLength * sizeof(float));

        microphoneLock.unlock();

        TfLiteTensor* prevTokenIt = TfLiteInterpreterGetInputTensor(interpreter, 1);
        TfLiteTensorCopyFromBuffer(prevTokenIt, &prevToken, 1 * sizeof(int));

        TfLiteTensor* encoderStatesIt = TfLiteInterpreterGetInputTensor(interpreter, 2);
        TfLiteTensorCopyFromBuffer(encoderStatesIt, &encoderStates, 2 * 18 * 1 * 20 * 8 * 64 * sizeof(float));

        TfLiteTensor* predictorStatesIt = TfLiteInterpreterGetInputTensor(interpreter, 3);
        TfLiteTensorCopyFromBuffer(predictorStatesIt, &predictorStates, 1 * 2 * 1 * 512 * sizeof(float));

        TfLiteInterpreterInvoke(interpreter);

        const TfLiteTensor* upointsOt = TfLiteInterpreterGetOutputTensor(interpreter, 0);
        unsigned int upointLength = TfLiteTensorDim(upointsOt, 0);
        int upoints[upointLength];
        TfLiteTensorCopyToBuffer(upointsOt, upoints, upointLength * sizeof(int));

        const TfLiteTensor* prevTokenOt = TfLiteInterpreterGetOutputTensor(interpreter, 1);
        TfLiteTensorCopyToBuffer(prevTokenOt, &prevToken, 1 * sizeof(unsigned int));

        const TfLiteTensor* encoderStatesOt = TfLiteInterpreterGetOutputTensor(interpreter, 2);
        TfLiteTensorCopyToBuffer(encoderStatesOt, &encoderStates, 2 * 18 * 1 * 20 * 8 * 64 * sizeof(float));

        const TfLiteTensor* predictorStatesOt = TfLiteInterpreterGetOutputTensor(interpreter, 3);
        TfLiteTensorCopyToBuffer(predictorStatesOt, &predictorStates, 1 * 2 * 1 * 512 * sizeof(float));

        std::string result = "";
        for(unsigned int i=0; i < upointLength; i++) {
            result = result + upointToString(upoints[i]);
        }

        recognizeCallback.NonBlockingCall([result](Napi::Env env, Napi::Function callback) {
            callback.Call({Napi::String::New(env, result)});
        });
    }
}

int emformer_listen(void* outputBuffer, void *inputBuffer, unsigned int numFrames, double streamTime, RtAudioStreamStatus status, void *userData) {
    Stream *stream = (Stream *)userData;

    float *data = (float *) inputBuffer;

    std::unique_lock microphoneLock(stream->microphoneMutex, std::defer_lock);

    // verify frame size
    if (numFrames != stream->chunkSize) return 0;

    microphoneLock.lock();

    memcpy(stream->microphoneSignal, stream->futureMicrophoneSignal, sizeof(float) * stream->rightSize);
    memcpy(stream->microphoneSignal + stream->rightSize, data, sizeof(float) * numFrames);
    memcpy(stream->futureMicrophoneSignal, data + (numFrames-stream->rightSize), sizeof(float) * stream->rightSize);

    // Manual unlocking is done before notifying, to avoid waking up the waiting thread only to block again
    microphoneLock.unlock();
    stream->hasDataArrived.notify_one();
    
    return 0;
}

Napi::Object Stream::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "Stream", {
        InstanceMethod("onRecognize", &Stream::onRecognize),
        InstanceMethod("getDevices", &Stream::getDevices),
        InstanceMethod("getDefaultInputDevice", &Stream::getDefaultInputDevice),
        InstanceMethod("getDefaultOutputDevice", &Stream::getDefaultOutputDevice),
        InstanceMethod("start", &Stream::start),
        InstanceMethod("stop", &Stream::stop),
    });

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);

    // NOTE: this assumes only 1 class is exported for multiple exported classes, 
    // need a struct or other mechanism.
    // ignore warning on SetInstanceData. this happens in Node 14
    // ref: https://github.com/electron/electron/issues/24248
    env.SetInstanceData(constructor); 

    exports.Set("Stream", func);
    return exports;
}

/**
 * Constructor for Stream Class
 */
Stream::Stream(const Napi::CallbackInfo& info) : 
    Napi::ObjectWrap<Stream>(info),
    encoderType((Encoder)(int)info[0].As<Napi::Number>()),
    chunkSize((unsigned int)info[1].As<Napi::Number>()),
    rightSize((unsigned int)info[2].As<Napi::Number>()),
    segmentSize(chunkSize + rightSize)
{
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::Error::New(env, "Expected two arguments; `numFrames` and `encoderType`.").ThrowAsJavaScriptException();
        return;
    }

    const char* model_path = "/home/keisuke26/Documents/Chief/ekaki/kazana/pokari/emformer_char3265_mini_stack.tflite";
    model = TfLiteModelCreateFromFile(model_path);
    if (model == nullptr) {
        Napi::Error::New(env, "Model could not be loaded.").ThrowAsJavaScriptException();
        return;
    }

    microphoneSignal = new float[segmentSize]{};

    options = TfLiteInterpreterOptionsCreate();
    TfLiteInterpreterOptionsSetNumThreads(options, 2);
    
    interpreter = TfLiteInterpreterCreate(model, options);
    if (interpreter == nullptr) {
        Napi::Error::New(env, "Failed initializing tflite interpreter.").ThrowAsJavaScriptException();
        return;
    }
    
    TfLiteInterpreterResizeInputTensor(interpreter, 0, (int *)(&segmentSize), 1);
    TfLiteInterpreterAllocateTensors(interpreter);

    rtAudio = std::make_shared<RtAudio>();

    // microphone
    RtAudio::StreamParameters parameters;
    parameters.deviceId = rtAudio->getDefaultOutputDevice();
    parameters.nChannels = 1;
    unsigned int sampleRate = 16000;
    
    if(encoderType == Encoder::EMFORMER) {
        unsigned int numFrames = chunkSize;
        futureMicrophoneSignal = new float[rightSize]{};

        try {
            rtAudio->openStream(NULL, &parameters, RTAUDIO_FLOAT32, sampleRate, &numFrames, &emformer_listen, this);
        } catch(RtAudioError& e) {
            Napi::Error::New(env, e.getMessage()).ThrowAsJavaScriptException();
            return;
        }
    } else {
        Napi::Error::New(env, "This encoder is not supported yet.").ThrowAsJavaScriptException();
        return;
    }
}

/**
 * Destructor for Stream Class
 */
Stream::~Stream() {
    std::cout << "Running destructor..." << std::endl;

    delete microphoneSignal;
    delete futureMicrophoneSignal;

    if ( rtAudio->isStreamOpen() ) rtAudio->closeStream();

    TfLiteInterpreterDelete(interpreter);
    TfLiteInterpreterOptionsDelete(options);
    TfLiteModelDelete(model);
}

Napi::Value Stream::getDevices(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
	Napi::Array devicesArray;
	std::vector<RtAudio::DeviceInfo> devices;

	// Determine the number of devices available
	unsigned int deviceCount = rtAudio->getDeviceCount();

	// Scan through devices for various capabilities
	RtAudio::DeviceInfo device;
	for (unsigned int i = 0; i < deviceCount; i++)
	{
		// Get the device's info
		device = rtAudio->getDeviceInfo(i);

		// If the device is probed
		if (device.probed) {
			devices.push_back(device);
		}
	}

	// Allocate the devices array
	devicesArray = Napi::Array::New(env, devices.size());

	// Convert the devices to objects
	for (unsigned int i = 0; i < devices.size(); i++) {
        Napi::Object devInfo = Napi::Object::New(env);

        // Set all properties in the object
        devInfo.Set("name", devices[i].name);
        devInfo.Set("outputChannels", devices[i].outputChannels);
        devInfo.Set("inputChannels", devices[i].inputChannels);
        devInfo.Set("duplexChannels", devices[i].duplexChannels);
        devInfo.Set("isDefaultOutput", devices[i].isDefaultOutput);
        devInfo.Set("isDefaultInput", devices[i].isDefaultInput);
        devInfo.Set("sampleRates", arrayFromVector(env, devices[i].sampleRates));
        devInfo.Set("preferredSampleRate", devices[i].preferredSampleRate);
        devInfo.Set("nativeFormats", devices[i].nativeFormats);

        devicesArray[i] = devInfo;
	}

	return devicesArray;
}

Napi::Value Stream::getDefaultInputDevice(const Napi::CallbackInfo &info) {
	return Napi::Number::New(info.Env(), rtAudio->getDefaultInputDevice());
}

Napi::Value Stream::getDefaultOutputDevice(const Napi::CallbackInfo &info) {
	return Napi::Number::New(info.Env(), rtAudio->getDefaultOutputDevice());
}

void Stream::onRecognize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    Napi::Function _recognizeCallback = info[0].As<Napi::Function>();

    if (recognizeCallback != nullptr) {
        recognizeCallback.Release();
    }

    recognizeCallback = Napi::ThreadSafeFunction::New(env, _recognizeCallback, "recognizeCallback", 0, 1);
}

void Stream::start(const Napi::CallbackInfo& info) {
    /**
     * If a target device does not support target format, RtAudio automatically
     * converts native format to target format.
     * 
     * Duplex streams run on one thread whereas two streams run by two instances run on
     * two threads
     * 
     * BufferFrames is preferred to be a power of two
     * 
     * ref: https://www.music.mcgill.ca/~gary/rtaudio/settings.html
     */
    Napi::Env env = info.Env();

    if (recognizeCallback == nullptr) {
        Napi::Error::New(env, "Recognize callback must be set before starting.").ThrowAsJavaScriptException();
        return;
    }
    
    std::thread recognizeThread(&Stream::recognize, this);
    recognizeThread.detach();

    try {
        rtAudio->startStream();
    } catch(RtAudioError& e) {
        Napi::Error::New(env, e.getMessage()).ThrowAsJavaScriptException();
        return;
    }
}

void Stream::stop(const Napi::CallbackInfo& info) {
    std::cout << "Stream has been stopped." << std::endl;

    if (rtAudio->isStreamOpen()) rtAudio->closeStream();
}
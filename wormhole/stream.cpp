#include <thread>
#include <vector>

#include <napi.h>
#include <RtAudio.h>

#include "stream.h"

void log(std::string msg) {
    std::cout << msg << std::endl;
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
 * In the future, it may be possible for some computational intensive 
 * tasks to be added in this function. And since, adding computational intensive task inside rtaudio
 * callback is not a good practice, this function is separeted,
 */
void Stream::bundle() {
    std::unique_lock microphoneLock(microphoneMutex, std::defer_lock);

    while (1) {
        microphoneLock.lock();
        hasDataArrived.wait(microphoneLock);

        if (isMicrophoneEnabled && isLoopbackEnabled) {
            memcpy(bundledSignal->data(), microphoneSignal->data(), sizeof(float) * segmentSize);
            memcpy(bundledSignal->data() + segmentSize, loopbackSignal->data(), sizeof(float) * segmentSize);
            bundleCallback.NonBlockingCall([this](Napi::Env env, Napi::Function callback) {
                // Unlike memcpy, last argument of Napi::Buffer<T>::Copy is number of <T> elements
                // Also, Napi::Array is not very efficient compared to Buffer
                // https://github.com/nodejs/node-addon-api/issues/405#issuecomment-446564026
                callback.Call({Napi::Buffer<float>::Copy(env, bundledSignal->data(), segmentSize*2)});
            });
        } else if (isMicrophoneEnabled) {
            bundleCallback.NonBlockingCall([this](Napi::Env env, Napi::Function callback) {
                callback.Call({Napi::Buffer<float>::Copy(env, microphoneSignal->data(), segmentSize)});
            });
        } else if (isLoopbackEnabled) {
            bundleCallback.NonBlockingCall([this](Napi::Env env, Napi::Function callback) {
                callback.Call({Napi::Buffer<float>::Copy(env, loopbackSignal->data(), segmentSize)});
            });
        }

        microphoneLock.unlock();
    }
}

int emformer_microphone_listen(void* outputBuffer, void *inputBuffer, unsigned int numFrames, double streamTime, RtAudioStreamStatus status, void *userData) {
    Stream *stream = (Stream *)userData;

    float *data = (float *) inputBuffer;

    std::unique_lock microphoneLock(stream->microphoneMutex, std::defer_lock);

    // verify frame size
    if (numFrames != stream->chunkSize) return 0;

    microphoneLock.lock();

    memcpy(stream->microphoneSignal->data(), stream->futureMicrophoneSignal->data(), sizeof(float) * stream->rightSize);
    memcpy(stream->microphoneSignal->data() + stream->rightSize, data, sizeof(float) * numFrames);
    memcpy(stream->futureMicrophoneSignal->data(), data + (numFrames-stream->rightSize), sizeof(float) * stream->rightSize);

    // Manual unlocking is done before notifying, to avoid waking up the waiting thread only to block again
    microphoneLock.unlock();
    stream->hasDataArrived.notify_one();
    
    return 0;
}

int emformer_loopback_listen(void* outputBuffer, void *inputBuffer, unsigned int numFrames, double streamTime, RtAudioStreamStatus status, void *userData) {
    Stream *stream = (Stream *)userData;

    float *data = (float *) inputBuffer;

    std::unique_lock loopbackLock(stream->loopbackMutex, std::defer_lock);

    // verify frame size
    if (numFrames != stream->chunkSize) return 0;

    loopbackLock.lock();

    memcpy(stream->loopbackSignal->data(), stream->futureLoopbackSignal->data(), sizeof(float) * stream->rightSize);
    memcpy(stream->loopbackSignal->data() + stream->rightSize, data, sizeof(float) * numFrames);
    memcpy(stream->futureLoopbackSignal->data(), data + (numFrames-stream->rightSize), sizeof(float) * stream->rightSize);

    loopbackLock.unlock();
    // Notifying is only done on microphone side. This assumes callback interval between loopback and microphone
    // is fully synchronized. Otherwise, it will result in missing audio frames. 
    if (!stream->isMicrophoneEnabled) {
        stream->hasDataArrived.notify_one();
    }
    
    return 0;
}

Napi::Object Stream::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "Stream", {
        InstanceMethod("onBundle", &Stream::onBundle),
        InstanceMethod("setDevice", &Stream::setDevice),
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

    exports.Set(Napi::String::New(env, "Stream"), func);
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

    unsigned int sampleRate = 16000;
    
    RtAudio::StreamParameters loopbackParameters;
    RtAudio::StreamParameters microphoneParameters;

    rtAudio = std::make_shared<RtAudio>();

    // even when rtAudio founds no device, getDefaultInputDevice returns 0 which is
    // a valid audio deviceId. So, check if a device truly exists when calling
    // `openStream`.
    microphoneDeviceId = rtAudio->getDefaultInputDevice();

    microphoneParameters.deviceId = microphoneDeviceId;
    microphoneParameters.nChannels = 1;

    // loopback
    std::vector<RtAudio::Api> audioApis{ RtAudio::Api::LINUX_PULSE, RtAudio::Api::WINDOWS_WASAPI };
    RtAudio::getCompiledApi(audioApis);
    if (
        std::find(audioApis.begin(), audioApis.end(), RtAudio::Api::LINUX_PULSE) != audioApis.end() ||
        std::find(audioApis.begin(), audioApis.end(), RtAudio::Api::WINDOWS_WASAPI) != audioApis.end() 
    ) {
        loopbackRtAudio = std::make_shared<RtAudio>();

        loopbackDeviceId = loopbackRtAudio->getDefaultOutputDevice();

        loopbackParameters.deviceId = loopbackDeviceId;
        loopbackParameters.nChannels = 1;
        isLoopbackEnabled = true;
    }
    
    if(encoderType == Encoder::EMFORMER) {
        unsigned int numFrames = chunkSize;

        try {
            rtAudio->openStream(NULL, &microphoneParameters, RTAUDIO_FLOAT32, sampleRate, &numFrames, &emformer_microphone_listen, this);

            microphoneSignal = std::make_shared<std::vector<float>>(segmentSize, 0);
            futureMicrophoneSignal = std::make_shared<std::vector<float>>(rightSize, 0);

            log("Successfully opened microphone.");
        } catch(RtAudioError& e) {
            isMicrophoneEnabled = false;

            log(e.getMessage()); // Do not throw error here as some errors are expected
        }

        isMicrophoneEnabled = false;

        if (isLoopbackEnabled) {
            try {
                loopbackRtAudio->openStream(NULL, &loopbackParameters, RTAUDIO_FLOAT32, sampleRate, &numFrames, &emformer_loopback_listen, this);

                loopbackSignal = std::make_shared<std::vector<float>>(segmentSize, 0);
                futureLoopbackSignal = std::make_shared<std::vector<float>>(rightSize, 0);                

                log("Successfully opened loopback.");
            } catch(RtAudioError& e) {
                isLoopbackEnabled = false;

                log(e.getMessage()); // Do not throw error here as some errors are expected
            }
        }
    } else {
        Napi::Error::New(env, "This encoder is not supported yet.").ThrowAsJavaScriptException();
        return;
    }

    // initialize bundledSignal
    if (isMicrophoneEnabled && isLoopbackEnabled) {
        bundledSignal = std::make_shared<std::vector<float>>(2*segmentSize, 0);
    } else if (!isMicrophoneEnabled && !isLoopbackEnabled) {
        Napi::Error::New(env, "No available devices.").ThrowAsJavaScriptException();
        return;
    }
}

/**
 * Destructor for Stream Class
 */
Stream::~Stream() {
    log("Running destructor...");

    if (rtAudio->isStreamOpen()) rtAudio->closeStream();
    if (isLoopbackEnabled && loopbackRtAudio->isStreamOpen()) {
        loopbackRtAudio->closeStream();
    }
}

Napi::Value Stream::getDevices(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
	Napi::Array devicesArray;
	std::vector<RtAudio::DeviceInfo> devices;

	// Determine the number of devices available
	unsigned int deviceCount = rtAudio->getDeviceCount();

	// Scan through devices for various capabilities
	RtAudio::DeviceInfo device;
	for (unsigned int i = 0; i < deviceCount; i++) {
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

void Stream::setDevice(const Napi::CallbackInfo &info) {

}

Napi::Value Stream::getDefaultInputDevice(const Napi::CallbackInfo &info) {
	return Napi::Number::New(info.Env(), rtAudio->getDefaultInputDevice());
}

Napi::Value Stream::getDefaultOutputDevice(const Napi::CallbackInfo &info) {
	return Napi::Number::New(info.Env(), rtAudio->getDefaultOutputDevice());
}

void Stream::onBundle(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    Napi::Function _bundleCallback = info[0].As<Napi::Function>();

    if (bundleCallback != nullptr) {
        bundleCallback.Release();
    }

    bundleCallback = Napi::ThreadSafeFunction::New(env, _bundleCallback, "bundleCallback", 0, 1);
}

/**
 * Some info about how rtAudio works:
 * - If a target device does not support target format, RtAudio automatically
 * converts native format to target format.
 * - Duplex streams run on one thread whereas two streams run by two instances run on
 * two threads
 * - BufferFrames is preferred to be a power of two
 * https://www.music.mcgill.ca/~gary/rtaudio/settings.html
 * 
 */
void Stream::start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (bundleCallback == nullptr) {
        Napi::Error::New(env, "Bundle callback must be set before starting.").ThrowAsJavaScriptException();
        return;
    }
    
    std::thread bundleThread(&Stream::bundle, this);
    // keep it running in background
    bundleThread.detach();

    try {
        if (isMicrophoneEnabled) {
            log("Microphone stream has been started.");

            rtAudio->startStream();
        }

        if (isLoopbackEnabled) {
            log("Loopback stream has been started.");

            loopbackRtAudio->startStream();
        }
    } catch(RtAudioError& e) {
        Napi::Error::New(env, e.getMessage()).ThrowAsJavaScriptException();
        return;
    }
}

void Stream::stop(const Napi::CallbackInfo& info) {
    log("Stream has been stopped.");

    if (rtAudio->isStreamOpen()) rtAudio->closeStream();
    if (isLoopbackEnabled && loopbackRtAudio->isStreamOpen()) {
        loopbackRtAudio->closeStream();
    }
}
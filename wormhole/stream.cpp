#include <thread>
#include <locale>
#include <codecvt>
#include <vector>

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

void Stream::recognize() {
    // const TfLiteTensor* upoints_ot = TfLiteInterpreterGetOutputTensor(interpreter, 0);
    // TfLiteTensorCopyToBuffer(upoints_ot, upoints, output.size() * sizeof(unsigned int));

    // const TfLiteTensor* prev_token_ot = TfLiteInterpreterGetOutputTensor(interpreter, 1);
    // TfLiteTensorCopyToBuffer(prev_token_ot, prev_token, output.size() * sizeof(unsigned int));

    // const TfLiteTensor* encoder_states_ot = TfLiteInterpreterGetOutputTensor(interpreter, 2);
    // TfLiteTensorCopyToBuffer(encoder_states_ot, encoder_states, output.size() * sizeof(float));

    // const TfLiteTensor* predictor_states_ot = TfLiteInterpreterGetOutputTensor(interpreter, 3);
    // TfLiteTensorCopyToBuffer(predictor_states_ot, predictor_states, output.size() * sizeof(float));

    std::unique_lock microphoneLock(microphoneMutex, std::defer_lock);

    while (1) {
        microphoneLock.lock();
        hasDataArrived.wait(microphoneLock);

        TfLiteTensor* signal_it = TfLiteInterpreterGetInputTensor(interpreter, 0);
        TfLiteTensorCopyFromBuffer(signal_it, &microphoneSignal, microphoneSignal.size() * sizeof(float));

        microphoneLock.unlock();

        TfLiteTensor* prev_token_it = TfLiteInterpreterGetInputTensor(interpreter, 1);
        TfLiteTensorCopyFromBuffer(prev_token_it, &prev_token, 1 * sizeof(int));

        TfLiteTensor* encoder_states_it = TfLiteInterpreterGetInputTensor(interpreter, 2);
        TfLiteTensorCopyFromBuffer(encoder_states_it, &encoder_states, 8 * 2 * 1 * 1024 * sizeof(float));

        TfLiteTensor* predictor_states_it = TfLiteInterpreterGetInputTensor(interpreter, 3);
        TfLiteTensorCopyFromBuffer(predictor_states_it, &predictor_states, 1 * 2 * 1 * 512 * sizeof(float));

        TfLiteInterpreterInvoke(interpreter);

        std::string ouput = upointToString(68);

        recognizeCallback.NonBlockingCall([ouput](Napi::Env env, Napi::Function callback) {
            callback.Call({Napi::String::New(env, ouput)});
        });
    }
}

int emformer_listen(void* outputbuffer, void *inputbuffer, unsigned int numFrames, double streamTime, RtAudioStreamStatus status, void *userData) {
    std::cout << "Receiving..." << std::endl;

    Stream *stream = (Stream *)userData;

    float *data = (float *) inputbuffer;

    std::unique_lock microphoneLock(stream->microphoneMutex, std::defer_lock);

    // verify frame size
    if (numFrames != stream->chunkSize) return 0;

    microphoneLock.lock();

    // TODO: this is definitely not the fastest way to copy
    for (unsigned int i=0; i < (numFrames + stream->rightSize); i++) {
        if (i < stream->rightSize) {
            stream->microphoneSignal[i] = stream->futureMicrophoneSignal[i];
            continue;
        }
        stream->microphoneSignal[i] = data[i];
    }
    stream->futureMicrophoneSignal = std::vector<float>(stream->microphoneSignal.end() - stream->rightSize, stream->microphoneSignal.end());

    // Manual unlocking is done before notifying, to avoid waking up the waiting thread only to block again
    microphoneLock.unlock();
    stream->hasDataArrived.notify_one();
    
    return 0;
}

Napi::Object Stream::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "Stream", {
        InstanceMethod("onRecognize", &Stream::onRecognize),
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

    const char* model_path = "/home/keisuke26/Documents/Chief/ekaki/kazana/pokari/rnnt_char.tflite";
    model = TfLiteModelCreateFromFile(model_path);
    if (model == nullptr) {
        Napi::Error::New(env, "Model could not be loaded.").ThrowAsJavaScriptException();
        return;
    }

    microphoneSignal = std::vector<float>(segmentSize, 0);

    options = TfLiteInterpreterOptionsCreate();
    TfLiteInterpreterOptionsSetNumThreads(options, 2);
    
    interpreter = TfLiteInterpreterCreate(model, options);
    if (interpreter == nullptr) {
        Napi::Error::New(env, "Failed initializing tflite interpreter.").ThrowAsJavaScriptException();
        return;
    }
    
    TfLiteInterpreterResizeInputTensor(interpreter, 0, (int*)(&segmentSize), 1);
    TfLiteInterpreterAllocateTensors(interpreter);

    rtAudio = std::make_shared<RtAudio>();

    // microphone
    RtAudio::StreamParameters parameters;
    parameters.deviceId = rtAudio->getDefaultInputDevice();
    parameters.nChannels = 1;
    unsigned int sampleRate = 16000;
    
    if(encoderType == Encoder::EMFORMER) {
        unsigned int numFrames = chunkSize;
        
        futureMicrophoneSignal = std::vector<float>(rightSize, 0);        

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

    if ( rtAudio->isStreamOpen() ) rtAudio->closeStream();

    TfLiteInterpreterDelete(interpreter);
    TfLiteInterpreterOptionsDelete(options);
    TfLiteModelDelete(model);
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
     * duplex streams run on one thread whereas two streams run by two instances run on
     * two threads
     * 
     * bufferFrames must be a power of two
     * 
     * ref: https://www.music.mcgill.ca/~gary/rtaudio/settings.html
     */

    // 0 If stream is already running do nothing

    // 1.1 Initialize microphone device

    // 1.2 Chech if default microphone device has 16000Hz in supported sample rates
    // if not, use the default sample rate

    // 2.1 Check if the platform is Windows and supports WASAPI
    // if not, skip 2

    // 2.2 Initialize loopback device

    // 2.3 Chech if default loopback device has 16000Hz in supported sample rates
    // if not, use the default sample rate

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

    if ( rtAudio->isStreamOpen() ) rtAudio->closeStream();
}
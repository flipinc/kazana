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


// TODO: this method has to be run on single thread
void Stream::recognize(void* signal, void* prev_token, void* encoder_states, void* predictor_states, void* upoints) {
    // if data in any of queue, wake up and run

    // TfLiteTensor* signal_it = TfLiteInterpreterGetInputTensor(interpreter, 0);
    // TfLiteTensorCopyFromBuffer(signal_it, signal, signal.size() * sizeof(float));

    // TfLiteTensor* prev_token_it = TfLiteInterpreterGetInputTensor(interpreter, 1);
    // TfLiteTensorCopyFromBuffer(prev_token_it, prev_token, input.size() * sizeof(float));

    // TfLiteTensor* encoder_states_it = TfLiteInterpreterGetInputTensor(interpreter, 2);
    // TfLiteTensorCopyFromBuffer(encoder_states_it, encoder_states, input.size() * sizeof(float));

    // TfLiteTensor* predictor_states_it = TfLiteInterpreterGetInputTensor(interpreter, 3);
    // TfLiteTensorCopyFromBuffer(predictor_states_it, predictor_states, input.size() * sizeof(float));

    // TfLiteInterpreterInvoke(interpreter);

    // const TfLiteTensor* upoints_ot = TfLiteInterpreterGetOutputTensor(interpreter, 0);
    // TfLiteTensorCopyToBuffer(upoints_ot, upoints, output.size() * sizeof(unsigned int));

    // const TfLiteTensor* prev_token_ot = TfLiteInterpreterGetOutputTensor(interpreter, 1);
    // TfLiteTensorCopyToBuffer(prev_token_ot, prev_token, output.size() * sizeof(unsigned int));

    // const TfLiteTensor* encoder_states_ot = TfLiteInterpreterGetOutputTensor(interpreter, 2);
    // TfLiteTensorCopyToBuffer(encoder_states_ot, encoder_states, output.size() * sizeof(float));

    // const TfLiteTensor* predictor_states_ot = TfLiteInterpreterGetOutputTensor(interpreter, 3);
    // TfLiteTensorCopyToBuffer(predictor_states_ot, predictor_states, output.size() * sizeof(float));

    recognizeCallback.NonBlockingCall([](Napi::Env env, Napi::Function callback) {
        std::string output = "HELLO??";
        callback.Call({Napi::String::New(env, output)});
    });
}

int listen(void* outputbuffer, void *inputbuffer, unsigned int numFrames, double streamTime, RtAudioStreamStatus status, void *userData) {

    // put data to queue (given by userData)

    return 0;
}

Napi::Object Stream::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "Stream", {
        InstanceMethod("onRecognize", &Stream::onRecognize),
        InstanceMethod("start", &Stream::start),
        InstanceMethod("stop", &Stream::stop),
        InstanceMethod("test", &Stream::test),
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

    if(encoderType == Encoder::EMFORMER) {
        // TODO: get these params as one object instead of separate arguments
    } else {
        Napi::Error::New(env, "This encoder is not supported yet.").ThrowAsJavaScriptException();
        return;
    }

    // an example can be found in
    // https://github.com/tensorflow/tensorflow/blob/master/tensorflow/lite/c/c_api.h
    // for local
    const char* model_path = "/home/keisuke26/Documents/Chief/ekaki/kazana-workspace/pokari/emformer_char3265_mini_stack.tflite";
    // for docker
    // const char* model_path = "/workspace/pokari/emformer_char3265_mini_stack.tflite";
    TfLiteModel* model = TfLiteModelCreateFromFile(model_path);
    if (model == nullptr) {
        Napi::Error::New(env, "Model could not be loaded.").ThrowAsJavaScriptException();
        return;
    }

    TfLiteInterpreterOptions* options = TfLiteInterpreterOptionsCreate();
    TfLiteInterpreterOptionsSetNumThreads(options, 2);
    
    TfLiteInterpreter* interpreter = TfLiteInterpreterCreate(model, options);
    if (interpreter == nullptr) {
        Napi::Error::New(env, "Failed initializing tflite interpreter.").ThrowAsJavaScriptException();
        return;
    }
    
    TfLiteInterpreterResizeInputTensor(interpreter, 0, (int*)(&segmentSize), 1);
    // TfLiteInterpreterAllocateTensors(interpreter);
    // ERROR: Regular TensorFlow ops are not supported by this interpreter. Make sure you apply/link the Flex delegate before inference.
    // ERROR: Node number 6 (FlexStridedSlice) failed to prepare.

    rtAudio = std::make_shared<RtAudio>();

    // microphone
    RtAudio::StreamParameters parameters;
    parameters.deviceId = rtAudio->getDefaultInputDevice();
    parameters.nChannels = 1;
    unsigned int sampleRate = 16000;
    unsigned int numFrames = segmentSize;

    try {
        // TODO: call recognize
        rtAudio->openStream(NULL, &parameters, RTAUDIO_FLOAT32, sampleRate, &numFrames, &listen, NULL); // TODO: pass two queues for userData
    } catch(RtAudioError& e) {
        Napi::Error::New(env, e.getMessage()).ThrowAsJavaScriptException();
        return;
    }
}

/**
 * Destructor for Stream Class
 */
Stream::~Stream() {
    // if stream is open, close stream

    /// Dispose of the model and interpreter objects.
    /// TfLiteInterpreterDelete(interpreter);
    /// TfLiteInterpreterOptionsDelete(options);
    /// TfLiteModelDelete(model);
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

    // TODO: check if recognizeCallback is defined.
    
    Napi::Env env = info.Env();

    try {
        rtAudio->startStream();
    } catch(RtAudioError& e) {
        Napi::Error::New(env, e.getMessage()).ThrowAsJavaScriptException();
        return;
    }
}

void Stream::stop(const Napi::CallbackInfo& info) {
    // if stream is open, close stream
}

Napi::Value Stream::test(const Napi::CallbackInfo& info) {
    // temporary value
    Napi::Number time_lapsed = Napi::Number::New(info.Env(), 5);
    return time_lapsed;
}
#ifndef STREAM_H
#define STREAM_H

#include <vector>
#include <condition_variable>

#include <napi.h>
#include <RtAudio.h>

#include "tensorflow/lite/c/c_api.h"

enum Encoder {
    EMFORMER,
    RNNT
};

class Stream : public Napi::ObjectWrap<Stream> {
    public:
        static Napi::Object Init(Napi::Env env, Napi::Object exports);

        /**
         * Constructor that sets default microphone, loopback and runs a test pass
         * on ASR to check if a user's device environment has enough computational cap
         * 
         * Supported platforms and its channels on rtaudio:
         * - Linux -> Microphone only
         * - Windows -> Microphone and Loopback
         * - macOS -> Microphone Only
         * In the future, each one should be replaced with its native API, especially
         * WASAPI(C++) for Windows.
         * 
         * Args:
         *  frameSize (unsigned int)
         *  record_type (str): emformer | rnnt
         */
        Stream(const Napi::CallbackInfo& info);
        ~Stream();

        /**
         * An event fired when `state` changes. If an error is present, it will be sent to server.
         * Args:
         *  callback (state: str, value: str, err: error) -> void
         */
        // void onStateChange(const Napi::CallbackInfo& info);
        
        /**
         * An event fired when recognition result is received
         * Args:
         *  callback (transcript: str) -> void
         */
        void onRecognize(const Napi::CallbackInfo& info);
        
        /**
         * Set a target microphone device as microphone
         * Args:
         *  device_type (str): microphone or loopback
         *  device (str)
         */
        // void setDevice(const Napi::CallbackInfo& info);

        /**
         * Get all devices in PC
         */
        Napi::Value getDevices(const Napi::CallbackInfo& info);

        Napi::Value getDefaultInputDevice(const Napi::CallbackInfo& info);
	    Napi::Value getDefaultOutputDevice(const Napi::CallbackInfo& info);

        /**
         * Starts recording and recognition
         * Args:
         *  bufferFrames (unsigned int)
         */
        void start(const Napi::CallbackInfo& info);

        /**
         * Stops recording and recognition
         */
        void stop(const Napi::CallbackInfo& info);

        friend int emformer_listen(void *outputBuffer, void *inputBuffer, unsigned int numFrames, double streamTime, RtAudioStreamStatus status, void *userData);

    private:
        std::shared_ptr<RtAudio> rtAudio;

        bool isPokariRunnable;
        bool isLoopbackEnabled;

        std::condition_variable hasDataArrived;
 
        std::vector<float> microphoneSignal;

        const Encoder encoderType;

        // for emformer model
        std::vector<float> futureMicrophoneSignal;
        const unsigned int rightSize;
        const unsigned int chunkSize;

        const unsigned int segmentSize;

        unsigned int microphoneSampleRate;
        unsigned int loopbackSampleRate;

        std::string microphoneDevice;
        std::string loopbackDevice;

        std::string loopbackState;
        std::string microphoneState;
        std::string pokariState;

        std::mutex microphoneMutex;
        std::mutex loopbackMutex;

        TfLiteModel* model;
        TfLiteInterpreter* interpreter;
        TfLiteInterpreterOptions* options;

        void recognize();

        // ref: https://stackoverflow.com/questions/59424842/how-to-give-multi-dimensional-inputs-to-tflite-via-c-api
        // ref: https://stackoverflow.com/questions/56222822/how-to-set-input-with-image-for-tensorflow-lite-in-c
        unsigned int prevToken{0};
        float encoderStates[2][18][1][20][8][64] {}; // emformer
        // float encoder_states[8][2][1][1024] {}; // rnnt
        float predictorStates[1][2][1][512] {};

        unsigned int getSampleSize(RtAudioFormat format);

        std::mutex threadsFnMutex;
        // Napi::ThreadSafeFunction stateChangeCallback;
        Napi::ThreadSafeFunction recognizeCallback;

        /**
         * A single test pass for measuring ASR recognition time. This is used so that
         * if a user does not meet minimum computational requirements, asr will not be run
         * Args:
         *  time_lapsed (float)
         */
        // Napi::Value test(const Napi::CallbackInfo& info);
};

#endif
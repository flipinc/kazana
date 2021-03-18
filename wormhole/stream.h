#ifndef STREAM_H
#define STREAM_H

#include <vector>
#include <condition_variable>

#include <napi.h>
#include <RtAudio.h>

enum Encoder {
    EMFORMER,
    RNNT
};

// TODO: what to do when user unplugs microphone during stream?
// TODO: what to do when some errors occur during stream?

class Stream : public Napi::ObjectWrap<Stream> {
    public:
        static Napi::Object Init(Napi::Env env, Napi::Object exports);

        Stream(const Napi::CallbackInfo& info);
        ~Stream();
        
        void onBundle(const Napi::CallbackInfo& info);

        Napi::Value getDevices(const Napi::CallbackInfo& info);
        void setDevice(const Napi::CallbackInfo& info);

        Napi::Value getDefaultInputDevice(const Napi::CallbackInfo& info);
	    Napi::Value getDefaultOutputDevice(const Napi::CallbackInfo& info);

        void start(const Napi::CallbackInfo& info);
        void stop(const Napi::CallbackInfo& info);

        unsigned int microphoneDeviceId;
        unsigned int loopbackDeviceId;

        friend int emformer_microphone_listen(void *outputBuffer, void *inputBuffer, unsigned int numFrames, double streamTime, RtAudioStreamStatus status, void *userData);
        friend int emformer_loopback_listen(void *outputBuffer, void *inputBuffer, unsigned int numFrames, double streamTime, RtAudioStreamStatus status, void *userData);

    private:
        // aka microphone rtAudio (default rtAudio instance)
        std::shared_ptr<RtAudio> rtAudio;
        std::shared_ptr<RtAudio> loopbackRtAudio;

        const Encoder encoderType;

        bool isMicrophoneEnabled;
        bool isLoopbackEnabled;

        std::condition_variable hasDataArrived;
        
        std::shared_ptr<std::vector<float>> bundledSignal;

        std::shared_ptr<std::vector<float>> loopbackSignal;
        std::shared_ptr<std::vector<float>> microphoneSignal;

        // Used for emformer model
        std::shared_ptr<std::vector<float>> futureMicrophoneSignal;
        std::shared_ptr<std::vector<float>> futureLoopbackSignal;
        // Used for emformer model
        const unsigned int rightSize;
        // Used for emformer model
        const unsigned int chunkSize;

        // Actual length of audio that will be fed in as ASR input. Used for all models
        const unsigned int segmentSize;

        std::mutex microphoneMutex;
        std::mutex loopbackMutex;

        void bundle();

        unsigned int getSampleSize(RtAudioFormat format);

        std::mutex threadsFnMutex;
        Napi::ThreadSafeFunction bundleCallback;
};

#endif
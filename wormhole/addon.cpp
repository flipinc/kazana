#include <napi.h>
#include "stream.h"

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return Stream::Init(env, exports);
}

NODE_API_MODULE(addon, InitAll)
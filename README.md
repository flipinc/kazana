# Kazana | A Desktop Application for Streaming Speech Recognition
KAZANA consists of three modules: Desktop App Frontend, Websocket Client, Wormhole.

### Version
- node v15.12.0
- npm v7.6.3

### First Setup
After runinng `git clone`, run following commands
```shell
git submodule update -i
```

# Wormhole | C++ Audio Handler for Kazana
Wormhole consists of two components: Audio APIs and TFLite interpreter (check previous commits since I removed this from the main branch).

### Run in container
Usually, I work with a Docker container for building on linux and a local linux environment for testing audio.
```shell
docker build -t kazana/wormhole -f Dockerfile .
docker run -it --rm -v ${PWD}:/workspace kazana/wormhole /bin/bash
```

### Why C++ instead of Python?
- Python's integration with Node.js is too limited to control audio states
- More control on threads, which will be super important for on-device implementation

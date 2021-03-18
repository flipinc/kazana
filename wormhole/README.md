## Wormhole | C++ Audio Handler for KAZANA
Wormhole consists of two components: Audio APIs, TFLite interpreter.

### Run in container
Usually, I work with a Docker container for building on linux and a local linux environment for testing audio.
```shell
docker build -t kazana/wormhole -f Dockerfile .
docker run -it --rm -v ${PWD}:/workspace kazana/wormhole /bin/bash
```

### Why C++ instead of Python?
- In order to bring more automation and performance on audio handling, it is required to manipulate with native Audio APIs written in C/C++. However, python's integration options with Node.js is too limited. 
- More control on threading management, which will be super important for on-device implementation.

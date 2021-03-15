# KAZANA | Desktop App for EKAKI
KAZANA consists of three modules: Desktop App Frontend, Websocket Client, Wormhole.

### Some Notes
- Many configs are shared with ![EKAKI's Web Application](https://github.com/chief-co-jp/ekaki). In the future, this library will be fused into the web application.

## Wormhole | Audio Handler for KAZANA
Wormhole consists of two components: Audio APIs, TFLite interpreter.

### Run in container
There are many installations required for setting up Wormhole's environment.
```shell
docker build -t kazana/wormhole -f Dockerfile .
docker run -it --rm -v ${PWD}:/workspace kazana/wormhole /bin/bash
```

### Build TFLite Interpreter for C
```shell
pip3 install numpy
bazel build -c opt --config=opt //tensorflow/lite/c:tensorflowlite_c
# or for xnnpack support,
bazel build -c opt --config=opt --define tflite_with_xnnpack=true //tensorflow/lite/c:tensorflowlite_c
```

### Why C instead of C++ or Python?
#### C++
- Building TFLite interpreter for C++ requires sensitive compilation environment in order to linking TFLite & others.
- Bundle size is bigger (TODO: this is not still numerically confirmed).

#### Python
- Integration with Node.js is just so terrible
- Less control on threading management, which will be super importannt for on-device implementation.
- Does not support TFLite delegate

### Some useful resources on TFLite
- https://gist.github.com/iwatake2222/3017d9ac3112b27cc9f5011ece993009
- https://github.com/tensorflow/tensorflow/issues/40438
- https://github.com/tensorflow/tensorflow/issues/38852
- https://github.com/tensorflow/tensorflow/issues/33634
- https://www.youtube.com/watch?v=dox1ZkFP-f4
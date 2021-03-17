# KAZANA | Desktop App for EKAKI
KAZANA consists of three modules: Desktop App Frontend, Websocket Client, Wormhole.

### First Setup
After runinng `git clone`, run following commands
```shell
git submodule update -i
```

## Wormhole | Audio Handler for KAZANA
Wormhole consists of two components: Audio APIs, TFLite interpreter.

### Run in container
Usually, I work with a Docker container for building and a local environment for testing audio.
```shell
docker build -t kazana/wormhole -f Dockerfile.<platform> .
docker run -it --rm -v ${PWD}:/workspace kazana/wormhole /bin/bash
```

### Build TFLite Interpreter for C
```shell
pip3 install numpy
cd vendor/tensorflow
git checkout v2.3.2 # Original TFLite files are created at this version
python3 configure.py # Default options (n for everything) are fine

nano tensorflow/lite/c/BUILD
# Insert a following line at `tflite_cc_shared_object`, 
# deps = [
#    ":c_api",
#    ":c_api_experimental",
#    ":exported_symbols.lds",
#    ":version_script.lds",
#    "//tensorflow/lite/delegates/flex:delegate" # added
# ],

bazel build --config=opt --config=monolithic --config=noaws --config=nohdfs --config=nonccl --config=v2 --define=tflite_convert_with_select_tf_ops=true --define=with_select_tf_ops=true //tensorflow/lite/c:tensorflowlite_c

cd /workspace # go back to root
cp vendor/tensorflow/bazel-bin/tensorflow/lite/c/libtensorflowlite_c.so lib/linux_x86_x64
```

### Limitations
- XNNPack delegate cannot be used because it only supports static-sized tensors (All ASR models output dynamic sized unicode point).

### Why C instead of C++ or Python?
#### C++
- Building TFLite interpreter for C++ requires aligning compilation environment with other compiles libraries.

#### Python
- Integration with Node.js is just so terrible
- Less control on threading management, which will be super importannt for on-device implementation.
- Does not support TFLite delegate

### Electron Build
https://github.com/cmake-js/cmake-js/issues/222

### Some Notes
- Many configs are shared with ![EKAKI's Web Application](https://github.com/chief-co-jp/ekaki). In the future, this library will be fused into the web application.

### Some useful resources on TFLite
- https://github.com/tensorflow/tensorflow/blob/master/tensorflow/lite/c/c_api.h
- https://gist.github.com/iwatake2222/3017d9ac3112b27cc9f5011ece993009
- https://github.com/tensorflow/tensorflow/issues/40438
- https://github.com/tensorflow/tensorflow/issues/38852
- https://github.com/tensorflow/tensorflow/issues/33634
- https://www.youtube.com/watch?v=dox1ZkFP-f4
- https://github.com/PINTO0309/TensorflowLite-flexdelegate
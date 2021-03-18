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

### Why C++ instead of Python?
- Integration with Node.js is just so terrible
- Less control on threading management, which will be super important for on-device implementation.

### Some Notes
- Many configs are shared with ![EKAKI's Web Application](https://github.com/chief-co-jp/ekaki). In the future, this library will be fused into the web application.
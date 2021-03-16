# Dockerfile to compile rtaudio
FROM ubuntu:latest

RUN mkdir /workspace
WORKDIR /workspace

# avoid tzData timezone setting
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    # install g++
    apt-get -y install build-essential && \
    # install cmake
    apt-get -y install cmake protobuf-compiler && \
    # install alsa and pulse audio
    apt-get -y install libasound2 libasound2-dev libpulse-dev && \
    # install nano
    apt-get -y install nano && \
    # install git
    apt-get -y install git && \
    # install python
    apt-get -y install python && \
    # install npm, node, pip, python
    apt install -y nodejs npm python3-pip 

# one time settup for bazel
# ref: https://docs.bazel.build/versions/master/install-ubuntu.html
RUN apt install -y apt-transport-https curl gnupg && \
    curl -fsSL https://bazel.build/bazel-release.pub.gpg | gpg --dearmor > bazel.gpg && \
    mv bazel.gpg /etc/apt/trusted.gpg.d/ && \
    echo "deb [arch=amd64] https://storage.googleapis.com/bazel-apt stable jdk1.8" | tee /etc/apt/sources.list.d/bazel.list

# install bazel
RUN apt update && \
    apt install -y bazel-3.1.0 && \
    ln -s /usr/bin/bazel-3.1.0 /usr/bin/bazel

# install yarn
RUN npm install -g yarn n

# install latest node
RUN n 14
# KAZANA | Desktop App for EKAKI
KAZANA consists of three modules: Desktop App Frontend, Websocket Client, Wormhole.

### First Setup
After runinng `git clone`, run following commands
```shell
git submodule update -i
```

### Release
1. Update the version in package.json file (e.g. 1.2.3)
2. Commit that change (git commit -m "🎉 new release v1.2.3")
3. Tag your commit (git tag v1.2.3). Make sure your tag name's format is v*.*.*. Your workflow will use this tag to detect when to create a release
4. Push your changes to GitHub (git push && git push --tags)


### Some Notes
- Many configs are shared with ![EKAKI's Web Application](https://github.com/chief-co-jp/ekaki). In the future, this library will be fused into the web application.
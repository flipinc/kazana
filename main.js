const crypto = require("crypto")
const { app, ipcMain, dialog, Menu, Tray, nativeImage, BrowserWindow, protocol } = require("electron");
const { menubar } = require("menubar");
const path = require("path");
const axios = require("axios")
const { spawn } = require("child_process")
const Store = require("electron-store")

require("dotenv").config({ path: path.join(__dirname, ".env") })

const { onFirstRun } = require("./first-run");

const store = new Store()

const wsPs = spawn(path.join(__dirname, "./external/WsNaudio/bin/release/netcoreapp3.1/osx-x64/publish/WsNaudio"));

const logoIconPath = path.join(__dirname, "assets/favicon-32x32.png")
const greenCircleIconPath = path.join(__dirname, "assets/green-circle.png")
const grayCircleIconPath = path.join(__dirname, "assets/gray-circle.png")
const redCircleIconPath = path.join(__dirname, "assets/red-circle.png")
const purpleCircleIconPath = path.join(__dirname, "assets/purple-circle.png")
const blueCircleIconPath = path.join(__dirname, "assets/blue-circle.png")

var tray, authWindow;

const createAuthWindow = () => {
  authWindow = new BrowserWindow({
    height: 360,
    width: 600,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
    }
  })
  authWindow.on("close", () => {})

  authWindow.webContents.openDevTools()

  authWindow.loadURL(`file://${path.join(__dirname, "app", "index.html")}`)
}

// stateは4つ。利用者からすれば、kiki接続
// - 起動 & kiki-接続 & client-接続 & talk中 -> purple（トーク中）/ talking
// - 起動 & kiki-接続 & client-接続 -> blue（トークの待機中） // waiting
// - 起動 & kiki-接続 -> green（接続の待機中） // client-disconnectedclient
// - 起動 & kiki未接続 -> red（セットアップに失敗しました。） // kiki-disconnected
// - 起動（ログインなし） -> gray // logout

const menuItems = [
  { 
    id: "state",
    label: "THIS WILL BE OVERRIDED", 
  },
  { type: "separator" },
  {
    label: "環境設定",
    accelerator: "Command+,",
    click() {}
  },
  {
    label: "EKAKI for Desktopについて",
    role: "about",
  },
  { type: "separator" },
  {
    id: "account",
    label: "THIS WILL BE OVERRIDED",
  },
  { type: "separator" },
  { 
    label: '再起動', 
    role: "reload",
  },
  { 
    label: 'EKAKI for Desktopを終了', 
    role: "quit",
  },
]

const setStateMenuItem = (state) => {
  const menuItemIndex = menuItems.findIndex(item => item.id === "state")

  menuItems[menuItemIndex] = {
    id: "state",
    enabled: false
  }

  switch(state) {
    case "talking":
      menuItems[menuItemIndex].icon = nativeImage.createFromPath(purpleCircleIconPath).resize({width: 11})
      menuItems[menuItemIndex].label = "トーク中"
      break
    case "waiting":
      menuItems[menuItemIndex].icon = nativeImage.createFromPath(blueCircleIconPath).resize({width: 11})
      menuItems[menuItemIndex].label = "トークの待機中"
      break
    case "client-disconnected":
      menuItems[menuItemIndex].icon = nativeImage.createFromPath(greenCircleIconPath).resize({width: 11})
      menuItems[menuItemIndex].label = "接続の待機中"
      break
    case "kiki-disconnected":
      menuItems[menuItemIndex].icon = nativeImage.createFromPath(redCircleIconPath).resize({width: 11})
      menuItems[menuItemIndex].label = "接続の準備中"
      break
    case "logout":
      menuItems[menuItemIndex].icon = nativeImage.createFromPath(grayCircleIconPath).resize({width: 11})
      menuItems[menuItemIndex].label = "未ログイン"
      break
    default:
      return
  }

  tray.setContextMenu(Menu.buildFromTemplate(menuItems))
}

const setAuthMenuItem = (type) => {
  const menuItemIndex = menuItems.findIndex(item => item.id === "account")

  menuItems[menuItemIndex] = {
    id: "account"
  }

  if(type === "logout") {
    menuItems[menuItemIndex].label = `${store.get("lastname")} ${store.get("firstname")}`
    menuItems[menuItemIndex].submenu = [
      { 
        label: "ログアウト",
        click() {
          wsPs.stdin.write(JSON.stringify({ action: "logout", payload: { userId: store.get("userId"), orgId: store.get("orgId") }}))

          store.set("userId", "")
          store.set("firstname", "")
          store.set("lastname", "")
          store.set("email", "")
          store.set("orgId", "")

          setStateMenuItem("logout")
          setAuthMenuItem("login")
        },
      },
      { label: "アカウント設定" },
    ]
  } else if(type === "login") {
    menuItems[menuItemIndex].label = "ログイン"
    menuItems[menuItemIndex].click = () => {
      createAuthWindow()
    }
  }

  tray.setContextMenu(Menu.buildFromTemplate(menuItems))
}

const computeSignature = (params) => {
  const data = Object.keys(params).sort().reduce((acc, key) => acc + key + params[key], "")
  return String(
          crypto
          .createHmac("sha1", process.env.TICKET_SECRET_KEY)
          .update(Buffer.from(data, "utf-8"))
          .digest("base64")
        )
}

app.on("ready", async () => {
  protocol.registerFileProtocol("file", (req, callback) => {
    const pathname = req.url.replace("file:///", "")
    callback(pathname)
  })

  await onFirstRun()

  tray = new Tray(nativeImage.createFromPath(logoIconPath))

  const userId = store.get("userId")
  const orgId = store.get("orgId")

  if(!!userId && !!orgId) {
    setStateMenuItem("kiki-disconnected")
    setAuthMenuItem("logout")
    wsPs.stdin.write(JSON.stringify({ action: "login", payload: { userId: userId, orgId, signature: computeSignature({ userId, orgId, }) } }))
  } else {
    setStateMenuItem("logout")
    setAuthMenuItem("login")
  }

  const mb = menubar({ tray })

  mb.on("ready", () => {
    console.log("Menubar app is ready.")
  })
})

ipcMain.on("authForm", (e, data) => {
  store.get("userId")

  axios.post("http://localhost:4000/api/user/auth/login", data)
  .then(res => {
    // TODO: success/failureの時にそれぞれ適切な動作をさせること

    if(res.data.success) {
      const { _id, firstname, lastname, email, membership } = res.data.data.user
      store.set("userId", _id)
      store.set("firstname", firstname)
      store.set("lastname", lastname)
      store.set("email", email)

      const orgId = membership?.find(mem => mem.isDefault).orgId
      if(orgId) {
        store.set("orgId", orgId)
      }

      setStateMenuItem("kiki-disconnected")
      setAuthMenuItem("logout")

      wsPs.stdin.write(JSON.stringify({ action: "login", payload: { userId: _id, orgId, signature: computeSignature({ userId: _id, orgId, }) }}))
      authWindow.close()
    } else {

      // TODO: rendererに失敗したことを伝える。

      console.log("Auth Failure")
    }
  })
  .catch(err => console.error(err))
})


wsPs.stdin.setEncoding("utf8")

wsPs.stderr.on("data", (message) => {
  console.log(message.toString())
})

wsPs.stdout.on("data", (message) => {
  let msg;
  try {
    msg = JSON.parse(message)
  } catch(err) {
    return;
  }

  console.log(msg)

  switch(msg.action) {
    case "start-talk":
      setStateMenuItem("talking")
      break
    case "end-talk":
      setStateMenuItem("waiting")
      break
    case "client-connected":
      setStateMenuItem("waiting")
      break
    case "client-disconnected":
      setStateMenuItem("client-disconnected")
      break
    case "kiki-connected":
      setStateMenuItem("client-disconnected")
      break
    case "kiki-disconnected":
      setStateMenuItem("kiki-disconnected")
      break
    default:
      break
  }
})
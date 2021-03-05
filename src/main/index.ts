import crypto from "crypto";
import {
  app,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  BrowserWindow,
  protocol,
} from "electron";
import { menubar } from "menubar";
import path from "path";
import axios from "axios";
import { spawn } from "child_process";
import Store from "electron-store";

import onLaunch from "./launch";

require("dotenv").config({ path: path.join(__dirname, ".env") });

const debugging = true;

const store = new Store();

const wsPs = spawn("node", [path.join(__dirname, "./websocket.js")]);

// all icons are from flaticon
const logoIconPath = path.join(__dirname, "./assets/favicon-32x32.png");
const greenCircleIconPath = path.join(__dirname, "./assets/green-circle.png");
const grayCircleIconPath = path.join(__dirname, "./assets/gray-circle.png");
const redCircleIconPath = path.join(__dirname, "./assets/red-circle.png");
const purpleCircleIconPath = path.join(__dirname, "./assets/purple-circle.png");
const blueCircleIconPath = path.join(__dirname, "./assets/blue-circle.png");
const yellowCircleIconPath = path.join(__dirname, "./assets/yellow-circle.png");

let authWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const createAuthWindow = () => {
  authWindow = new BrowserWindow({
    height: 360,
    width: 600,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  if (debugging) {
    authWindow.webContents.openDevTools();
  }

  authWindow.loadURL(`file://${path.join(__dirname, "public", "index.html")}`);
};

const menuItems: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[] = [
  {
    id: "state",
    label: "THIS WILL BE OVERRIDED",
  },
  { type: "separator" },
  {
    label: "環境設定",
    accelerator: "Command+,",
    click() {},
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
    label: "再起動",
    role: "reload",
  },
  {
    label: "EKAKI for Desktopを終了",
    role: "quit",
  },
];

const setStateMenuItem = (state: ConnStates) => {
  const menuItemIndex = menuItems.findIndex((item) => item.id === "state");

  menuItems[menuItemIndex] = {
    id: "state",
    enabled: false,
  };

  switch (state) {
    case "talking":
      menuItems[menuItemIndex].icon = nativeImage
        .createFromPath(purpleCircleIconPath)
        .resize({ width: 11 });
      menuItems[menuItemIndex].label = "トーク中";
      break;
    case "waiting":
      menuItems[menuItemIndex].icon = nativeImage
        .createFromPath(blueCircleIconPath)
        .resize({ width: 11 });
      menuItems[menuItemIndex].label = "トークの待機中";
      break;
    case "client-disconnected":
      menuItems[menuItemIndex].icon = nativeImage
        .createFromPath(greenCircleIconPath)
        .resize({ width: 11 });
      menuItems[menuItemIndex].label = "接続の待機中";
      break;
    case "kiki-disconnected":
      menuItems[menuItemIndex].icon = nativeImage
        .createFromPath(yellowCircleIconPath)
        .resize({ width: 11 });
      menuItems[menuItemIndex].label = "接続の準備中";
      break;
    case "logout":
      menuItems[menuItemIndex].icon = nativeImage
        .createFromPath(redCircleIconPath)
        .resize({ width: 11 });
      menuItems[menuItemIndex].label = "未ログイン";
      break;
    case "no-network":
      // TODO: main process cannnot detect network connection loss so, instead receive message from renderer process
      menuItems[menuItemIndex].icon = nativeImage
        .createFromPath(grayCircleIconPath)
        .resize({ width: 11 });
      menuItems[menuItemIndex].label = "未接続";
      break;
    default:
      return;
  }

  tray!.setContextMenu(Menu.buildFromTemplate(menuItems));
};

const setAuthMenuItem = (type: string) => {
  const menuItemIndex = menuItems.findIndex((item) => item.id === "account");

  menuItems[menuItemIndex] = {
    id: "account",
  };

  if (type === "logout") {
    menuItems[menuItemIndex].label = `${store.get("lastname")} ${store.get(
      "firstname",
    )}`;
    menuItems[menuItemIndex].submenu = [
      {
        label: "ログアウト",
        click() {
          wsPs.stdin.write(
            JSON.stringify({
              action: "logout",
              payload: {
                userId: store.get("userId"),
                orgId: store.get("orgId"),
              },
            }),
          );

          store.set("userId", "");
          store.set("firstname", "");
          store.set("lastname", "");
          store.set("email", "");
          store.set("orgId", "");

          setStateMenuItem("logout");
          setAuthMenuItem("login");
        },
      },
      { label: "アカウント設定" },
    ];
  } else if (type === "login") {
    menuItems[menuItemIndex].label = "ログイン";
    menuItems[menuItemIndex].click = () => {
      createAuthWindow();
    };
  }

  tray!.setContextMenu(Menu.buildFromTemplate(menuItems));
};

const computeSignature = (params: any) => {
  if (!process.env.TICKET_SECRET_KEY) {
    // TODO: logging
    throw Error("Secret key has not been set yet.");
  }

  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], "");
  return String(
    crypto
      .createHmac("sha1", process.env.TICKET_SECRET_KEY)
      .update(Buffer.from(data, "utf-8"))
      .digest("base64"),
  );
};

app.on("ready", async () => {
  protocol.registerFileProtocol("file", (req, callback) => {
    const pathname = req.url.replace("file:///", "");
    callback(pathname);
  });

  await onLaunch();

  tray = new Tray(nativeImage.createFromPath(logoIconPath));

  const userId = store.get("userId");
  const orgId = store.get("orgId");

  if (!!userId && !!orgId) {
    setStateMenuItem("kiki-disconnected");
    setAuthMenuItem("logout");
    wsPs.stdin.write(
      JSON.stringify({
        action: "login",
        payload: {
          userId,
          orgId,
          signature: computeSignature({ userId, orgId }),
        },
      }),
    );
  } else {
    setStateMenuItem("logout");
    setAuthMenuItem("login");
  }

  menubar({ tray });
});

ipcMain.on("authForm", async (e, data) => {
  store.get("userId");

  try {
    const res = await axios.post(
      "http://localhost:4000/api/user/auth/login",
      data,
    );

    if (res.data.success) {
      const {
        _id,
        firstname,
        lastname,
        email,
        membership,
      }: UserBackend = res.data.data.user;
      store.set("userId", _id);
      store.set("firstname", firstname);
      store.set("lastname", lastname);
      store.set("email", email);

      const defaultMembership = membership?.find((mem) => mem.isDefault);
      if (!defaultMembership || !defaultMembership.org)
        throw Error("Default organization not found.");

      const orgId = defaultMembership.org;
      store.set("orgId", orgId);

      setStateMenuItem("kiki-disconnected");
      setAuthMenuItem("logout");

      wsPs.stdin.write(
        JSON.stringify({
          action: "login",
          payload: {
            userId: _id,
            orgId,
            signature: computeSignature({ userId: _id, orgId }),
          },
        }),
      );

      // Close auth window if it is still open
      if (authWindow) authWindow.close();
    } else {
      throw Error("Authentification failed.");
    }
  } catch (err) {
    // TODO: Logging
  }
});

wsPs.stdin.setDefaultEncoding("utf8");

wsPs.stderr.on("data", () => {});

wsPs.stdout.on("data", (message) => {
  let msg;

  try {
    msg = JSON.parse(message);
  } catch (err) {
    return;
  }

  console.log(msg);

  switch (msg.action) {
    case "start-talk":
      setStateMenuItem("talking");
      break;
    case "end-talk":
      setStateMenuItem("waiting");
      break;
    case "client-connected":
      setStateMenuItem("waiting");
      break;
    case "client-disconnected":
      setStateMenuItem("client-disconnected");
      break;
    case "kiki-connected":
      setStateMenuItem("client-disconnected");
      break;
    case "kiki-disconnected":
      setStateMenuItem("kiki-disconnected");
      break;
    default:
      break;
  }
});

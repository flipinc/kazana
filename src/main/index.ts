/**
 * Note: As of 2021/3/5 a new electron version 12.0 is listed as a stable release, however, it will give
 * `require() is not defined` whenever a new window is created. Therefore, using latest version of 11.*
 */

import crypto from "crypto";
import {
  app,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  BrowserWindow,
  protocol,
  // electron should be listed as devDependency
  // eslint-disable-next-line import/no-extraneous-dependencies
} from "electron";
import path from "path";
import axios from "axios";
import Store from "electron-store";

// including this will enable to pinpoint lines that causes errors
// eslint-disable-next-line import/no-extraneous-dependencies
import sourceMapSupport from "source-map-support";

import Socket from "./websocket";
import onLaunch from "./launch";

sourceMapSupport.install();

const store = new Store();
const socket = new Socket();

// ref: https://stackoverflow.com/questions/46022443/electron-how-to-add-external-files
const baseStaticPath = app.isPackaged
  ? path.join(process.resourcesPath, "extraResources")
  : path.join(__dirname, "..", "static");

// all icons are from flaticon
const logoIconPath = path.join(baseStaticPath, "/favicon-32x32.png");
const updateWarningIconPath = path.join(baseStaticPath, "/update-warning.png");
const greenCircleIconPath = path.join(baseStaticPath, "/green-circle.png");
const grayCircleIconPath = path.join(baseStaticPath, "/gray-circle.png");
const redCircleIconPath = path.join(baseStaticPath, "/red-circle.png");
const purpleCircleIconPath = path.join(baseStaticPath, "/purple-circle.png");
const yellowCircleIconPath = path.join(baseStaticPath, "/yellow-circle.png");

let aboutWindow: BrowserWindow | null = null;
let authWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const createAuthWindow = () => {
  if (authWindow && authWindow.isVisible()) return;
  if (aboutWindow && aboutWindow.isVisible()) {
    aboutWindow.close();
    aboutWindow = null;
  }

  authWindow = new BrowserWindow({
    height: 360,
    width: 600,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  /** if user manually deletes this window, window has to be set to null programatically */
  authWindow.on("closed", () => {
    authWindow = null;
  });

  if (!app.isPackaged) {
    authWindow.webContents.openDevTools();
  }

  authWindow.loadURL(`file://${path.join(__dirname, "index.html#/auth")}`);
};

const createAboutWindow = () => {
  if (aboutWindow && aboutWindow.isVisible()) return;
  if (authWindow && authWindow.isVisible()) {
    authWindow.close();
    authWindow = null;
  }

  aboutWindow = new BrowserWindow({
    height: 680,
    width: 1120,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  aboutWindow.on("closed", () => {
    aboutWindow = null;
  });

  if (!app.isPackaged) {
    aboutWindow.webContents.openDevTools();
  }

  aboutWindow.loadURL(`file://${path.join(__dirname, "index.html#/about")}`);
};

const menuItems: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[] = [
  {
    id: "state",
    label: "", // this will be overrided
  },
  { type: "separator" },
  {
    id: "version",
    label: "", // this will be overrided
    click() {},
  },
  { type: "separator" },
  {
    label: "EKAKI Desktopについて",
    click() {
      createAboutWindow();
    },
  },
  { type: "separator" },
  {
    id: "account",
    label: "", // this will be overrided
  },
  { type: "separator" },
  {
    label: "再起動",
    role: "reload",
    accelerator: "Command+R",
  },
  {
    label: "EKAKI Desktopを終了",
    role: "quit",
    accelerator: "Command+Q",
  },
];

const setVersionItem = (isUpdated: boolean) => {
  const menuItemIndex = menuItems.findIndex((item) => item.id === "version");

  menuItems[menuItemIndex] = {
    id: "version",
  };

  if (isUpdated) {
    menuItems[menuItemIndex].label = "最新バージョンの確認";
    menuItems[menuItemIndex].click = () => {};
  } else {
    menuItems[menuItemIndex].icon = nativeImage
      .createFromPath(updateWarningIconPath)
      .resize({ width: 11 });
    menuItems[menuItemIndex].label = "最新バージョンにアップデート";
    menuItems[menuItemIndex].click = () => {};
  }
};

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
        .createFromPath(greenCircleIconPath)
        .resize({ width: 11 });
      menuItems[menuItemIndex].label = "トークの待機中";
      break;
    case "client-disconnected":
    case "kiki-disconnected":
      menuItems[menuItemIndex].icon = nativeImage
        .createFromPath(yellowCircleIconPath)
        .resize({ width: 11 });
      menuItems[menuItemIndex].label = "接続の待機中";
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

  if (tray) {
    tray.setContextMenu(Menu.buildFromTemplate(menuItems));
  } else {
    // TODO: logging
  }
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
          socket.close();

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

  if (tray) {
    tray.setContextMenu(Menu.buildFromTemplate(menuItems));
  } else {
    // TODO: logging
  }
};

const computeSignature = (params: any) => {
  // TODO: we need some mechanism to allow only authorized use to connect to kiki
  const SECRET_KEY = "THIS_SHOULD_BE_USED_FOR_DEV_PURPOSE_ONLY";

  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], "");
  return String(
    crypto
      .createHmac("sha1", SECRET_KEY)
      .update(Buffer.from(data, "utf-8"))
      .digest("base64"),
  );
};

app.on("ready", async () => {
  protocol.registerFileProtocol("file", (req, callback) => {
    const pathname = req.url.replace("file:///", "");
    callback(pathname);
  });

  try {
    await onLaunch();
  } catch (err) {
    // TODO: Logging
  }

  tray = new Tray(nativeImage.createFromPath(logoIconPath));

  setVersionItem(false);

  const userId = store.get("userId");
  const orgId = store.get("orgId");

  if (!!userId && !!orgId) {
    setStateMenuItem("kiki-disconnected");
    setAuthMenuItem("logout");

    socket.connect({
      userId: userId as string,
      orgId: orgId as string,
      signature: computeSignature({ type: "kazana", userId, orgId }),
    });
  } else {
    setStateMenuItem("logout");
    setAuthMenuItem("login");
  }
});

app.on("window-all-closed", () => {});

ipcMain.on("authForm", async (e, data) => {
  store.get("userId");

  try {
    const res = await axios.post(
      "http://localhost:4000/api/user/auth/login",
      data,
    );

    if (res.status === 200) {
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

      socket.connect({
        userId: _id,
        orgId,
        signature: computeSignature({ type: "kazana", userId: _id, orgId }),
      });

      // Close auth window if it is still open
      if (authWindow) {
        authWindow.close();
        authWindow = null;
      }
    } else {
      throw Error("Authentification failed.");
    }
  } catch (err) {
    // TODO: Logging
  }
});

socket.onMessage((msg) => {
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

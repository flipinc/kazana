import { dialog } from "electron";
import Store from "electron-store";

const store = new Store();

const onLaunch = async () => {
  if (store.get("hasFinishedFirstRun")) return;
  if (process.platform !== "darwin") return;

  store.set("hasFinishedFirstRun", true);

  const { response } = await dialog.showMessageBox({
    type: "question",
    buttons: ["フォルダーへ移動", "後で行う"],
    defaultId: 0,
    message: "アプリケーションのフォルダーへ移動させますか？",
  });

  if (response === 0) {
    console.log("HELLO");
  }
};

export default onLaunch;

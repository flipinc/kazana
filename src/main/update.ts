// eslint-disable-next-line import/no-extraneous-dependencies
// import { app, autoUpdater, dialog } from "electron";

// const server = "https://kazana-update-server-26keisuke-chiefcojp.vercel.app";
// const url = `${server}/update/${process.platform}/${app.getVersion()}`;

// autoUpdater.setFeedURL({ url });
// // run on loadtime only (to avoid disrupting users' talks)
// autoUpdater.checkForUpdates();

// autoUpdater.on("update-downloaded", (event, releaseNotes, releaseName) => {
//   const dialogOpts = {
//     type: "info",
//     buttons: ["再起動", "後で"],
//     title: "アプリケーションの更新",
//     message: process.platform === "win32" ? releaseNotes : releaseName,
//     detail: "新しいバージョンのアプリケーションがダウンロードできます。",
//   };

//   dialog.showMessageBox(dialogOpts).then((returnValue) => {
//     if (returnValue.response === 0) autoUpdater.quitAndInstall();
//   });
// });

// autoUpdater.on("error", () => {
//   // TODO: logging
// });

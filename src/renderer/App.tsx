import { debounce } from "lodash";
import styled from "styled-components";
import React, { useState, useMemo } from "react";
import { ipcRenderer, shell } from "electron";

import "./css/reset.css";
import "./css/App.css";

const ekakiImage = require("./assets/ekaki-logo.png");
const authBackground = require("./assets/background.svg");

const App = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  /**
   * Authentification must be handled at main process because
   * some properties like user configs need to be set.
   */
  const handleSubmit = useMemo(
    () =>
      debounce(async () => {
        ipcRenderer.send("authForm", { email, password });
      }, 300),
    [email, password],
  );

  const handleLinkClick = () => {
    shell.openExternal("https://github.com");
  };

  return (
    <Box>
      <img src={ekakiImage} alt="ekaki-logo" />
      <div>
        <h2>EKAKIへようこそ！</h2>
        <h5>登録したメールアドレスとパスワードを入力してください。</h5>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="メールアドレス"
            autoComplete="email"
            name="email"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="パスワード"
            autoComplete="current-password"
            name="password"
          />
          <button type="submit">ログイン</button>
        </form>
        <div onClick={handleLinkClick}>
          まだEKAKIに登録されていない方/パスワードをお忘れの方は
          <span>こちら</span>
        </div>
      </div>
      <img src={authBackground} alt="auth-background" />
    </Box>
  );
};

const Box = styled.div`
  display: flex;
  justify-content: space-around;

  & > img:first-child {
    width: 72px;
    height: 72px;
    margin-right: 48px;
  }

  & > img:last-child {
    position: fixed;
    width: 200%;
    left: -240px;
    top: 0;
    z-index: -1;
  }

  & > div {
    & > h2 {
      font-size: 18px;
      margin-bottom: 9px;
      font-weight: 600;
    }

    & > h5 {
      font-size: 11.5px;
      margin-bottom: 24px;
      font-weight: 600;
    }

    & > form {
      display: flex;
      flex-direction: column;

      & > input {
        background-color: transparent;
        transition: 200ms;
        box-sizing: border-box;
        letter-spacing: 0.2px;
        border-radius: 5px;
        border: 1px solid #c7d1e9;
        font-size: 14.5px;
        padding: 7px 10px 7px 10px;
        width: 300px;
        margin-bottom: 12px;
        height: 36px;

        &::placeholder {
          color: #95a1bc;
        }

        &:focus {
          outline-color: #6448fb;
        }
      }

      & > button {
        font-size: 11.5px;
        color: white;
        padding: 0px 16px 1px 16px;
        height: 30px;
        display: flex;
        align-items: center;
        cursor: pointer;
        transition: 150ms;
        justify-content: center;
        letter-spacing: 0.2px;
        font-weight: 600;
        width: 120px;
        box-sizing: border-box;
        border: 1px solid #3c95fb;
        background: #3c95fb;
        margin-bottom: 32px;
        border-radius: 2px;
        outline: none;

        &:hover {
          border: 1px solid #7db8fc;
          background: #7db8fc;
        }
      }
    }

    & > div {
      font-size: 11.5px;
      color: #58678c;
      font-weight: 600;

      & > span {
        color: #3c95fb;
        text-decoration: underline;
        transition: 160ms;
        cursor: pointer;

        &:hover {
          color: #7db8fc;
        }
      }
    }
  }
`;

export default App;

// electron is listed as devDependency
// eslint-disable-next-line import/no-extraneous-dependencies
import { shell, remote } from "electron";
import React, { useState } from "react";
import styled from "styled-components";

const ekakiImage = require("../assets/ekaki-logo.png");
const aboutBackground = require("../assets/background-about.svg");

// in development, this returns electron binary version. But it works fine
// production
// https://github.com/electron/electron/issues/7085
const version = remote.app.getVersion();

const About = () => {
  const [selectedSlide, setSelectedSlide] = useState("open_desktop_app");

  const onEkakiLinkClick = () => {
    shell.openExternal("https://ekaki.ai");
  };

  const slides = [
    {
      id: "open_desktop_app",
      title: "1. EKAKI Desktopを開く",
      description: <div>まず始めに、このEKAKI Desktopを起動します。</div>,
    },
    {
      id: "login_desktop_app",
      title: "2. EKAKI Desktopでログインする",
      description: (
        <div>
          PC右上のロゴをクリックし、「ログイン」よりユーザー情報を入力して下さい。
        </div>
      ),
    },
    {
      id: "login_web_app",
      title: "3. EKAKIでログインする",
      description: (
        <div>
          お使いのブラウザで<span onClick={onEkakiLinkClick}>EKAKI</span>
          を開いて、ログインして下さい。
        </div>
      ),
    },
    {
      id: "start_talk",
      title: "4. トークを開始する",
      description: (
        <div>
          <span onClick={onEkakiLinkClick}>EKAKI</span>
          の左側のアイコンより「トークを開始する」を押せば、文字起こしが開始します！
        </div>
      ),
    },
  ];

  return (
    <Box>
      <div>
        <div>
          <h2>
            <img src={ekakiImage} alt="ekaki-logo" />
            EKAKI Desktopについて
          </h2>
          <div>
            <h5>Version</h5>
            <h5>{version}</h5>
          </div>
        </div>
        <div>
          <div>
            {slides.map((slide) => {
              return (
                <SlideButton
                  key={slide.id}
                  selected={slide.id === selectedSlide}
                  onClick={() => setSelectedSlide(slide.id)}
                >
                  <h5>{slide.title}</h5>
                  {slide.description}
                </SlideButton>
              );
            })}
          </div>
          <div />
        </div>
      </div>
      <img src={aboutBackground} alt="about-background" />
    </Box>
  );
};

const SlideButton = styled.div<{ selected: boolean }>`
  width: 380px;
  height: 84px;
  border: 1px solid #d9e0f0;
  background: ${(props) => (props.selected ? "#F1F2F4" : "white")};
  border-radius: 6px;
  margin-bottom: 24px;
  box-sizing: border-box;
  padding: 12px 16px;
  transition: 180ms;
  cursor: pointer;

  & > h5 {
    font-size: 13px;
    font-weight: 600;
    color: #58678c;
    margin-bottom: 4px;
  }

  & > div {
    font-size: 11.5px;
    line-height: 1.4em;
    color: #58678c;

    & > span {
      color: #3c95fb;
      transition: 160ms;
      cursor: pointer;

      &:hover {
        color: #7db8fc;
        text-decoration: underline;
      }
    }
  }
`;

const Box = styled.div`
  width: 100%;
  height: 100%;
  padding: 45px 84px;
  box-sizing: border-box;

  & > div {
    & > div:first-child {
      margin-bottom: 28px;

      & > h2 {
        display: flex;
        align-items: center;
        font-size: 21px;
        font-weight: 600;
        margin-bottom: 8px;

        & > img:first-child {
          margin-left: -16px;
          width: 72px;
          height: 72px;
          margin-right: 16px;
        }
      }

      & > div {
        display: flex;
        align-items: center;

        & > h5:first-child {
          font-size: 12px;
          color: #58678c;
          font-weight: 600;
          margin-right: 64px;
        }

        & > h5:last-child {
          font-size: 12px;
          color: #58678c;
          font-weight: 400;
        }
      }
    }

    & > div:nth-child(2) {
      display: flex;

      & > div:first-child {
        margin-right: 28px;
      }

      & > div:nth-child(2) {
        width: 100%;
        min-height: 100%;
        background: white;
        border-radius: 8px;
        min-height: 100%;
        margin-bottom: 24px;
      }
    }
  }

  & > img:last-child {
    position: fixed;
    width: 160%;
    left: -330px;
    top: 10%;
    z-index: -1;
  }
`;

export default About;

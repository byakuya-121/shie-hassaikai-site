"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import "./board.css";
import logoImg from "../home/logo.png";
import aaGif from "./aa-side.gif";
import BulletinBoard from "@/components/BulletinBoard";

const SOUND_STORAGE_KEY = "shie_hassaikai_sound_enabled";
const THEME_STORAGE_KEY = "shie_hassaikai_board_theme";

type ThemeId = "crimson" | "emerald" | "cyan" | "violet" | "amber";

const THEMES: {
  id: ThemeId;
  label: string;
  color: string;
  glow: string;
  tint: string;
}[] = [
  {
    id: "crimson",
    label: "CRIMSON",
    color: "#d91e2a",
    glow: "rgba(217, 30, 42, 0.35)",
    tint: "rgba(217, 30, 42, 0.14)",
  },
  {
    id: "emerald",
    label: "MATRIX GREEN",
    color: "#10b981",
    glow: "rgba(16, 185, 129, 0.35)",
    tint: "rgba(16, 185, 129, 0.14)",
  },
  {
    id: "cyan",
    label: "CYBER CYAN",
    color: "#06b6d4",
    glow: "rgba(6, 182, 212, 0.35)",
    tint: "rgba(6, 182, 212, 0.14)",
  },
  {
    id: "violet",
    label: "PHANTOM VIOLET",
    color: "#8b5cf6",
    glow: "rgba(139, 92, 246, 0.35)",
    tint: "rgba(139, 92, 246, 0.14)",
  },
  {
    id: "amber",
    label: "AMBER GOLD",
    color: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.35)",
    tint: "rgba(245, 158, 11, 0.14)",
  },
];

const AA_TITLE = [
  " █████   ████   ██    ██  ██    ██  ██  ██  ██   ██  ████  ██████  ██  ██       █████   ██  ██   ████   ██████",
  "██      ██  ██  ███  ███  ███  ███  ██  ██  ███  ██   ██     ██    ██  ██      ██       ██  ██  ██  ██    ██  ",
  "██      ██  ██  ████████  ████████  ██  ██  ████ ██   ██     ██     ████       ██       ██████  ██  ██    ██  ",
  "██      ██  ██  ██ ██ ██  ██ ██ ██  ██  ██  ██ ████   ██     ██      ██        ██       ██  ██  ██████    ██  ",
  "██      ██  ██  ██    ██  ██    ██  ██  ██  ██  ███   ██     ██      ██        ██       ██  ██  ██  ██    ██  ",
  " █████   ████   ██    ██  ██    ██   ████   ██   ██  ████    ██      ██         █████   ██  ██  ██  ██    ██  ",
].join("\n");

export default function BoardPage() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeId, setThemeId] = useState<ThemeId>("crimson");

  useEffect(() => {
    const savedSound = localStorage.getItem(SOUND_STORAGE_KEY);
    if (savedSound !== null) {
      setSoundEnabled(savedSound === "true");
    }

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (savedTheme && THEMES.some((t) => t.id === savedTheme)) {
      setThemeId(savedTheme);
    }
  }, []);

  const handleSelectTheme = (id: ThemeId) => {
    setThemeId(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
  };

  const activeTheme = THEMES.find((t) => t.id === themeId) || THEMES[0];

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(SOUND_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const playNotifySound = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(740, ctx.currentTime);
      osc.frequency.setValueAtTime(980, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.24);
    } catch {
      // ブラウザ自動再生制限時は無視
    }
  }, []);

  return (
    <main
      className="board-page"
      style={
        {
          "--crimson": activeTheme.color,
          "--crimson-glow": activeTheme.glow,
          "--theme-tint": activeTheme.tint,
        } as React.CSSProperties
      }
    >
      <div className="hero-grid" />
      <div className="hero-noise" />

      {/* HEADER */}
      <header className="site-header">
        <div className="header-inner">
          <Link href="/home" className="brand">
            <div className="emblem">
              <div className="emblem-inner">
                <img
                  src={logoImg.src}
                  alt="SHIE HASSAIKAI LOGO"
                  className="emblem-image"
                />
              </div>
            </div>
            <span className="brand-name">
              <strong>死穢八斎會</strong>
              <small>SHIE HASSAIKAI</small>
            </span>
          </Link>

          <div className="header-actions">
            {/* テーマカラー切替スイッチャー */}
            <div
              className="theme-switcher"
              role="group"
              aria-label="テーマカラー変更"
            >
              <span className="theme-switcher-label">COLOR</span>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={t.label}
                  aria-label={`テーマカラー: ${t.label}`}
                  className={`theme-swatch ${themeId === t.id ? "is-active" : ""}`}
                  style={{ "--swatch-color": t.color } as React.CSSProperties}
                  onClick={() => handleSelectTheme(t.id)}
                />
              ))}
            </div>

            <button
              type="button"
              className="settings-open-btn"
              onClick={() => setSettingsOpen(true)}
            >
              ⚙ 設定 / PROFILE
            </button>

            <button
              type="button"
              className={`sound-toggle-btn ${soundEnabled ? "is-on" : ""}`}
              onClick={handleToggleSound}
            >
              <span className="sound-dot" />
              SOUND: {soundEnabled ? "ON" : "OFF"}
            </button>

            <Link href="/home" className="header-contact">
              ← PORTAL HOME
            </Link>
          </div>
        </div>
      </header>

      {/* BULLETIN BOARD SECTION */}
      <section className="bbs-section">
        <div className="section-inner">
          <div className="section-heading">
            <div>
              <p className="section-label">DEDICATED COMMUNITY TERMINAL</p>
              <div className="board-aa-wrap">
                <pre className="board-aa-title" aria-label="COMMUNITY CHAT">
                  {AA_TITLE}
                </pre>
                <img
                  src={aaGif.src}
                  alt="COMMUNITY GIF"
                  className="board-aa-gif"
                />
              </div>
            </div>
            <span className="section-heading-en">BULLETIN BOARD</span>
          </div>

          <BulletinBoard
            soundEnabled={soundEnabled}
            onToggleSound={handleToggleSound}
            onNotifySound={playNotifySound}
            settingsOpen={settingsOpen}
            onOpenSettings={() => setSettingsOpen(true)}
            onCloseSettings={() => setSettingsOpen(false)}
          />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-bottom">
            <span>© 2026 SHIE HASSAIKAI. ALL RIGHTS RESERVED.</span>
            <Link href="/home" className="footer-back-link">
              ← RETURN TO PORTAL HOME
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import "./home.css";
import logoImg from "./logo.png";
import LogoutButton from "../logout-button";
import { createClient } from "@/lib/supabase/client";

const HANDLE_STORAGE_KEY = "shie_hassaikai_handle_name";
const SOUND_STORAGE_KEY = "shie_hassaikai_sound_enabled";
const OPENCHAT_URL = "https://line.me/ti/g2/EbLsVD7-Scm_rQTUTPTc5a4MTRLHTxW60oQrkA?utm_source=invitation&utm_medium=link_copy&utm_campaign=default";
const OFFICIAL_LINE_URL = "https://lin.ee/pOqhDWX";
const GITHUB_URL = "https://github.com/byakuya-121/ByakuyaTools.git";

const navigation = [
  { label: "HOME", href: "#home" },
  { label: "NEWS", href: "#news" },
  { label: "ABOUT", href: "#about" },
  { label: "ACTIVITIES", href: "#activities" },
  { label: "RESEARCH", href: "#research" },
  { label: "ARCHIVE", href: "#archive" },
  { label: "BOARD", href: "#board" },
  { label: "TOOLS", href: "#tools" },
];

const activities = [
  {
    number: "01",
    code: "INTELLIGENCE",
    title: "情報収集・分析",
    description:
      "公開情報や公開資料を対象に、情報の整理・分析・検証を行います。",
  },
  {
    number: "02",
    code: "TECHNOLOGY",
    title: "技術研究",
    description:
      "ネットワーク、情報セキュリティ、システム技術などを研究します。",
  },
  {
    number: "03",
    code: "DOCUMENTATION",
    title: "記録・資料管理",
    description:
      "研究内容や活動記録を整理し、出典と確認状況を明確にして保存します。",
  },
];

function ScrambleText({
  text,
  delay = 0,
  speed = 24,
}: {
  text: string;
  delay?: number;
  speed?: number;
}) {
  const [display, setDisplay] = useState(text);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#*+-";
    let frame = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        frame += 1;
        const resolvedCount = Math.floor(frame / 2);

        const next = text
          .split("")
          .map((char, idx) => {
            if (char === " " || char === "/" || char === "—" || char === "&") {
              return char;
            }
            if (idx < resolvedCount) return text[idx];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("");

        setDisplay(next);

        if (resolvedCount >= text.length) {
          setDisplay(text);
          if (intervalId) clearInterval(intervalId);
        }
      }, speed);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [started, text, delay, speed]);

  return (
    <span ref={ref} className="scramble-text">
      {display}
    </span>
  );
}

function Emblem({ large = false }: { large?: boolean }) {
  return (
    <div
      className={`emblem ${large ? "emblem-large" : ""}`}
      aria-label="死穢八斎會 ロゴ"
    >
      <div className="emblem-inner">
        <img
          src={logoImg.src}
          alt="SHIE HASSAIKAI LOGO"
          className="emblem-image"
        />
      </div>
    </div>
  );
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);

  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("member");
  const isAdmin = userRole === "admin";

  // 設定フォーム用ステート
  const [username, setUsername] = useState<string>("");
  const [savingName, setSavingName] = useState(false);
  const [nameFeedback, setNameFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);

  const closeMenu = () => setMenuOpen(false);

  const openSettings = () => {
    setMenuOpen(false);
    setNameFeedback(null);
    setPasswordFeedback(null);
    setNewPassword("");
    setConfirmPassword("");
    setSettingsOpen(true);
  };

  const closeSettings = () => {
    setSettingsOpen(false);
  };

  useEffect(() => {
    let isMounted = true;

    const savedName = localStorage.getItem(HANDLE_STORAGE_KEY) || "";
    const savedSound = localStorage.getItem(SOUND_STORAGE_KEY);
    if (savedName) setUsername(savedName);
    if (savedSound !== null) setSoundEnabled(savedSound === "true");

    const checkUserAndProfile = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user || !isMounted) return;

      setUserId(user.id);
      setUserEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (profile) {
        if (profile.role) setUserRole(profile.role);
        if (profile.username) {
          setUsername(profile.username);
          localStorage.setItem(HANDLE_STORAGE_KEY, profile.username);
        }
      }
    };

    checkUserAndProfile();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  // Escキーで設定ドロワーを閉じる
  useEffect(() => {
    if (!settingsOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 960 && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [menuOpen]);

  useEffect(() => {
    document.body.style.overflow = menuOpen || settingsOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen, settingsOpen]);

  useEffect(() => {
    const targets = document.querySelectorAll(".reveal-text");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // ユーザーネーム変更
  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingName) return;

    const finalName = username.trim() || "MEMBER";
    setSavingName(true);
    setNameFeedback(null);

    setUsername(finalName);
    localStorage.setItem(HANDLE_STORAGE_KEY, finalName);

    if (userId) {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        username: finalName,
        role: userRole,
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        setNameFeedback({
          type: "err",
          text: "ユーザー名の保存に失敗しました。再度お試しください。⚠️",
        });
        setSavingName(false);
        return;
      }

      await supabase
        .from("posts")
        .update({ author_name: finalName })
        .eq("user_id", userId);

      await supabase
        .from("post_replies")
        .update({ author_name: finalName })
        .eq("user_id", userId);
    }

    setSavingName(false);
    setNameFeedback({
      type: "ok",
      text: `ユーザー名を「${finalName}」に更新しました。`,
    });
  };

  // パスワード変更
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPassword) return;

    setPasswordFeedback(null);

    if (newPassword.length < 6) {
      setPasswordFeedback({
        type: "err",
        text: "パスワードは6文字以上で入力してください。",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: "err",
        text: "確認用パスワードが一致していません。",
      });
      return;
    }

    setSavingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setPasswordFeedback({
        type: "err",
        text: `パスワードの変更に失敗しました（${error.message}）`,
      });
    } else {
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFeedback({
        type: "ok",
        text: "パスワードを正常に変更しました。",
      });
    }

    setSavingPassword(false);
  };

  // サウンド通知切り替え
  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(SOUND_STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <main className="responsive-page">
      {/* HEADER */}
      <header className="site-header">
        <div className="header-inner">
          <a href="#home" className="brand" onClick={closeMenu}>
            <Emblem />
            <span className="brand-name">
              <strong>死穢八斎會</strong>
              <small>SHIE HASSAIKAI</small>
            </span>
          </a>

          <button
            type="button"
            className={`menu-toggle ${menuOpen ? "active" : ""}`}
            aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span />
            <span />
            <span />
          </button>

          <nav className={`global-nav ${menuOpen ? "is-open" : ""}`}>
            {navigation.map((item, index) => (
              <a key={item.label} href={item.href} onClick={closeMenu}>
                <span className="nav-number">0{index + 1}</span>
                <span className="nav-label">{item.label}</span>
              </a>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className="mobile-only-contact"
                onClick={closeMenu}
              >
                ⚙ ADMIN <span>↗</span>
              </Link>
            )}
            <a
              href="#settings"
              className="mobile-only-contact"
              onClick={(e) => {
                e.preventDefault();
                openSettings();
              }}
            >
              ⚙ 設定 <span>→</span>
            </a>
            <a
              href="#contact"
              className="mobile-only-contact"
              onClick={closeMenu}
            >
              CONTACT <span>↗</span>
            </a>
            <div className="mobile-only-logout" onClick={closeMenu}>
              <LogoutButton className="header-logout-btn" label="LOGOUT ↗" />
            </div>
          </nav>

          <div className="header-actions">
            {isAdmin && (
              <Link href="/admin" className="header-logout-btn">
                ⚙ ADMIN ↗
              </Link>
            )}
            <a href="#contact" className="header-contact">
              CONTACT <span className="arrow-icon">↗</span>
            </a>
            <button
              type="button"
              className="header-settings-btn"
              onClick={openSettings}
              aria-label="設定を開く"
            >
              ⚙ 設定
            </button>
            <LogoutButton className="header-logout-btn" label="LOGOUT ↗" />
          </div>
        </div>
      </header>

      {/* RIGHT SLIDE-IN SETTINGS DRAWER */}
      <div
        className={`settings-drawer-backdrop ${settingsOpen ? "is-open" : ""}`}
        onClick={closeSettings}
        aria-hidden={!settingsOpen}
      />
      <aside
        className={`settings-drawer ${settingsOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-settings-title"
        aria-hidden={!settingsOpen}
      >
        <div className="settings-drawer-header">
          <div>
            <span className="settings-drawer-kicker">
              OPERATOR CONFIGURATION
            </span>
            <h2 id="home-settings-title">アカウント・システム設定</h2>
          </div>
          <button
            type="button"
            className="settings-drawer-close"
            onClick={closeSettings}
            aria-label="設定を閉じる"
          >
            ×
          </button>
        </div>

        <div className="settings-drawer-body">
          {/* アカウントステータス */}
          <div className="settings-account-card">
            <div className="settings-account-top">
              <span className="settings-account-badge">
                {isAdmin ? "ADMIN CLEARANCE" : "VERIFIED MEMBER"}
              </span>
              <span className="settings-account-status">
                <i className="status-dot" /> ACTIVE
              </span>
            </div>
            <strong className="settings-account-name">
              {username.trim() || "MEMBER"}
            </strong>
            <span className="settings-account-email">
              {userEmail || "AUTHENTICATED SESSION"}
            </span>
          </div>

          {/* 01. ユーザー名変更 */}
          <form className="settings-section-box" onSubmit={handleUpdateUsername}>
            <div className="settings-section-title">
              <span>01 // USER NAME</span>
              <small>表示名の変更🧩</small>
            </div>
            <p className="settings-section-desc">
              掲示板・チャット・オンライン一覧に表示されるオペレーター名を変更します。
            </p>
            <div className="settings-field">
              <label htmlFor="drawer-username">新しいユーザー名</label>
              <input
                id="drawer-username"
                type="text"
                className="settings-input"
                placeholder="表示名を入力（最大30文字）"
                maxLength={30}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            {nameFeedback && (
              <p className={`settings-feedback is-${nameFeedback.type}`}>
                {nameFeedback.text}
              </p>
            )}

            <button
              type="submit"
              className="settings-submit-btn"
              disabled={savingName}
            >
              {savingName ? "保存中..." : "ユーザー名を保存する"}
            </button>
          </form>

          {/* 02. パスワード変更 */}
          <form className="settings-section-box" onSubmit={handleUpdatePassword}>
            <div className="settings-section-title">
              <span>02 // SECURITY KEY</span>
              <small>パスワードの変更</small>
            </div>
            <p className="settings-section-desc">
              ログインに使用するパスワードを変更します（6文字以上）。
            </p>
            <div className="settings-field">
              <label htmlFor="drawer-new-password">新しいパスワード</label>
              <input
                id="drawer-new-password"
                type="password"
                className="settings-input"
                placeholder="6文字以上の新しいパスワード"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="settings-field">
              <label htmlFor="drawer-confirm-password">
                新しいパスワード（確認用）
              </label>
              <input
                id="drawer-confirm-password"
                type="password"
                className="settings-input"
                placeholder="確認のためもう一度入力"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {passwordFeedback && (
              <p className={`settings-feedback is-${passwordFeedback.type}`}>
                {passwordFeedback.text}
              </p>
            )}

            <button
              type="submit"
              className="settings-submit-btn"
              disabled={savingPassword || !newPassword || !confirmPassword}
            >
              {savingPassword ? "更新中..." : "パスワードを変更する"}
            </button>
          </form>

          {/* 03. 環境設定 */}
          <div className="settings-section-box">
            <div className="settings-section-title">
              <span>03 // PREFERENCES</span>
              <small>通知・環境設定</small>
            </div>

            <div className="settings-toggle-row">
              <div>
                <strong>掲示板の着信通知サウンド</strong>
                <small>新規メッセージ受信時に通知音を鳴らします</small>
              </div>
              <button
                type="button"
                className={`settings-switch ${soundEnabled ? "is-on" : ""}`}
                onClick={handleToggleSound}
              >
                {soundEnabled ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* HERO */}
      <section className="hero" id="home">
        <div className="hero-grid" />
        <div className="hero-noise" />

        <div className="hero-content">
          <div className="hero-eyebrow hero-anim-eyebrow">
            <span className="status-dot" />
            <ScrambleText
              text="AUTONOMOUS DIGITAL COLLECTIVE"
              delay={100}
              speed={20}
            />
            <span className="hero-eyebrow-line" />
            <span>EST. 2026</span>
          </div>

          <div className="hero-title-wrap">
            <p className="hero-pretitle hero-anim-pretitle">
              <ScrambleText
                text="THE UNDERGROUND SYNDICATE"
                delay={250}
                speed={22}
              />
            </p>
            <h1 className="fluid-hero-title hero-anim-title">死穢八斎會</h1>
            <p className="hero-english hero-anim-english">SHIE HASSAIKAI</p>
          </div>

          <div className="hero-divider hero-anim-divider">
            <span />
            <span />
            <span />
          </div>

          <p className="hero-description hero-anim-desc">
            OpenChatを通じて荒らし界隈の大規模組織へようこそ。<br />
            本組織は、荒らし・トロール行為🔪・LineJSツール開発・乗っ取りなどの依頼を請け負っております。<br />
            日本国内での荒らし界隈組織です。<br />
            公式LINEや掲示板を通じて、情報収集やメンバー👾コミュニティ活動を行っています。<br />
            
            <br />
          　組織の理念や活動内容については、以下のボタンからご確認ください。
          </p>

          <div className="hero-actions hero-anim-actions">
            <a href="#about" className="button button-red">
              <span>組織概要・理念</span>
              <span className="button-arrow">↗</span>
            </a>
            <a href="#activities" className="button button-ghost">
              <span>活動領域</span>
              <span className="button-arrow">→</span>
            </a>
            <a
              href={OPENCHAT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="button button-openchat"
            >
              <span className="openchat-label">
                <svg
                  className="openchat-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M12 3C6.48 3 2 6.92 2 11.75c0 2.75 1.46 5.2 3.75 6.81-.16.6-.6 2.18-.69 2.52-.11.42.15.41.32.3.13-.09 2.13-1.45 2.99-2.04.84.23 1.72.36 2.63.36 5.52 0 10-3.92 10-8.75S17.52 3 12 3zm-3.2 10.2h-2.1V8.8h1.1v3.4h1v1zm1.8 0H9.5V8.8h1.1v4.4zm4.3 0h-.95l-1.75-2.45v2.45h-1.1V8.8h.95l1.75 2.45V8.8h1.1v4.4zm3.4-2.75v1h-1.4v.75h1.6v1h-2.7V8.8h2.7v1h-1.6v.65h1.4z"
                  />
                </svg>
                <span>JOIN OpenChat</span>
              </span>
              <span className="button-arrow">↗</span>
            </a>
          </div>
        </div>

        <div className="hero-emblem hero-anim-emblem">
          <Emblem large />
          <span className="hero-emblem-caption">
            <ScrambleText text="SH / 2026" delay={600} speed={35} />
          </span>
        </div>

        <div className="hero-index">
          <span>01</span>
          <span className="hero-index-line" />
          <span>08</span>
        </div>

        <div className="hero-bottom">
          <span>OFFICIAL ORGANIZATION PROFILE</span>
          <span>JAPAN / DIGITAL ARCHIVE</span>
        </div>
      </section>

      {/* INTRO STRIP */}
      <div className="intro-strip">
        <div className="intro-strip-inner">
          <span className="strip-word">
            <ScrambleText text="DISCIPLINE" delay={50} speed={25} />
          </span>
          <i />
          <span className="strip-word">
            <ScrambleText text="RESEARCH" delay={150} speed={25} />
          </span>
          <i />
          <span className="strip-word">
            <ScrambleText text="DOCUMENTATION" delay={250} speed={25} />
          </span>
          <i />
          <span className="strip-word">
            <ScrambleText text="TECHNOLOGY" delay={350} speed={25} />
          </span>
        </div>
      </div>

      {/* 01: NEWS */}
      <section className="section news-section" id="news">
        <div className="section-inner">
          <div className="section-heading reveal-text">
            <div>
              <p className="section-label">
                <ScrambleText text="01 — INFORMATION" delay={50} speed={24} />
              </p>
              <h2 className="heading-flash">お知らせ</h2>
            </div>
            <span className="section-heading-en">
              <ScrambleText text="LATEST NEWS" delay={150} speed={28} />
            </span>
          </div>

          <div className="news-empty reveal-text reveal-delay-1">
            <span className="news-empty-line" />
            <span className="news-empty-label">INFORMATION DESK</span>
            <h3>現在、お知らせはありません。</h3>
            <p>新しい情報は、こちらのページで公開します。</p>
            <span className="news-empty-code">
              <ScrambleText text="NO ANNOUNCEMENTS" delay={200} speed={24} />
            </span>
          </div>
        </div>
      </section>

      {/* 02: ABOUT */}
      <section className="section about-section" id="about">
        <div className="section-inner">
          <div className="section-heading reveal-text">
            <div>
              <p className="section-label">
                <ScrambleText text="02 — ORGANIZATION" delay={50} speed={24} />
              </p>
              <h2 className="heading-flash">組織概要</h2>
            </div>
            <span className="section-heading-en">
              <ScrambleText text="ABOUT US" delay={150} speed={28} />
            </span>
          </div>

          <div className="about-layout">
            <div className="about-main reveal-text reveal-delay-1">
              <p className="about-kicker">
                <ScrambleText text="OUR PRINCIPLE" delay={100} speed={26} />
              </p>
              <h3 className="fluid-section-lead">
                <span className="reveal-line line-1">知識を蓄え、</span>
                <span className="reveal-line line-2">技術を磨き、</span>
                <span className="reveal-line line-3">記録を残す。</span>
              </h3>

              <div className="red-rule" />

              <p className="about-description reveal-body">
                死穢八斎會は、情報収集・技術研究・資料整理などの
                活動を記録し、紹介する組織です。
                公開情報を適切に取り扱い、技術的な知識を深め、
                調査結果を整理・共有することを目指しています。
              </p>
            </div>

            <div className="organization-panel reveal-text reveal-delay-2">
              <div className="panel-heading">
                <span>ORGANIZATION PROFILE</span>
                <span className="panel-index">SH / 001</span>
              </div>

              <div className="organization-emblem">
                <Emblem large />
              </div>

              <dl className="profile-list">
                <div>
                  <dt>組織名</dt>
                  <dd>死穢八斎會</dd>
                </div>
                <div>
                  <dt>英語表記</dt>
                  <dd>SHIE HASSAIKAI</dd>
                </div>
                <div>
                  <dt>活動分野</dt>
                  <dd>情報・技術研究</dd>
                </div>
                <div>
                  <dt>活動方針</dt>
                  <dd>調査 / 研究 / 記録</dd>
                </div>
                <div>
                  <dt>情報の範囲</dt>
                  <dd>公開情報・技術資料</dd>
                </div>
              </dl>

              <div className="panel-footer">
                <span>OFFICIAL PROFILE</span>
                <span>02 / 08</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 03: ACTIVITIES */}
      <section className="section activities-section" id="activities">
        <div className="section-inner">
          <div className="section-heading reveal-text">
            <div>
              <p className="section-label">
                <ScrambleText text="03 — OPERATIONS" delay={50} speed={24} />
              </p>
              <h2 className="heading-flash">活動内容</h2>
            </div>
            <span className="section-heading-en">
              <ScrambleText text="OUR ACTIVITIES" delay={150} speed={28} />
            </span>
          </div>

          <div className="activity-intro reveal-text reveal-delay-1">
            <p>
              主な活動領域
              <span> / AREAS OF INTEREST</span>
            </p>
            <span>
              <ScrambleText
                text="THREE CORE DIVISIONS"
                delay={150}
                speed={24}
              />
            </span>
          </div>

          <div className="activity-grid">
            {activities.map((activity, idx) => (
              <article
                className={`activity-card reveal-text reveal-delay-${idx + 1}`}
                key={activity.number}
              >
                <div className="activity-card-top">
                  <span className="activity-number">{activity.number}</span>
                  <span className="activity-symbol">◆</span>
                </div>

                <p className="activity-code">
                  <ScrambleText
                    text={activity.code}
                    delay={120 * (idx + 1)}
                    speed={26}
                  />
                </p>
                <h3>{activity.title}</h3>
                <p className="activity-description">{activity.description}</p>

                <div className="activity-card-bottom">
                  <span>SHIE HASSAIKAI</span>
                  <span className="card-arrow">↗</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 04: RESEARCH */}
      <section className="research-section" id="research">
        <div className="research-background-mark">SH</div>

        <div className="section-inner research-inner">
          <div className="section-heading reveal-text">
            <div>
              <p className="section-label">
                <ScrambleText
                  text="04 — RESEARCH DIVISION"
                  delay={50}
                  speed={24}
                />
              </p>
              <h2 className="heading-flash">研究・調査</h2>
            </div>
            <span className="section-heading-en">
              <ScrambleText text="RESEARCH" delay={150} speed={28} />
            </span>
          </div>

          <div className="research-content">
            <div className="research-side reveal-text reveal-delay-1">
              <span className="research-side-number">04</span>
              <span className="research-side-line" />
              <span className="research-side-label">KNOWLEDGE / 2026</span>
            </div>

            <div className="research-main reveal-text reveal-delay-2">
              <p className="research-kicker">
                <ScrambleText
                  text="ANALYSIS & TECHNOLOGY"
                  delay={100}
                  speed={24}
                />
              </p>
              <h3 className="fluid-section-lead">
                <span className="reveal-line line-1">情報の価値は、</span>
                <span className="reveal-line line-2">
                  正確な理解から生まれる。
                </span>
              </h3>

              <p className="research-description reveal-body">
                公開情報や技術資料をもとに、情報セキュリティ、
                ネットワーク、システムなどの分野を調査・研究します。
                調査内容には出典・収集日・確認状況を記録し、
                情報の正確性と適切な取り扱いを重視します。
              </p>

              <div className="research-tags">
                <span>INFORMATION SECURITY</span>
                <span>NETWORK</span>
                <span>TECHNOLOGY</span>
                <span>DOCUMENTATION</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 05: ARCHIVE */}
      <section className="section archive-section" id="archive">
        <div className="section-inner">
          <div className="section-heading reveal-text">
            <div>
              <p className="section-label">
                <ScrambleText text="05 — RECORDS" delay={50} speed={24} />
              </p>
              <h2 className="heading-flash">記録・アーカイブ</h2>
            </div>
            <span className="section-heading-en">
              <ScrambleText text="ARCHIVE" delay={150} speed={28} />
            </span>
          </div>

          <div className="archive-panel reveal-text reveal-delay-1">
            <div className="archive-panel-header">
              <span>DOCUMENT REGISTER</span>
              <span>ARCHIVE / 001</span>
            </div>

            <div className="archive-empty">
              <span className="archive-empty-icon">—</span>
              <h3>資料はまだ登録されていません。</h3>
              <p>今後、公開可能な研究資料や活動記録を掲載します。</p>
              <span className="archive-empty-en">
                <ScrambleText
                  text="NO PUBLIC DOCUMENTS AVAILABLE"
                  delay={200}
                  speed={22}
                />
              </span>
            </div>

            <div className="archive-panel-footer">
              <span>PUBLIC DOCUMENTS ONLY</span>
              <span>STATUS : PENDING</span>
            </div>
          </div>
        </div>
      </section>

      {/* 06: HISTORY */}
      <section className="section history-section" id="history">
        <div className="section-inner">
          <div className="section-heading reveal-text">
            <div>
              <p className="section-label">
                <ScrambleText text="06 — CHRONICLE" delay={50} speed={24} />
              </p>
              <h2 className="heading-flash">沿革</h2>
            </div>
            <span className="section-heading-en">
              <ScrambleText text="HISTORY" delay={150} speed={28} />
            </span>
          </div>

          <div className="history-timeline">
            <div className="timeline-item reveal-text reveal-delay-1">
              <span className="timeline-year">2026</span>
              <span className="timeline-dot" />
              <div className="timeline-content">
                <span className="timeline-category">WEBSITE PROJECT</span>
                <h3>公式ウェブサイト制作開始</h3>
                <p>
                  組織の活動と研究情報を紹介する公式ウェブサイトの制作を開始。
                </p>
              </div>
            </div>

            <div className="timeline-item reveal-text reveal-delay-2">
              <span className="timeline-year">—</span>
              <span className="timeline-dot" />
              <div className="timeline-content">
                <span className="timeline-category">NEXT RECORD</span>
                <h3>次の活動記録</h3>
                <p>今後の活動内容に応じて沿革を更新します。</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 07: BULLETIN BOARD */}
      <section className="section bbs-section" id="board">
        <div className="section-inner">
          <div className="section-heading reveal-text">
            <div>
              <p className="section-label">
                <ScrambleText text="07 — BULLETIN BOARD" delay={50} speed={24} />
              </p>
              <h2 className="heading-flash">コミュニティ・掲示板</h2>
            </div>
            <span className="section-heading-en">
              <ScrambleText text="BOARD" delay={150} speed={28} />
            </span>
          </div>

          <div className="board-gateway reveal-text reveal-delay-1">
            <div className="board-gateway-header">
              <span>COMMUNITY HUB / MEMBER NETWORK</span>
              <span className="board-gateway-status">
                <i className="status-dot" />
                ONLINE
              </span>
            </div>

            <div className="board-gateway-body">
              <div className="board-gateway-info">
                <p className="about-kicker">GATHERING &amp; DISCUSSION</p>
                <h3>メンバー間の情報共有・交流スペース</h3>
                <p>
                  死穢八斎會に所属するメンバーが集まり、日々の技術検証の共有、調査トピックに関する意見交換、連絡事項の伝達を行う専用コミュニティ掲示板です。以下のボタンから専用サイトへ切り替えて参加できます。
                </p>
                <ul className="board-gateway-list">
                  <li>
                    <span>01</span> 調査報告・技術トピックのリアルタイム共有
                  </li>
                  <li>
                    <span>02</span> メンバー同士の質疑応答・ディスカッション
                  </li>
                  <li>
                    <span>03</span> 認証済みメンバー専用のクローズドログ閲覧
                  </li>
                </ul>
              </div>

              <div className="board-gateway-action">
                <span className="board-gateway-code">DEDICATED TERMINAL // 07</span>
                <strong>専用掲示板サイトへ切り替え</strong>
                <p>現在のログイン状態のまま専用ページへ移動します。</p>
                <Link href="/board" className="button button-red board-gateway-btn">
                  <span>アクセスする</span>
                  <span className="button-arrow">↗</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 08: TOOLS / DEVELOPMENT */}
      <section className="section tools-section" id="tools">
        <div className="section-inner">
          <div className="section-heading reveal-text">
            <div>
              <p className="section-label">
                <ScrambleText text="08 — DEVELOPMENT LAB" delay={50} speed={24} />
              </p>
              <h2 className="heading-flash">開発ツール・ラボ</h2>
            </div>
            <span className="section-heading-en">
              <ScrambleText text="TOOLS" delay={150} speed={28} />
            </span>
          </div>

          <div className="board-gateway reveal-text reveal-delay-1">
            <div className="board-gateway-header">
              <span>DEVELOPMENT ENVIRONMENT / UTILITY SUITE</span>
              <span className="board-gateway-status">
                <i className="status-dot" />
                ONLINE
              </span>
            </div>

            <div className="board-gateway-body">
              <div className="board-gateway-info">
                <p className="about-kicker">SYSTEM &amp; UTILITIES</p>
                <h3>独自開発ツール・検証ユーティリティ公開ポータル</h3>
                <p>
                  死穢八斎會の技術研究部門で設計・開発した各種Webツール、解析ユーティリティ、実験的アプリケーションをまとめた専用サイトです。ブラウザ上から直接起動して検証・利用できます。
                </p>
                <ul className="board-gateway-list">
                  <li>
                    <span>01</span> ネットワーク・情報整理用ユーティリティツール群
                  </li>
                  <li>
                    <span>02</span> 技術検証プロトタイプ・Webアプリケーションの公開
                  </li>
                  <li>
                    <span>03</span> 開発アップデート・リリースノートの随時反映
                  </li>
                </ul>
              </div>

              <div className="board-gateway-action">
                <span className="board-gateway-code">DEDICATED TERMINAL // 08</span>
                <strong>Tools開発サイトへ切り替え</strong>
                <p>開発ツール一覧・専用ポータルページへ移動します。</p>
                <Link href="/tools" className="button button-red board-gateway-btn">
                  <span>アクセスする</span>
                  <span className="button-arrow">↗</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section className="contact-section" id="contact">
        <div className="contact-inner reveal-text">
          <div className="contact-header-info">
            <p className="section-label">
              <ScrambleText
                text="CONTACT / OFFICIAL CHANNELS"
                delay={50}
                speed={24}
              />
            </p>
            <h2 className="heading-flash">お問い合わせ・公式アカウント</h2>
            <p>
              組織への連絡・お問い合わせは公式LINEより受け付けています。
              <br />
              公開プロジェクトや技術資料のソースコードはGitHubにて公開しています。
            </p>
          </div>

          <div className="contact-links">
            {/* 公式LINE */}
            <a
              href={OFFICIAL_LINE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="contact-card contact-card-line"
            >
              <div className="contact-card-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12 3C6.48 3 2 6.92 2 11.75c0 2.75 1.46 5.2 3.75 6.81-.16.6-.6 2.18-.69 2.52-.11.42.15.41.32.3.13-.09 2.13-1.45 2.99-2.04.84.23 1.72.36 2.63.36 5.52 0 10-3.92 10-8.75S17.52 3 12 3zm-3.2 10.2h-2.1V8.8h1.1v3.4h1v1zm1.8 0H9.5V8.8h1.1v4.4zm4.3 0h-.95l-1.75-2.45v2.45h-1.1V8.8h.95l1.75 2.45V8.8h1.1v4.4zm3.4-2.75v1h-1.4v.75h1.6v1h-2.7V8.8h2.7v1h-1.6v.65h1.4z"
                  />
                </svg>
              </div>
              <div className="contact-card-body">
                <span className="contact-card-kicker">OFFICIAL LINE</span>
                <strong>公式LINEアカウント</strong>
                <small>お問い合わせ・連絡窓口</small>
              </div>
              <span className="contact-card-arrow">↗</span>
            </a>

            {/* GitHub */}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="contact-card contact-card-github"
            >
              <div className="contact-card-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
              </div>
              <div className="contact-card-body">
                <span className="contact-card-kicker">SOURCE &amp; ARCHIVE</span>
                <strong>GitHub リポジトリ</strong>
                <small>開発コード・公開プロジェクト</small>
              </div>
              <span className="contact-card-arrow">↗</span>
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-main">
            <a href="#home" className="footer-brand">
              <Emblem />
              <span>
                <strong>死穢八斎會</strong>
                <small>SHIE HASSAIKAI</small>
              </span>
            </a>

            <p className="footer-motto">INFORMATION. TECHNOLOGY. RECORDS.</p>
          </div>

          <div className="footer-navigation">
            {navigation.map((item) => (
              <a href={item.href} key={item.label}>
                {item.label}
              </a>
            ))}
          </div>

          <div className="footer-bottom">
            <span>© 2026 SHIE HASSAIKAI. ALL RIGHTS RESERVED.</span>
            <span>OFFICIAL WEBSITE / JAPAN</span>
          </div>

          <p className="footer-disclaimer">
            本サイトは組織の活動紹介および技術研究情報の公開を目的としています。
            実在する公的機関・軍事組織の公式サイトではありません。
          </p>
        </div>
      </footer>
    </main>
  );
}
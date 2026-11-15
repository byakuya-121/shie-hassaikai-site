"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup" | "admin";

export default function LoginForm() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    if (mode === "signup" && password.length < 8) {
      setErrorMessage("パスワードは8文字以上にしてください。");
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      if (mode === "login" || mode === "admin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setErrorMessage(
            "ログインできませんでした。入力内容を確認してください。"
          );
          setLoading(false);
          return;
        }

        if (mode === "admin") {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user?.app_metadata?.role !== "admin") {
            setErrorMessage("このアカウントには管理者権限がありません。");
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }

          router.replace("/admin");
          router.refresh();
          return;
        }

        router.replace("/home");
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(
          "登録できませんでした。入力内容を確認してください。⚠️"
        );
        setLoading(false);
        return;
      }

      if (data.session) {
        router.replace("/home");
        router.refresh();
        return;
      }

      setSuccessMessage(
        "登録を受け付けました。確認メールのリンクから認証を完了してください。⚠️"
      );

      setPassword("");
      setLoading(false);
    } catch {
      setErrorMessage(
        "通信中にエラーが発生しました。時間をおいて再度お試しください "
      );
      setLoading(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrorMessage("");
    setSuccessMessage("");
  }

  return (
    <main className="welcome-screen luxury-welcome">
      <div className="welcome-grid" />
      <div className="luxury-background-glow" />

      {/* HEADER */}
      <header className="welcome-top luxury-header">
        <div className="welcome-brand">
          <div className="welcome-brand-text">
            <strong>死穢八斎會</strong>
            <small>SHIE HASSAIKAI</small>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginLeft: "auto",
            marginRight: "1rem",
          }}
        >
          <button
            type="button"
            onClick={() => changeMode(mode === "admin" ? "login" : "admin")}
            style={{
              background:
                mode === "admin" ? "#8b0000" : "rgba(139, 0, 0, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              color: "#fff",
              padding: "0.5rem 1rem",
              fontSize: "0.75rem",
              fontWeight: "bold",
              letterSpacing: "0.08em",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 0 10px rgba(139, 0, 0, 0.5)",
              zIndex: 10,
            }}
          >
            {mode === "admin" ? "通常ログインへ戻る" : "⚙ 管理者権限ログイン"}
          </button>

          <span className="welcome-version">MEMBER PORTAL / 2026 </span>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <section className="welcome-container luxury-container">
        {/* LEFT VISUAL */}
        <div className="welcome-visual luxury-visual">
          <div className="luxury-light" />

          <div className="welcome-orbit orbit-one" />
          <div className="welcome-orbit orbit-two" />

          {/* ORGANIZATION EMBLEM */}
          <div className="luxury-crest-wrapper">
            <Image
              src="/images/shie-hassaikai-logo.png"
              alt="死穢八斎會 公式エンブレム"
              width={1079}
              height={1113}
              className="welcome-crest-image"
              priority
            />
          </div>

          {/* ORGANIZATION TITLE */}
          <div className="welcome-visual-text luxury-title">
            <span>
              {mode === "admin"
                ? "ADMINISTRATOR PORTAL"
                : "ORGANIZATION ACCESS PORTAL"}
            </span>

            <h1>死穢八斎會</h1>

            <p>SHIE HASSAIKAI</p>
          </div>

          <div className="welcome-visual-bottom">
            <span>DISCIPLINE / RESEARCH / RECORDS</span>

            <span>EST. 2026</span>
          </div>
        </div>

        {/* RIGHT LOGIN PANEL */}
        <div className="welcome-login luxury-login">
          <div className="welcome-login-heading">
            <span className="welcome-label">
              {mode === "admin"
                ? "ADMINISTRATOR AUTHENTICATION"
                : "MEMBER AUTHENTICATION"}
            </span>

            <h2 key={mode}>
              {mode === "login"
                ? "WELCOME"
                : mode === "admin"
                  ? "ADMIN LOGIN"
                  : "JOIN US"}
            </h2>

            <p>
              {mode === "login"
                ? "メンバーポータルへログインしてください。"
                : mode === "admin"
                  ? "管理者権限を持つアカウントでログインしてください。"
                  : "新しいメンバーアカウントを作成します。"}
            </p>
          </div>

          {/* AUTH TABS */}
          {mode !== "admin" && (
            <div className="auth-tabs">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => changeMode("login")}
              >
                LOGIN
              </button>

              <button
                type="button"
                className={mode === "signup" ? "active" : ""}
                onClick={() => changeMode("signup")}
              >
                CREATE ACCOUNT
              </button>
            </div>
          )}

          {/* AUTH FORM */}
          <form onSubmit={handleSubmit}>
            <label htmlFor="email">EMAIL ADDRESS</label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label htmlFor="password">PASSWORD</label>

            <input
              id="password"
              type="password"
              autoComplete={
                mode === "login" || mode === "admin"
                  ? "current-password"
                  : "new-password"
              }
              placeholder={mode === "signup" ? "8文字以上" : "パスワード"}
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            {errorMessage && (
              <p className="login-error" role="alert">
                {errorMessage}
              </p>
            )}

            {successMessage && (
              <p className="login-success" role="status">
                {successMessage}
              </p>
            )}

            <button
              type="submit"
              className="welcome-submit"
              disabled={loading}
            >
              <span>
                {loading
                  ? "PLEASE WAIT..."
                  : mode === "login"
                    ? "LOGIN"
                    : mode === "admin"
                      ? "ADMIN LOGIN"
                      : "CREATE ACCOUNT"}
              </span>

              <span>↗</span>
            </button>
          </form>

          {/* SECURITY STATUS */}
          <div className="welcome-security">
            <span className="status-dot" />
            {mode === "admin"
              ? "RESTRICTED ACCESS / ADMIN MODE"
              : "SECURE AUTHENTICATION"}
          </div>

          <p className="welcome-notice">
            {mode === "login"
              ? "アカウントをお持ちでない方は CREATE ACCOUNT から登録できます。"
              : mode === "admin"
                ? "※管理者権限のないアカウントでのログインは拒否されます。"
                : "登録後、メールアドレスの確認が必要です。"}
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="welcome-footer luxury-footer">
        <span>© 2026 SHIE HASSAIKAI</span>
        <span>MEMBER PORTAL</span>
      </footer>
    </main>
  );
}
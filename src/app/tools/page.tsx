"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import "./tools.css";

type ToolTab = "HASH" | "BASE64" | "JWT" | "JSON";

export default function ToolsPage() {
  const [activeTab, setActiveTab] = useState<ToolTab>("HASH");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 01: HASH GENERATOR
  const [hashInput, setHashInput] = useState("");
  const [hashes, setHashes] = useState({
    "SHA-1": "",
    "SHA-256": "",
    "SHA-384": "",
    "SHA-512": "",
  });

  // 02: BASE64 CONVERTER
  const [b64Mode, setB64Mode] = useState<"ENCODE" | "DECODE">("ENCODE");
  const [b64UrlSafe, setB64UrlSafe] = useState(false);
  const [b64Input, setB64Input] = useState("");
  const [b64Output, setB64Output] = useState("");
  const [b64Error, setB64Error] = useState("");

  // 03: JWT DECODER
  const [jwtInput, setJwtInput] = useState("");
  const [jwtHeader, setJwtHeader] = useState("");
  const [jwtPayload, setJwtPayload] = useState("");
  const [jwtError, setJwtError] = useState("");

  // 04: JSON FORMATTER
  const [jsonInput, setJsonInput] = useState("");
  const [jsonOutput, setJsonOutput] = useState("");
  const [jsonError, setJsonError] = useState("");

  const copyText = async (key: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      // ignore
    }
  };

  // ハッシュ自動計算 (Web Crypto API)
  useEffect(() => {
    let cancelled = false;

    const computeHashes = async () => {
      if (!hashInput) {
        setHashes({
          "SHA-1": "",
          "SHA-256": "",
          "SHA-384": "",
          "SHA-512": "",
        });
        return;
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(hashInput);
      const algos = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;

      const results: Record<string, string> = {};
      for (const algo of algos) {
        const digest = await crypto.subtle.digest(algo, data);
        const bytes = Array.from(new Uint8Array(digest));
        results[algo] = bytes
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }

      if (!cancelled) {
        setHashes({
          "SHA-1": results["SHA-1"],
          "SHA-256": results["SHA-256"],
          "SHA-384": results["SHA-384"],
          "SHA-512": results["SHA-512"],
        });
      }
    };

    computeHashes();
    return () => {
      cancelled = true;
    };
  }, [hashInput]);

  // Base64 変換 (UTF-8マルチバイト文字完全対応)
  useEffect(() => {
    if (!b64Input) {
      setB64Output("");
      setB64Error("");
      return;
    }

    try {
      if (b64Mode === "ENCODE") {
        const bytes = new TextEncoder().encode(b64Input);
        let binary = "";
        bytes.forEach((b) => {
          binary += String.fromCharCode(b);
        });
        let encoded = btoa(binary);
        if (b64UrlSafe) {
          encoded = encoded
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
        }
        setB64Output(encoded);
        setB64Error("");
      } else {
        let normalized = b64Input.trim().replace(/-/g, "+").replace(/_/g, "/");
        while (normalized.length % 4 !== 0) {
          normalized += "=";
        }
        const binary = atob(normalized);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        setB64Output(decoded);
        setB64Error("");
      }
    } catch {
      setB64Output("");
      setB64Error(
        b64Mode === "DECODE"
          ? "無効なBase64文字列、またはUTF-8としてデコードできないデータです。"
          : "エンコードに失敗しました。"
      );
    }
  }, [b64Input, b64Mode, b64UrlSafe]);

  // JWT デコード
  useEffect(() => {
    const raw = jwtInput.trim();
    if (!raw) {
      setJwtHeader("");
      setJwtPayload("");
      setJwtError("");
      return;
    }

    try {
      const parts = raw.split(".");
      if (parts.length < 2) {
        throw new Error("JWTはドット（.）区切りの形式である必要があります。");
      }

      const decodePart = (segment: string) => {
        let base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4 !== 0) base64 += "=";
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const text = new TextDecoder().decode(bytes);
        return JSON.stringify(JSON.parse(text), null, 2);
      };

      setJwtHeader(decodePart(parts[0]));
      setJwtPayload(decodePart(parts[1]));
      setJwtError("");
    } catch {
      setJwtHeader("");
      setJwtPayload("");
      setJwtError("JWTの解析に失敗しました。トークン形式を確認してください。");
    }
  }, [jwtInput]);

  // JSON 整形
  const handleFormatJson = (indent: number) => {
    if (!jsonInput.trim()) {
      setJsonOutput("");
      setJsonError("");
      return;
    }
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonOutput(JSON.stringify(parsed, null, indent));
      setJsonError("");
    } catch (e) {
      setJsonOutput("");
      setJsonError(
        e instanceof Error ? `JSON構文エラー: ${e.message}` : "JSONの解析に失敗しました。"
      );
    }
  };

  return (
    <main className="tools-page">
      <div className="tools-grid-bg" />
      <div className="tools-glow-bg" />

      {/* HEADER */}
      <header className="tools-header">
        <div className="tools-header-inner">
          <div className="tools-brand">
            <span className="tools-brand-badge">SH // LAB</span>
            <div>
              <strong>死穢八斎會 — TOOLS LAB</strong>
              <small>CRYPTO / ENCODING / INSPECTION UTILITIES</small>
            </div>
          </div>

          <div className="tools-header-actions">
            <Link href="/board" className="tools-nav-btn">
              BOARD ↗
            </Link>
            <Link href="/home" className="tools-back-btn">
              ← HOMEへ戻る
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="tools-hero">
        <div className="tools-container">
          <div className="tools-eyebrow">
            <span className="tools-dot" />
            <span>LOCAL CLIENT-SIDE ENGINE // ZERO SERVER LOGS</span>
          </div>
          <h1>開発ユーティリティ・ラボ</h1>
          <p>
            入力データは外部サーバーへ送信されず、すべてブラウザ内のローカルメモリ上で即時処理されます。
          </p>

          {/* TOOL TABS */}
          <div className="tools-tabs" role="tablist">
            <button
              type="button"
              className={`tools-tab-btn ${activeTab === "HASH" ? "is-active" : ""}`}
              onClick={() => setActiveTab("HASH")}
            >
              <span>01</span> ハッシュ生成 (SHA)
            </button>
            <button
              type="button"
              className={`tools-tab-btn ${activeTab === "BASE64" ? "is-active" : ""}`}
              onClick={() => setActiveTab("BASE64")}
            >
              <span>02</span> Base64 変換
            </button>
            <button
              type="button"
              className={`tools-tab-btn ${activeTab === "JWT" ? "is-active" : ""}`}
              onClick={() => setActiveTab("JWT")}
            >
              <span>03</span> JWT デコーダ
            </button>
            <button
              type="button"
              className={`tools-tab-btn ${activeTab === "JSON" ? "is-active" : ""}`}
              onClick={() => setActiveTab("JSON")}
            >
              <span>04</span> JSON 整形・圧縮
            </button>
          </div>
        </div>
      </section>

      {/* WORKSPACE */}
      <section className="tools-workspace">
        <div className="tools-container">
          {/* 01: HASH GENERATOR */}
          {activeTab === "HASH" && (
            <div className="tool-panel">
              <div className="tool-panel-header">
                <span>01 // CRYPTOGRAPHIC HASH GENERATOR</span>
                <span>WEB CRYPTO API</span>
              </div>

              <div className="tool-panel-body">
                <div className="tool-field">
                  <div className="tool-label-row">
                    <label htmlFor="hash-input">入力テキスト (UTF-8)</label>
                    {hashInput && (
                      <button
                        type="button"
                        className="tool-clear-btn"
                        onClick={() => setHashInput("")}
                      >
                        クリア
                      </button>
                    )}
                  </div>
                  <textarea
                    id="hash-input"
                    className="tool-textarea"
                    rows={4}
                    placeholder="ハッシュ化したい文字列を入力するとリアルタイムで生成されます..."
                    value={hashInput}
                    onChange={(e) => setHashInput(e.target.value)}
                  />
                </div>

                <div className="hash-results">
                  {(Object.keys(hashes) as Array<keyof typeof hashes>).map(
                    (algo) => (
                      <div key={algo} className="hash-row">
                        <div className="hash-row-top">
                          <span className="hash-algo">{algo}</span>
                          <button
                            type="button"
                            className="tool-copy-btn"
                            disabled={!hashes[algo]}
                            onClick={() => copyText(algo, hashes[algo])}
                          >
                            {copiedKey === algo ? "COPIED ✓" : "コピー"}
                          </button>
                        </div>
                        <input
                          type="text"
                          className="tool-output-input"
                          readOnly
                          value={hashes[algo]}
                          placeholder="—"
                        />
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 02: BASE64 CONVERTER */}
          {activeTab === "BASE64" && (
            <div className="tool-panel">
              <div className="tool-panel-header">
                <span>02 // BASE64 ENCODER &amp; DECODER</span>
                <span>UTF-8 SAFE</span>
              </div>

              <div className="tool-panel-body">
                <div className="tool-controls-bar">
                  <div className="tool-segment">
                    <button
                      type="button"
                      className={b64Mode === "ENCODE" ? "is-active" : ""}
                      onClick={() => setB64Mode("ENCODE")}
                    >
                      エンコード (文字列 → Base64)
                    </button>
                    <button
                      type="button"
                      className={b64Mode === "DECODE" ? "is-active" : ""}
                      onClick={() => setB64Mode("DECODE")}
                    >
                      デコード (Base64 → 文字列)
                    </button>
                  </div>

                  {b64Mode === "ENCODE" && (
                    <label className="tool-checkbox">
                      <input
                        type="checkbox"
                        checked={b64UrlSafe}
                        onChange={(e) => setB64UrlSafe(e.target.checked)}
                      />
                      <span>URL-Safe形式（+ / を - _ に変換）</span>
                    </label>
                  )}
                </div>

                <div className="tool-split">
                  <div className="tool-field">
                    <div className="tool-label-row">
                      <label htmlFor="b64-in">
                        {b64Mode === "ENCODE" ? "変換元テキスト" : "Base64文字列"}
                      </label>
                      {b64Input && (
                        <button
                          type="button"
                          className="tool-clear-btn"
                          onClick={() => setB64Input("")}
                        >
                          クリア
                        </button>
                      )}
                    </div>
                    <textarea
                      id="b64-in"
                      className="tool-textarea"
                      rows={7}
                      placeholder={
                        b64Mode === "ENCODE"
                          ? "エンコードする文字列を入力..."
                          : "デコードするBase64文字列を貼り付け..."
                      }
                      value={b64Input}
                      onChange={(e) => setB64Input(e.target.value)}
                    />
                  </div>

                  <div className="tool-field">
                    <div className="tool-label-row">
                      <label htmlFor="b64-out">変換結果</label>
                      <button
                        type="button"
                        className="tool-copy-btn"
                        disabled={!b64Output}
                        onClick={() => copyText("b64", b64Output)}
                      >
                        {copiedKey === "b64" ? "COPIED ✓" : "結果をコピー"}
                      </button>
                    </div>
                    <textarea
                      id="b64-out"
                      className="tool-textarea is-readonly"
                      rows={7}
                      readOnly
                      value={b64Output}
                      placeholder="変換結果がここに表示されます"
                    />
                  </div>
                </div>

                {b64Error && <p className="tool-error">{b64Error}</p>}
              </div>
            </div>
          )}

          {/* 03: JWT DECODER */}
          {activeTab === "JWT" && (
            <div className="tool-panel">
              <div className="tool-panel-header">
                <span>03 // JWT TOKEN INSPECTOR</span>
                <span>HEADER &amp; PAYLOAD</span>
              </div>

              <div className="tool-panel-body">
                <div className="tool-field">
                  <div className="tool-label-row">
                    <label htmlFor="jwt-in">JWT トークン文字列 (eyJ...)</label>
                    {jwtInput && (
                      <button
                        type="button"
                        className="tool-clear-btn"
                        onClick={() => setJwtInput("")}
                      >
                        クリア
                      </button>
                    )}
                  </div>
                  <textarea
                    id="jwt-in"
                    className="tool-textarea"
                    rows={4}
                    placeholder="デコードしたいJWTを貼り付けてください..."
                    value={jwtInput}
                    onChange={(e) => setJwtInput(e.target.value)}
                  />
                </div>

                {jwtError && <p className="tool-error">{jwtError}</p>}

                <div className="tool-split">
                  <div className="tool-field">
                    <div className="tool-label-row">
                      <label>HEADER (アルゴリズム・タイプ)</label>
                      <button
                        type="button"
                        className="tool-copy-btn"
                        disabled={!jwtHeader}
                        onClick={() => copyText("jwt-h", jwtHeader)}
                      >
                        {copiedKey === "jwt-h" ? "COPIED ✓" : "コピー"}
                      </button>
                    </div>
                    <textarea
                      className="tool-textarea is-readonly"
                      rows={8}
                      readOnly
                      value={jwtHeader}
                      placeholder="{}"
                    />
                  </div>

                  <div className="tool-field">
                    <div className="tool-label-row">
                      <label>PAYLOAD (クレームデータ)</label>
                      <button
                        type="button"
                        className="tool-copy-btn"
                        disabled={!jwtPayload}
                        onClick={() => copyText("jwt-p", jwtPayload)}
                      >
                        {copiedKey === "jwt-p" ? "COPIED ✓" : "コピー"}
                      </button>
                    </div>
                    <textarea
                      className="tool-textarea is-readonly"
                      rows={8}
                      readOnly
                      value={jwtPayload}
                      placeholder="{}"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 04: JSON FORMATTER */}
          {activeTab === "JSON" && (
            <div className="tool-panel">
              <div className="tool-panel-header">
                <span>04 // JSON FORMATTER &amp; VALIDATOR</span>
                <span>SYNTAX CHECK</span>
              </div>

              <div className="tool-panel-body">
                <div className="tool-controls-bar">
                  <div className="tool-action-group">
                    <button
                      type="button"
                      className="tool-primary-btn"
                      onClick={() => handleFormatJson(2)}
                    >
                      整形 (2スペース)
                    </button>
                    <button
                      type="button"
                      className="tool-secondary-btn"
                      onClick={() => handleFormatJson(0)}
                    >
                      1行圧縮 (Minify)
                    </button>
                  </div>
                </div>

                <div className="tool-split">
                  <div className="tool-field">
                    <div className="tool-label-row">
                      <label htmlFor="json-in">入力 JSON</label>
                      {jsonInput && (
                        <button
                          type="button"
                          className="tool-clear-btn"
                          onClick={() => {
                            setJsonInput("");
                            setJsonOutput("");
                            setJsonError("");
                          }}
                        >
                          クリア
                        </button>
                      )}
                    </div>
                    <textarea
                      id="json-in"
                      className="tool-textarea"
                      rows={9}
                      placeholder='{"status":"ok","items":[1,2,3]}'
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                    />
                  </div>

                  <div className="tool-field">
                    <div className="tool-label-row">
                      <label htmlFor="json-out">出力結果</label>
                      <button
                        type="button"
                        className="tool-copy-btn"
                        disabled={!jsonOutput}
                        onClick={() => copyText("json", jsonOutput)}
                      >
                        {copiedKey === "json" ? "COPIED ✓" : "結果をコピー"}
                      </button>
                    </div>
                    <textarea
                      id="json-out"
                      className="tool-textarea is-readonly"
                      rows={9}
                      readOnly
                      value={jsonOutput}
                      placeholder="整形または圧縮されたJSONが表示されます"
                    />
                  </div>
                </div>

                {jsonError && <p className="tool-error">{jsonError}</p>}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
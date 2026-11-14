"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import logoImg from "../home/logo.png";
import LogoutButton from "../logout-button";
import { createClient } from "@/lib/supabase/client";

interface ProfileRow {
  id: string;
  username?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  updated_at?: string | null;
}

interface PostRow {
  id: string;
  user_id?: string | null;
  author_name: string;
  author_avatar?: string | null;
  category?: string | null;
  title?: string | null;
  content: string;
  passcode?: string | null;
  created_at: string;
}

interface ReplyRow {
  id: string;
  post_id: string;
  user_id?: string | null;
  author_name: string;
  author_avatar?: string | null;
  content: string;
  image_url?: string | null;
  code_snippet?: string | null;
  is_pinned?: boolean | null;
  created_at: string;
}

type AdminTab = "OPERATORS" | "ROOMS" | "MESSAGES";

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("OPERATORS");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [replies, setReplies] = useState<ReplyRow[]>([]);

  // ユーザー名インライン編集用
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState<string>("");

  const showToast = (type: "ok" | "err", text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  const fetchAllAdminData = useCallback(async () => {
    const [{ data: allProfiles }, { data: allPosts }, { data: allReplies }] =
      await Promise.all([
        supabase.from("profiles").select("*"),
        supabase
          .from("posts")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("post_replies")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

    if (allProfiles) setProfiles(allProfiles as ProfileRow[]);
    if (allPosts) setPosts(allPosts as PostRow[]);
    if (allReplies) setReplies(allReplies as ReplyRow[]);
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    const initAdmin = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: me } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (me?.role !== "admin") {
        router.replace("/home");
        return;
      }

      if (!mounted) return;
      setCurrentUserId(user.id);
      await fetchAllAdminData();
      if (mounted) setLoading(false);
    };

    initAdmin();
    return () => {
      mounted = false;
    };
  }, [supabase, router, fetchAllAdminData]);

  const handleManualRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await fetchAllAdminData();
    setRefreshing(false);
    showToast("ok", "データベースの最新状態に同期しました。");
  };

  // 権限（ADMIN / MEMBER）切替
  const handleToggleRole = async (target: ProfileRow) => {
    if (target.id === currentUserId) {
      showToast("err", "自分自身の管理者権限は解除できません。");
      return;
    }

    const nextRole = target.role === "admin" ? "member" : "admin";
    const { error } = await supabase
      .from("profiles")
      .update({ role: nextRole, updated_at: new Date().toISOString() })
      .eq("id", target.id);

    if (error) {
      showToast("err", `権限の更新に失敗しました（${error.message}）`);
      return;
    }

    setProfiles((prev) =>
      prev.map((p) => (p.id === target.id ? { ...p, role: nextRole } : p))
    );
    showToast(
      "ok",
      `${target.username || "ユーザー"} の権限を ${nextRole.toUpperCase()} に変更しました。`
    );
  };

  // ユーザー名保存（管理者による変更）
  const handleSaveUsername = async (targetId: string) => {
    const trimmed = editingUsername.trim();
    if (!trimmed) {
      showToast("err", "ユーザー名を入力してください。");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username: trimmed, updated_at: new Date().toISOString() })
      .eq("id", targetId);

    if (error) {
      showToast("err", `ユーザー名の更新に失敗しました（${error.message}）`);
      return;
    }

    await supabase
      .from("posts")
      .update({ author_name: trimmed })
      .eq("user_id", targetId);
    await supabase
      .from("post_replies")
      .update({ author_name: trimmed })
      .eq("user_id", targetId);

    setProfiles((prev) =>
      prev.map((p) => (p.id === targetId ? { ...p, username: trimmed } : p))
    );
    setPosts((prev) =>
      prev.map((post) =>
        post.user_id === targetId ? { ...post, author_name: trimmed } : post
      )
    );
    setReplies((prev) =>
      prev.map((rep) =>
        rep.user_id === targetId ? { ...rep, author_name: trimmed } : rep
      )
    );

    setEditingUserId(null);
    setEditingUsername("");
    showToast("ok", `ユーザー名を「${trimmed}」に更新しました。`);
  };

  // ルーム削除
  const handleDeletePost = async (postId: string) => {
    await supabase.from("post_replies").delete().eq("post_id", postId);
    const { error } = await supabase.from("posts").delete().eq("id", postId);

    if (error) {
      showToast("err", `部屋の削除に失敗しました（${error.message}）`);
      return;
    }

    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setReplies((prev) => prev.filter((r) => r.post_id !== postId));
    showToast("ok", "ルームおよび関連ログを削除しました。");
  };

  // チャット返信のピン留め切替
  const handleTogglePinReply = async (reply: ReplyRow) => {
    const nextPin = !reply.is_pinned;
    const { error } = await supabase
      .from("post_replies")
      .update({ is_pinned: nextPin })
      .eq("id", reply.id);

    if (error) {
      showToast("err", `ピン留め更新に失敗しました（${error.message}）`);
      return;
    }

    setReplies((prev) =>
      prev.map((r) => (r.id === reply.id ? { ...r, is_pinned: nextPin } : r))
    );
    showToast(
      "ok",
      nextPin ? "メッセージをピン留めしました。" : "ピン留めを解除しました。"
    );
  };

  // チャット返信削除
  const handleDeleteReply = async (replyId: string) => {
    const { error } = await supabase
      .from("post_replies")
      .delete()
      .eq("id", replyId);

    if (error) {
      showToast("err", `メッセージの削除に失敗しました（${error.message}）`);
      return;
    }

    setReplies((prev) => prev.filter((r) => r.id !== replyId));
    showToast("ok", "チャットメッセージを削除しました。");
  };

  // 統計値
  const adminCount = useMemo(
    () => profiles.filter((p) => p.role === "admin").length,
    [profiles]
  );
  const lockedRoomCount = useMemo(
    () => posts.filter((p) => Boolean(p.passcode)).length,
    [posts]
  );

  // 検索フィルタ適用後データ
  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        (p.username || "").toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.role || "").toLowerCase().includes(q)
    );
  }, [profiles, searchQuery]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        (p.title || "").toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.author_name.toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
    );
  }, [posts, searchQuery]);

  const filteredReplies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return replies;
    return replies.filter(
      (r) =>
        r.content.toLowerCase().includes(q) ||
        r.author_name.toLowerCase().includes(q)
    );
  }, [replies, searchQuery]);

  if (loading) {
    return (
      <main className="admin-loading">
        <span className="admin-dot" />
        <span>VERIFYING ADMIN CLEARANCE...</span>
        <style>{`
          .admin-loading {
            min-height: 100vh;
            background: #070708;
            color: #f2f2f4;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
            font-family: monospace;
            font-size: 0.9rem;
            letter-spacing: 0.2em;
          }
          .admin-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #d91e2a;
            box-shadow: 0 0 12px #d91e2a;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-grid-bg" />
      <div className="admin-noise-bg" />

      {/* HEADER */}
      <header className="admin-header">
        <div className="admin-header-inner">
          <Link href="/home" className="admin-brand">
            <div className="admin-emblem">
              <img src={logoImg.src} alt="SHIE HASSAIKAI LOGO" />
            </div>
            <div className="admin-brand-text">
              <strong>死穢八斎會</strong>
              <small>ADMINISTRATION TERMINAL</small>
            </div>
          </Link>

          <div className="admin-header-actions">
            <button
              type="button"
              className="admin-btn-ghost"
              onClick={handleManualRefresh}
              disabled={refreshing}
            >
              {refreshing ? "SYNCING..." : "↻ SYNC DATA"}
            </button>
            <Link href="/board" className="admin-btn-red-outline">
              BOARD ↗
            </Link>
            <Link href="/home" className="admin-btn-ghost">
              ← PORTAL HOME
            </Link>
            <LogoutButton className="admin-btn-logout" label="LOGOUT ↗" />
          </div>
        </div>
      </header>

      <div className="admin-container">
        {/* HERO TITLE */}
        <section className="admin-hero">
          <div className="admin-eyebrow">
            <span className="admin-dot" />
            <span>ROOT CLEARANCE // SYSTEM CONTROL</span>
          </div>
          <div className="admin-hero-row">
            <h1>管理者コンソール</h1>
            <span>SHIE HASSAIKAI / ADMIN</span>
          </div>
        </section>

        {/* フィードバックトースト */}
        {statusMessage && (
          <div className={`admin-toast is-${statusMessage.type}`}>
            <span>{statusMessage.text}</span>
            <button type="button" onClick={() => setStatusMessage(null)}>
              ×
            </button>
          </div>
        )}

        {/* KPI SUMMARY CARDS */}
        <section className="admin-stats-grid">
          <div className="admin-stat-card">
            <span className="admin-stat-label">TOTAL OPERATORS</span>
            <strong className="admin-stat-value">{profiles.length}</strong>
            <small>登録メンバー総数</small>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-label">ADMIN CLEARANCE</span>
            <strong className="admin-stat-value is-crimson">{adminCount}</strong>
            <small>管理者権限アカウント</small>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-label">ACTIVE ROOMS</span>
            <strong className="admin-stat-value">{posts.length}</strong>
            <small>うち鍵付き部屋: {lockedRoomCount} 件</small>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-label">CHAT TRANSMISSIONS</span>
            <strong className="admin-stat-value">{replies.length}</strong>
            <small>累計チャット発言数</small>
          </div>
        </section>

        {/* TABS & SEARCH BAR */}
        <div className="admin-toolbar">
          <div className="admin-tabs">
            <button
              type="button"
              className={`admin-tab-btn ${
                activeTab === "OPERATORS" ? "is-active" : ""
              }`}
              onClick={() => setActiveTab("OPERATORS")}
            >
              01 // OPERATORS ({profiles.length})
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${
                activeTab === "ROOMS" ? "is-active" : ""
              }`}
              onClick={() => setActiveTab("ROOMS")}
            >
              02 // ROOMS ({posts.length})
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${
                activeTab === "MESSAGES" ? "is-active" : ""
              }`}
              onClick={() => setActiveTab("MESSAGES")}
            >
              03 // CHAT LOGS ({replies.length})
            </button>
          </div>

          <input
            type="text"
            className="admin-search-input"
            placeholder="キーワード・ユーザー名・IDで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* TAB 01: OPERATORS */}
        {activeTab === "OPERATORS" && (
          <section className="admin-panel">
            <div className="admin-panel-head">
              <span>REGISTERED OPERATORS DIRECTORY</span>
              <span>SHOWING {filteredProfiles.length} RECORDS</span>
            </div>

            {filteredProfiles.length === 0 ? (
              <div className="admin-empty">該当するユーザーはいません。</div>
            ) : (
              <div className="admin-list">
                {filteredProfiles.map((p) => {
                  const isSelf = p.id === currentUserId;
                  const isEditing = editingUserId === p.id;
                  const roleLabel = (p.role || "member").toUpperCase();

                  return (
                    <div key={p.id} className="admin-row">
                      <div className="admin-row-main">
                        <img
                          src={p.avatar_url || logoImg.src}
                          alt={p.username || "OPERATOR"}
                          className="admin-avatar"
                        />
                        <div className="admin-row-info">
                          {isEditing ? (
                            <div className="admin-inline-edit">
                              <input
                                type="text"
                                maxLength={30}
                                value={editingUsername}
                                onChange={(e) =>
                                  setEditingUsername(e.target.value)
                                }
                                className="admin-inline-input"
                                autoFocus
                              />
                              <button
                                type="button"
                                className="admin-action-btn is-crimson"
                                onClick={() => handleSaveUsername(p.id)}
                              >
                                保存
                              </button>
                              <button
                                type="button"
                                className="admin-action-btn"
                                onClick={() => {
                                  setEditingUserId(null);
                                  setEditingUsername("");
                                }}
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <div className="admin-row-title-line">
                              <strong>{p.username || "未設定ユーザー"}</strong>
                              <span
                                className={`admin-role-badge ${
                                  roleLabel === "ADMIN" ? "is-admin" : ""
                                }`}
                              >
                                {roleLabel}
                              </span>
                              {isSelf && (
                                <span className="admin-self-tag">YOU</span>
                              )}
                            </div>
                          )}

                          <div className="admin-row-sub">
                            <span>ID: {p.id}</span>
                            <span>
                              最終更新: {formatDateTime(p.updated_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="admin-row-actions">
                        {!isEditing && (
                          <button
                            type="button"
                            className="admin-action-btn"
                            onClick={() => {
                              setEditingUserId(p.id);
                              setEditingUsername(p.username || "");
                            }}
                          >
                            名前変更
                          </button>
                        )}
                        <button
                          type="button"
                          className="admin-action-btn is-crimson"
                          disabled={isSelf}
                          onClick={() => handleToggleRole(p)}
                          title={
                            isSelf
                              ? "自分自身の権限は変更できません"
                              : "ADMIN / MEMBER 権限を切り替え"
                          }
                        >
                          権限切替
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 02: ROOMS */}
        {activeTab === "ROOMS" && (
          <section className="admin-panel">
            <div className="admin-panel-head">
              <span>BOARD ROOMS &amp; ENCRYPTED CHANNELS</span>
              <span>SHOWING {filteredPosts.length} ROOMS</span>
            </div>

            {filteredPosts.length === 0 ? (
              <div className="admin-empty">該当するルームはありません。</div>
            ) : (
              <div className="admin-list">
                {filteredPosts.map((post) => {
                  const replyCount = replies.filter(
                    (r) => r.post_id === post.id
                  ).length;

                  return (
                    <div key={post.id} className="admin-row">
                      <div className="admin-row-main">
                        <img
                          src={post.author_avatar || logoImg.src}
                          alt={post.author_name}
                          className="admin-avatar"
                        />
                        <div className="admin-row-info">
                          <div className="admin-row-title-line">
                            <span className="admin-cat-badge">
                              {(post.category || "GENERAL").toUpperCase()}
                            </span>
                            <strong>
                              {post.title || post.content.slice(0, 36)}
                            </strong>
                            <span className="admin-count-badge">
                              CHAT [{replyCount}]
                            </span>
                            {post.passcode && (
                              <span className="admin-lock-badge">
                                🔒 PASS: {post.passcode}
                              </span>
                            )}
                          </div>
                          <p className="admin-row-excerpt">{post.content}</p>
                          <div className="admin-row-sub">
                            <span>作成者: {post.author_name}</span>
                            <span>
                              作成日時: {formatDateTime(post.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="admin-action-btn is-danger"
                          onClick={() => handleDeletePost(post.id)}
                        >
                          部屋を削除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 03: CHAT LOGS */}
        {activeTab === "MESSAGES" && (
          <section className="admin-panel">
            <div className="admin-panel-head">
              <span>REALTIME CHAT TRANSMISSION LOGS</span>
              <span>SHOWING {filteredReplies.length} MESSAGES</span>
            </div>

            {filteredReplies.length === 0 ? (
              <div className="admin-empty">
                該当するチャットメッセージはありません。
              </div>
            ) : (
              <div className="admin-list">
                {filteredReplies.map((rep) => {
                  const parentRoom = posts.find((p) => p.id === rep.post_id);
                  return (
                    <div key={rep.id} className="admin-row">
                      <div className="admin-row-main">
                        <img
                          src={rep.author_avatar || logoImg.src}
                          alt={rep.author_name}
                          className="admin-avatar"
                        />
                        <div className="admin-row-info">
                          <div className="admin-row-title-line">
                            <strong>{rep.author_name}</strong>
                            <span className="admin-room-ref">
                              ROOM:{" "}
                              {parentRoom?.title ||
                                parentRoom?.content?.slice(0, 20) ||
                                "UNKNOWN"}
                            </span>
                            {rep.is_pinned && (
                              <span className="admin-pin-badge">📌 PINNED</span>
                            )}
                            {rep.image_url && (
                              <span className="admin-cat-badge">🖼 IMAGE</span>
                            )}
                            {rep.code_snippet && (
                              <span className="admin-cat-badge">
                                {"</>"} CODE
                              </span>
                            )}
                          </div>
                          <p className="admin-row-excerpt">{rep.content}</p>
                          <div className="admin-row-sub">
                            <span>
                              送信日時: {formatDateTime(rep.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="admin-action-btn"
                          onClick={() => handleTogglePinReply(rep)}
                        >
                          {rep.is_pinned ? "ピン解除" : "📌 固定"}
                        </button>
                        <button
                          type="button"
                          className="admin-action-btn is-danger"
                          onClick={() => handleDeleteReply(rep.id)}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      <style>{`
        .admin-page {
          --bg-dark: #070708;
          --bg-panel: #0d0d10;
          --crimson: #d91e2a;
          --crimson-glow: rgba(217, 30, 42, 0.35);
          --text-main: #f2f2f4;
          --text-muted: #8a8a93;
          --border-line: rgba(255, 255, 255, 0.12);

          position: relative;
          min-height: 100vh;
          background-color: var(--bg-dark);
          color: var(--text-main);
          font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif;
          overflow-x: hidden;
        }

        .admin-grid-bg {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
          z-index: 0;
        }

        .admin-noise-bg {
          position: fixed;
          inset: 0;
          background: radial-gradient(circle at 75% 25%, rgba(217, 30, 42, 0.14), transparent 55%);
          pointer-events: none;
          z-index: 0;
        }

        .admin-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--crimson);
          box-shadow: 0 0 10px var(--crimson);
        }

        .admin-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(7, 7, 8, 0.88);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-line);
        }

        .admin-header-inner {
          max-width: 1360px;
          margin: 0 auto;
          padding: 0.85rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .admin-brand {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          text-decoration: none;
          color: var(--text-main);
        }

        .admin-emblem {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: 1px solid var(--crimson);
          padding: 4px;
          box-shadow: 0 0 14px var(--crimson-glow);
          overflow: hidden;
        }

        .admin-emblem img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }

        .admin-brand-text {
          display: flex;
          flex-direction: column;
        }

        .admin-brand-text strong {
          font-size: 1.02rem;
          letter-spacing: 0.12em;
          font-weight: 800;
        }

        .admin-brand-text small {
          font-family: monospace;
          font-size: 0.62rem;
          letter-spacing: 0.2em;
          color: var(--crimson);
        }

        .admin-header-actions {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .admin-btn-ghost,
        .admin-btn-red-outline,
        .admin-btn-logout {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.48rem 0.95rem;
          font-family: monospace;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-decoration: none;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
        }

        .admin-btn-ghost {
          color: #e0e0e6;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-line);
        }

        .admin-btn-ghost:hover:not(:disabled) {
          border-color: var(--crimson);
          color: #ffffff;
        }

        .admin-btn-red-outline,
        .admin-btn-logout {
          color: #ffffff;
          background: rgba(217, 30, 42, 0.14);
          border: 1px solid var(--crimson);
        }

        .admin-btn-red-outline:hover,
        .admin-btn-logout:hover:not(:disabled) {
          background: var(--crimson);
          box-shadow: 0 0 16px var(--crimson-glow);
        }

        .admin-container {
          position: relative;
          z-index: 2;
          max-width: 1280px;
          margin: 0 auto;
          padding: 2.75rem 2rem 5rem;
        }

        .admin-hero {
          padding-bottom: 1.5rem;
          margin-bottom: 2rem;
          border-bottom: 1px solid var(--border-line);
        }

        .admin-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          font-family: monospace;
          font-size: 0.74rem;
          letter-spacing: 0.2em;
          color: var(--crimson);
          margin-bottom: 0.5rem;
        }

        .admin-hero-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 1rem;
        }

        .admin-hero-row h1 {
          margin: 0;
          font-size: clamp(1.85rem, 3.5vw, 2.75rem);
          font-weight: 900;
          letter-spacing: 0.1em;
        }

        .admin-hero-row span {
          font-family: monospace;
          font-size: 0.82rem;
          letter-spacing: 0.26em;
          color: rgba(255, 255, 255, 0.32);
        }

        .admin-toast {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          margin-bottom: 1.5rem;
          font-size: 0.84rem;
          border-left: 3px solid transparent;
        }

        .admin-toast.is-ok {
          color: #4ade80;
          background: rgba(34, 197, 94, 0.1);
          border-color: #22c55e;
        }

        .admin-toast.is-err {
          color: #ff6b74;
          background: rgba(217, 30, 42, 0.16);
          border-color: var(--crimson);
        }

        .admin-toast button {
          background: transparent;
          border: none;
          color: inherit;
          font-size: 1.1rem;
          cursor: pointer;
        }

        .admin-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .admin-stat-card {
          background: var(--bg-panel);
          border: 1px solid var(--border-line);
          border-top: 2px solid var(--crimson);
          padding: 1.15rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .admin-stat-label {
          font-family: monospace;
          font-size: 0.68rem;
          letter-spacing: 0.16em;
          color: var(--text-muted);
        }

        .admin-stat-value {
          font-family: monospace;
          font-size: 1.85rem;
          font-weight: 800;
          color: #ffffff;
        }

        .admin-stat-value.is-crimson {
          color: var(--crimson);
        }

        .admin-stat-card small {
          font-size: 0.74rem;
          color: var(--text-muted);
        }

        .admin-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .admin-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .admin-tab-btn {
          padding: 0.55rem 1rem;
          font-family: monospace;
          font-size: 0.74rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: var(--text-muted);
          background: var(--bg-panel);
          border: 1px solid var(--border-line);
          cursor: pointer;
          transition: all 0.2s;
        }

        .admin-tab-btn:hover {
          color: #ffffff;
        }

        .admin-tab-btn.is-active {
          color: #ffffff;
          background: rgba(217, 30, 42, 0.2);
          border-color: var(--crimson);
        }

        .admin-search-input {
          min-width: 260px;
          padding: 0.55rem 0.9rem;
          font-size: 0.84rem;
          color: #ffffff;
          background: var(--bg-panel);
          border: 1px solid var(--border-line);
        }

        .admin-search-input:focus {
          outline: none;
          border-color: var(--crimson);
        }

        .admin-panel {
          background: var(--bg-panel);
          border: 1px solid var(--border-line);
          border-top: 3px solid var(--crimson);
        }

        .admin-panel-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.9rem 1.25rem;
          border-bottom: 1px solid var(--border-line);
          background: rgba(255, 255, 255, 0.02);
          font-family: monospace;
          font-size: 0.72rem;
          letter-spacing: 0.16em;
          color: var(--text-muted);
        }

        .admin-empty {
          padding: 3rem 1.5rem;
          text-align: center;
          font-size: 0.88rem;
          color: var(--text-muted);
        }

        .admin-list {
          display: flex;
          flex-direction: column;
        }

        .admin-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .admin-row:last-child {
          border-bottom: none;
        }

        .admin-row:hover {
          background: rgba(255, 255, 255, 0.015);
        }

        .admin-row-main {
          display: flex;
          align-items: flex-start;
          gap: 0.9rem;
          min-width: 0;
          flex: 1;
        }

        .admin-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid rgba(217, 30, 42, 0.65);
          background: #070708;
          flex-shrink: 0;
        }

        .admin-row-info {
          min-width: 0;
          flex: 1;
        }

        .admin-row-title-line {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.55rem;
          margin-bottom: 0.3rem;
        }

        .admin-row-title-line strong {
          font-size: 0.96rem;
          color: #ffffff;
        }

        .admin-role-badge {
          padding: 0.14rem 0.5rem;
          font-family: monospace;
          font-size: 0.66rem;
          font-weight: 700;
          color: var(--text-muted);
          border: 1px solid var(--border-line);
        }

        .admin-role-badge.is-admin {
          color: #ffffff;
          background: rgba(217, 30, 42, 0.25);
          border-color: var(--crimson);
        }

        .admin-self-tag {
          padding: 0.12rem 0.45rem;
          font-family: monospace;
          font-size: 0.64rem;
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.45);
        }

        .admin-cat-badge {
          padding: 0.14rem 0.5rem;
          font-family: monospace;
          font-size: 0.66rem;
          color: #d6d6de;
          border: 1px solid var(--border-line);
          background: rgba(255, 255, 255, 0.03);
        }

        .admin-count-badge {
          padding: 0.14rem 0.5rem;
          font-family: monospace;
          font-size: 0.66rem;
          color: var(--crimson);
          border: 1px solid rgba(217, 30, 42, 0.45);
        }

        .admin-lock-badge {
          padding: 0.14rem 0.55rem;
          font-family: monospace;
          font-size: 0.68rem;
          color: #fbbf24;
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.45);
        }

        .admin-pin-badge {
          font-family: monospace;
          font-size: 0.68rem;
          color: var(--crimson);
        }

        .admin-room-ref {
          font-family: monospace;
          font-size: 0.72rem;
          color: var(--text-muted);
        }

        .admin-row-excerpt {
          margin: 0.25rem 0 0.4rem;
          font-size: 0.85rem;
          color: #c8c8d0;
          line-height: 1.55;
          word-break: break-word;
        }

        .admin-row-sub {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          font-family: monospace;
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .admin-inline-edit {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          margin-bottom: 0.35rem;
        }

        .admin-inline-input {
          padding: 0.35rem 0.6rem;
          font-size: 0.85rem;
          color: #ffffff;
          background: #070708;
          border: 1px solid var(--crimson);
        }

        .admin-row-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .admin-action-btn {
          padding: 0.42rem 0.8rem;
          font-size: 0.74rem;
          font-weight: 700;
          color: #e0e0e6;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-line);
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .admin-action-btn:hover:not(:disabled) {
          color: #ffffff;
          border-color: var(--crimson);
        }

        .admin-action-btn.is-crimson {
          color: #ffffff;
          background: rgba(217, 30, 42, 0.16);
          border-color: var(--crimson);
        }

        .admin-action-btn.is-crimson:hover:not(:disabled) {
          background: var(--crimson);
        }

        .admin-action-btn.is-danger {
          color: #ff6b74;
          background: rgba(217, 30, 42, 0.12);
          border-color: rgba(217, 30, 42, 0.5);
        }

        .admin-action-btn.is-danger:hover {
          color: #ffffff;
          background: var(--crimson);
        }

        .admin-action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        @media (max-width: 960px) {
          .admin-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .admin-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .admin-row-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }

        @media (max-width: 640px) {
          .admin-header-inner {
            padding: 0.8rem 1.25rem;
          }

          .admin-container {
            padding: 2rem 1.25rem 4rem;
          }

          .admin-stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
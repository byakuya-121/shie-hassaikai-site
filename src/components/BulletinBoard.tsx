"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type PostCategory = "GENERAL" | "RESEARCH" | "URGENT";
type FilterCategory = "ALL" | PostCategory;
type ReactionType = "ACK" | "IMPORTANT";

type Post = {
  id: string;
  user_id?: string | null;
  author_name: string;
  author_avatar?: string | null;
  content: string;
  category?: PostCategory | string;
  passcode?: string | null;
  created_at: string;
  post_replies?: { id: string }[];
};

type Reply = {
  id: string;
  post_id: string;
  user_id: string | null;
  author_name: string;
  author_avatar?: string | null;
  content: string;
  image_url?: string | null;
  code_snippet?: string | null;
  is_pinned?: boolean | null;
  reply_to_id?: string | null;
  reply_to_author?: string | null;
  reply_to_snippet?: string | null;
  created_at: string;
};

type Reaction = {
  id: string;
  reply_id: string;
  user_id: string;
  reaction_type: ReactionType;
};

type OnlineMember = {
  key: string;
  user_id: string;
  name: string;
  avatar?: string | null;
};

type QuoteTarget = {
  id: string;
  author_name: string;
  content: string;
};

type ResizeEdge = "bottom" | "right" | "corner";

const HANDLE_STORAGE_KEY = "shie_hassaikai_handle_name";
const AVATAR_STORAGE_KEY = "shie_hassaikai_avatar_url";
const ENTER_SEND_STORAGE_KEY = "shie_hassaikai_enter_send";
const UNLOCKED_ROOMS_KEY = "shie_hassaikai_unlocked_rooms";
const READ_COUNTS_KEY = "shie_hassaikai_room_read_counts";
const CHAT_SIZE_STORAGE_KEY = "shie_hassaikai_chat_size";

const CATEGORIES: { value: PostCategory; label: string }[] = [
  { value: "GENERAL", label: "GENERAL / 雑談" },
  { value: "RESEARCH", label: "RESEARCH / 調査" },
  { value: "URGENT", label: "URGENT / 重要" },
];

const PRESET_AVATARS: { id: string; label: string }[] = [
  { id: "preset:initial", label: "頭文字" },
  { id: "preset:beak", label: "鴉マスク" },
  { id: "preset:emblem", label: "八斎紋" },
  { id: "preset:shield", label: "防衛盾" },
  { id: "preset:medical", label: "研究班" },
  { id: "preset:node", label: "電脳核" },
];

function generateRandomUsername(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `user${num}`;
}

function generate8DigitPasscode(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function extractYouTubeIds(text: string): string[] {
  const regex =
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) ids.add(match[1]);
  }
  return Array.from(ids);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseAttachmentInfo(url: string): {
  isImage: boolean;
  isGif: boolean;
  fileName: string;
  cleanUrl: string;
} {
  const hashIndex = url.indexOf("#name=");
  let fileName = "";
  let cleanUrl = url;

  if (hashIndex !== -1) {
    cleanUrl = url.slice(0, hashIndex);
    try {
      fileName = decodeURIComponent(url.slice(hashIndex + 6));
    } catch {
      fileName = url.slice(hashIndex + 6);
    }
  } else {
    const withoutQuery = url.split("?")[0];
    const parts = withoutQuery.split("/");
    fileName = parts[parts.length - 1] || "attachment";
  }

  const lower = cleanUrl.toLowerCase();
  const isDataImage = lower.startsWith("data:image/");
  const isImageExt = /\.(jpg|jpeg|png|webp|gif|svg|bmp|avif)(\?.*)?$/i.test(
    lower
  );
  const isImage = isDataImage || isImageExt;
  const isGif =
    lower.startsWith("data:image/gif") || /\.gif(\?.*)?$/i.test(lower);

  return {
    isImage,
    isGif,
    fileName: fileName || "attached-file",
    cleanUrl,
  };
}

function UserAvatar({
  name,
  avatar,
  size = "md",
}: {
  name: string;
  avatar?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const displayName = (name || "MEMBER").trim();
  const initial = displayName.slice(0, 2).toUpperCase();

  const isImageUrl =
    avatar &&
    (avatar.startsWith("http://") ||
      avatar.startsWith("https://") ||
      avatar.startsWith("data:image/"));

  return (
    <span
      className={`user-avatar avatar-${size}`}
      title={displayName}
      aria-hidden="true"
    >
      {isImageUrl ? (
        <img src={avatar} alt={displayName} className="user-avatar-img" />
      ) : avatar === "preset:beak" ? (
        <svg viewBox="0 0 24 24" className="user-avatar-svg">
          <path
            fill="currentColor"
            d="M12 3C7.5 3 4 6.5 4 11c0 2.4 1 4.5 2.6 6L12 21l5.4-4c1.6-1.5 2.6-3.6 2.6-6 0-4.5-3.5-8-8-8zm-2.5 8.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM12 18l-2.5-3.5h5L12 18z"
          />
        </svg>
      ) : avatar === "preset:emblem" ? (
        <svg viewBox="0 0 24 24" className="user-avatar-svg">
          <circle
            cx="12"
            cy="12"
            r="8.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <polygon
            points="12,5 18,12 12,19 6,12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        </svg>
      ) : avatar === "preset:shield" ? (
        <svg viewBox="0 0 24 24" className="user-avatar-svg">
          <path
            fill="currentColor"
            d="M12 2L4 5.5v6.2c0 5.1 3.4 9.8 8 11.3 4.6-1.5 8-6.2 8-11.3V5.5L12 2zm0 4.2l4.5 2v3.5c0 3.2-1.9 6.2-4.5 7.4-2.6-1.2-4.5-4.2-4.5-7.4V8.2l4.5-2z"
          />
        </svg>
      ) : avatar === "preset:medical" ? (
        <svg viewBox="0 0 24 24" className="user-avatar-svg">
          <path
            fill="currentColor"
            d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3z"
          />
        </svg>
      ) : avatar === "preset:node" ? (
        <svg viewBox="0 0 24 24" className="user-avatar-svg">
          <rect
            x="6"
            y="6"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
          <path
            stroke="currentColor"
            strokeWidth="1.6"
            d="M12 2v4M12 18v4M2 12h4M18 12h4"
          />
        </svg>
      ) : (
        <span className="user-avatar-initial">{initial}</span>
      )}
    </span>
  );
}

async function resizeImageFile(file: File): Promise<{
  blob: Blob;
  dataUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unavailable"));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

        const dataUrl = canvas.toDataURL("image/webp", 0.85);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              reject(new Error("Blob creation failed"));
            }
          },
          "image/webp",
          0.85
        );
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

async function prepareAttachmentBlob(file: File): Promise<{
  blob: Blob;
  ext: string;
  contentType: string;
  fallbackDataUrl: string;
}> {
  if (file.type === "image/gif") {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("GIF read failed"));
      reader.readAsDataURL(file);
    });
    return {
      blob: file,
      ext: "gif",
      contentType: "image/gif",
      fallbackDataUrl: dataUrl,
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 960;
        let w = img.width;
        let h = img.height;
        if (w > maxSide || h > maxSide) {
          if (w > h) {
            h = Math.round((h * maxSide) / w);
            w = maxSide;
          } else {
            w = Math.round((w * maxSide) / h);
            h = maxSide;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const fallbackDataUrl = canvas.toDataURL("image/jpeg", 0.84);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({
                blob,
                ext: "jpg",
                contentType: "image/jpeg",
                fallbackDataUrl,
              });
            } else {
              reject(new Error("Blob failed"));
            }
          },
          "image/jpeg",
          0.84
        );
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

export default function BulletinBoard({
  soundEnabled = true,
  onToggleSound,
  onNotifySound,
  settingsOpen = false,
  onOpenSettings,
  onCloseSettings,
}: {
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onNotifySound?: () => void;
  settingsOpen?: boolean;
  onOpenSettings?: () => void;
  onCloseSettings?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);

  // オペレーター設定
  const [authorName, setAuthorName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>("preset:initial");
  const [enterToSend, setEnterToSend] = useState(true);

  // モーダル内の編集中ステータス
  const [draftName, setDraftName] = useState("");
  const [draftAvatar, setDraftAvatar] = useState<string>("preset:initial");
  const [draftEnterSend, setDraftEnterSend] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 新規部屋投稿ステート
  const [category, setCategory] = useState<PostCategory>("GENERAL");
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("ALL");
  const [content, setContent] = useState("");
  const [usePasscode, setUsePasscode] = useState(false);
  const [roomPasscode, setRoomPasscode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(
    null
  );
  const [confirmDeleteReplyId, setConfirmDeleteReplyId] = useState<
    string | null
  >(null);

  // 数字8桁パスコード解除・未読バッジ・メンション通知ステート
  const [unlockedRoomIds, setUnlockedRoomIds] = useState<string[]>([]);
  const [passcodeModalPost, setPasscodeModalPost] = useState<Post | null>(null);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [readCounts, setReadCounts] = useState<Record<string, number>>({});
  const [mentionAlert, setMentionAlert] = useState<{
    postId: string;
    sender: string;
    preview: string;
  } | null>(null);

  // チャット機能用の状態
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [replyText, setReplyText] = useState("");
  const [quoteTarget, setQuoteTarget] = useState<QuoteTarget | null>(null);
  const [highlightedReplyId, setHighlightedReplyId] = useState<string | null>(
    null
  );
  // タップ/選択中のメッセージID（アクションボタン表示用）
  const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(
    null
  );

  // ツールメニュー開閉ステート
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const toolMenuRef = useRef<HTMLDivElement | null>(null);

  // 添付ファイル下書き（画像・GIF・一般ファイル）
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftPreviewUrl, setDraftPreviewUrl] = useState<string | null>(null);
  const [draftIsGif, setDraftIsGif] = useState(false);
  const [draftIsGenericFile, setDraftIsGenericFile] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [showCodeBox, setShowCodeBox] = useState(false);
  const [draftCode, setDraftCode] = useState("");
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  // チャット枠の自由リサイズ状態（幅・高さ）
  const [chatWidth, setChatWidth] = useState<number | null>(null);
  const [chatHeight, setChatHeight] = useState<number | null>(null);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const chatRoomRef = useRef<HTMLDivElement | null>(null);
  const resizeDragRef = useRef<{
    edge: ResizeEdge;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  // タイピング中（〇〇が入力中...）のリアルタイム状態
  const [typingUsers, setTypingUsers] = useState<
    Record<string, { name: string; expiresAt: number }>
  >({});
  const chatChannelRef = useRef<RealtimeChannel | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const chatImageInputRef = useRef<HTMLInputElement | null>(null);
  const chatGifInputRef = useRef<HTMLInputElement | null>(null);
  const chatGenericFileInputRef = useRef<HTMLInputElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  // 同時接続メンバー（Presence）
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  const notifyRef = useRef(onNotifySound);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    notifyRef.current = onNotifySound;
  }, [soundEnabled, onNotifySound]);

  // ツールメニューの外側クリックで閉じる
  useEffect(() => {
    if (!toolMenuOpen) return;

    const handleOutsideToolClick = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (toolMenuRef.current && target && !toolMenuRef.current.contains(target)) {
        setToolMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsideToolClick);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideToolClick);
    };
  }, [toolMenuOpen]);

  // メッセージ以外の別の場所をタップ/クリックしたらアクションボタンを閉じる
  useEffect(() => {
    if (!activeActionMsgId) return;

    const handleOutsidePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const insideActiveRow = target.closest(
        `[data-msg-action-id="${activeActionMsgId}"]`
      );
      if (!insideActiveRow) {
        setActiveActionMsgId(null);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, [activeActionMsgId]);

  useEffect(() => {
    if (settingsOpen) {
      setDraftName(authorName);
      setDraftAvatar(avatarUrl);
      setDraftEnterSend(enterToSend);
      setProfileNotice(null);
    }
  }, [settingsOpen, authorName, avatarUrl, enterToSend]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightboxImage) setLightboxImage(null);
        else if (passcodeModalPost) setPasscodeModalPost(null);
        else if (settingsOpen) onCloseSettings?.();
        else if (toolMenuOpen) setToolMenuOpen(false);
        else if (activeActionMsgId) setActiveActionMsgId(null);
        else if (confirmDeleteReplyId) setConfirmDeleteReplyId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    settingsOpen,
    passcodeModalPost,
    lightboxImage,
    toolMenuOpen,
    activeActionMsgId,
    confirmDeleteReplyId,
    onCloseSettings,
  ]);

  // チャット枠ドラッグリサイズのグローバルイベント監視
  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      const drag = resizeDragRef.current;
      if (!drag) return;

      if (drag.edge === "bottom" || drag.edge === "corner") {
        const deltaY = clientY - drag.startY;
        const nextH = Math.max(
          360,
          Math.min(1800, Math.round(drag.startH + deltaY))
        );
        setChatHeight(nextH);
      }

      if (drag.edge === "right" || drag.edge === "corner") {
        const deltaX = clientX - drag.startX;
        const parentW =
          chatRoomRef.current?.parentElement?.clientWidth || window.innerWidth;
        const nextW = Math.max(
          440,
          Math.min(parentW, Math.round(drag.startW + deltaX))
        );
        if (nextW >= parentW - 6) {
          setChatWidth(null);
        } else {
          setChatWidth(nextW);
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!resizeDragRef.current) return;
      e.preventDefault();
      handleMove(e.clientX, e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!resizeDragRef.current || e.touches.length === 0) return;
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const stopDrag = () => {
      if (!resizeDragRef.current) return;
      resizeDragRef.current = null;
      setIsResizingChat(false);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopDrag);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", stopDrag);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopDrag);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", stopDrag);
    };
  }, []);

  // リサイズ完了後にサイズを自動保存
  useEffect(() => {
    if (isResizingChat) return;
    if (chatWidth === null && chatHeight === null) return;
    localStorage.setItem(
      CHAT_SIZE_STORAGE_KEY,
      JSON.stringify({ width: chatWidth, height: chatHeight })
    );
  }, [isResizingChat, chatWidth, chatHeight]);

  const startChatResize = (
    edge: ResizeEdge,
    clientX: number,
    clientY: number
  ) => {
    const el = chatRoomRef.current;
    if (!el) return;
    resizeDragRef.current = {
      edge,
      startX: clientX,
      startY: clientY,
      startW: el.offsetWidth,
      startH: el.offsetHeight,
    };
    setIsResizingChat(true);
  };

  const applyChatSizePreset = (preset: "compact" | "default" | "tall") => {
    if (preset === "compact") {
      setChatWidth(null);
      setChatHeight(460);
      localStorage.setItem(
        CHAT_SIZE_STORAGE_KEY,
        JSON.stringify({ width: null, height: 460 })
      );
    } else if (preset === "tall") {
      setChatWidth(null);
      setChatHeight(860);
      localStorage.setItem(
        CHAT_SIZE_STORAGE_KEY,
        JSON.stringify({ width: null, height: 860 })
      );
    } else {
      setChatWidth(null);
      setChatHeight(null);
      localStorage.removeItem(CHAT_SIZE_STORAGE_KEY);
    }
  };

  // 初期プロフィール・解除済み部屋・既読数・チャットサイズの読み込み
  useEffect(() => {
    const savedName = localStorage.getItem(HANDLE_STORAGE_KEY) || "";
    const savedAvatar =
      localStorage.getItem(AVATAR_STORAGE_KEY) || "preset:initial";
    const savedEnter = localStorage.getItem(ENTER_SEND_STORAGE_KEY);
    const savedUnlocked = localStorage.getItem(UNLOCKED_ROOMS_KEY);
    const savedRead = localStorage.getItem(READ_COUNTS_KEY);
    const savedChatSize = localStorage.getItem(CHAT_SIZE_STORAGE_KEY);

    if (savedName) {
      setAuthorName(savedName);
      setDraftName(savedName);
    }
    setAvatarUrl(savedAvatar);
    setDraftAvatar(savedAvatar);
    if (savedEnter !== null) {
      const enabled = savedEnter === "true";
      setEnterToSend(enabled);
      setDraftEnterSend(enabled);
    }
    if (savedUnlocked) {
      try {
        setUnlockedRoomIds(JSON.parse(savedUnlocked));
      } catch {
        // ignore
      }
    }
    if (savedRead) {
      try {
        setReadCounts(JSON.parse(savedRead));
      } catch {
        // ignore
      }
    }
    if (savedChatSize) {
      try {
        const parsed = JSON.parse(savedChatSize);
        if (typeof parsed.width === "number") setChatWidth(parsed.width);
        if (typeof parsed.height === "number") setChatHeight(parsed.height);
      } catch {
        // ignore
      }
    }

    const initUserAndProfile = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setCurrentUserId(uid);

      if (uid) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("username, avatar_url, role")
          .eq("id", uid)
          .maybeSingle();

        if (profileData?.role === "admin") {
          setIsAdmin(true);
        }

        const existingName = profileData?.username?.trim();
        const uavatar = profileData?.avatar_url || savedAvatar;

        if (existingName) {
          setAuthorName(existingName);
          setDraftName(existingName);
          setAvatarUrl(uavatar);
          setDraftAvatar(uavatar);
          localStorage.setItem(HANDLE_STORAGE_KEY, existingName);
          localStorage.setItem(AVATAR_STORAGE_KEY, uavatar);
        } else {
          const initialName =
            savedName && savedName !== "MEMBER"
              ? savedName
              : generateRandomUsername();
          setAuthorName(initialName);
          setDraftName(initialName);
          setAvatarUrl(uavatar);
          setDraftAvatar(uavatar);
          localStorage.setItem(HANDLE_STORAGE_KEY, initialName);
          localStorage.setItem(AVATAR_STORAGE_KEY, uavatar);

          await supabase.from("profiles").upsert({
            id: uid,
            username: initialName,
            avatar_url: uavatar,
            updated_at: new Date().toISOString(),
          });
        }
      }
    };

    initUserAndProfile();
  }, [supabase]);

  // アイコン画像のファイル選択＆アップロード
  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setProfileNotice(null);

    try {
      const { blob, dataUrl } = await resizeImageFile(file);

      if (currentUserId) {
        const filePath = `${currentUserId}/avatar-${Date.now()}.webp`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, blob, {
            contentType: "image/webp",
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(filePath);
          setDraftAvatar(publicUrlData.publicUrl);
          setUploadingAvatar(false);
          return;
        }
      }

      setDraftAvatar(dataUrl);
    } catch {
      setProfileNotice("画像の読み込みに失敗しました。別の画像をお試しください。");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 設定保存＆リロードなしで画面全体へ即座に反映
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingProfile) return;

    setSavingProfile(true);
    setProfileNotice(null);

    const finalName = draftName.trim() || generateRandomUsername();
    const finalAvatar = draftAvatar || "preset:initial";

    setAuthorName(finalName);
    setAvatarUrl(finalAvatar);
    setEnterToSend(draftEnterSend);

    localStorage.setItem(HANDLE_STORAGE_KEY, finalName);
    localStorage.setItem(AVATAR_STORAGE_KEY, finalAvatar);
    localStorage.setItem(ENTER_SEND_STORAGE_KEY, String(draftEnterSend));

    setPosts((prev) =>
      prev.map((p) =>
        p.user_id === currentUserId
          ? { ...p, author_name: finalName, author_avatar: finalAvatar }
          : p
      )
    );
    setSelectedPost((prev) =>
      prev && prev.user_id === currentUserId
        ? { ...prev, author_name: finalName, author_avatar: finalAvatar }
        : prev
    );
    setReplies((prev) =>
      prev.map((r) =>
        r.user_id === currentUserId
          ? { ...r, author_name: finalName, author_avatar: finalAvatar }
          : r
      )
    );
    setOnlineMembers((prev) =>
      prev.map((m) =>
        m.user_id === currentUserId
          ? { ...m, name: finalName, avatar: finalAvatar }
          : m
      )
    );

    if (currentUserId) {
      await supabase.from("profiles").upsert({
        id: currentUserId,
        username: finalName,
        avatar_url: finalAvatar,
        updated_at: new Date().toISOString(),
      });

      await supabase
        .from("posts")
        .update({ author_name: finalName, author_avatar: finalAvatar })
        .eq("user_id", currentUserId);

      await supabase
        .from("post_replies")
        .update({ author_name: finalName, author_avatar: finalAvatar })
        .eq("user_id", currentUserId);

      const channel = supabase
        .getChannels()
        .find((c) => c.topic === "realtime:shie-board-presence");
      if (channel) {
        await channel.track({
          user_id: currentUserId,
          name: finalName,
          avatar: finalAvatar,
        });
      }
    }

    setSavingProfile(false);
    setProfileNotice("設定を保存して画面へ反映しました。");
    setTimeout(() => {
      setProfileNotice(null);
      onCloseSettings?.();
    }, 650);
  };

  // 同時接続人数・参加メンバー（Presence）のリアルタイム同期
  useEffect(() => {
    if (!currentUserId) return;

    const presenceChannel = supabase.channel("shie-board-presence", {
      config: { presence: { key: currentUserId } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState<{
          user_id: string;
          name: string;
          avatar?: string | null;
        }>();
        const list: OnlineMember[] = [];
        Object.entries(state).forEach(([key, presences]) => {
          if (presences && presences.length > 0) {
            list.push({
              key,
              user_id: presences[0].user_id,
              name: presences[0].name || "MEMBER",
              avatar: presences[0].avatar || null,
            });
          }
        });
        setOnlineMembers(list);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            user_id: currentUserId,
            name:
              localStorage.getItem(HANDLE_STORAGE_KEY)?.trim() || "MEMBER",
            avatar:
              localStorage.getItem(AVATAR_STORAGE_KEY) || "preset:initial",
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [currentUserId, supabase]);

  // 掲示板一覧の読み込み
  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from("posts")
      .select("*, post_replies(id)")
      .order("created_at", { ascending: false });

    if (error) {
      const fallback = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (fallback.error) {
        setError("投稿の読み込みに失敗しました。");
      } else {
        setPosts(fallback.data || []);
        setError(null);
      }
    } else {
      setPosts(data || []);
      setError(null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // スレッド一覧・未読バッジ・メンション通知のリアルタイム監視
  useEffect(() => {
    const boardChannel = supabase
      .channel("shie-board-global")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        (payload) => {
          if (
            payload.eventType === "DELETE" &&
            selectedPost &&
            payload.old.id === selectedPost.id
          ) {
            setSelectedPost(null);
          }
          fetchPosts();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_replies" },
        (payload) => {
          const newMsg = payload.new as Reply;
          const myName = (
            localStorage.getItem(HANDLE_STORAGE_KEY) ||
            authorName ||
            ""
          ).trim();
          const isFromOther =
            !currentUserId || newMsg.user_id !== currentUserId;

          if (isFromOther) {
            const isMentioned =
              myName.length > 0 &&
              newMsg.content
                .toLowerCase()
                .includes(`@${myName.toLowerCase()}`);

            if (isMentioned) {
              setMentionAlert({
                postId: newMsg.post_id,
                sender: newMsg.author_name || "MEMBER",
                preview: newMsg.content.slice(0, 48),
              });
              if (soundEnabledRef.current && notifyRef.current) {
                notifyRef.current();
              }
            }
          }
          fetchPosts();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "post_replies" },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(boardChannel);
    };
  }, [supabase, fetchPosts, selectedPost, currentUserId, authorName]);

  // チャット入室時＆新規返信時に既読数を記録
  useEffect(() => {
    if (!selectedPost) return;
    setReadCounts((prev) => {
      if (prev[selectedPost.id] === replies.length) return prev;
      const next = { ...prev, [selectedPost.id]: replies.length };
      localStorage.setItem(READ_COUNTS_KEY, JSON.stringify(next));
      return next;
    });
  }, [selectedPost, replies.length]);

  // 期限切れのタイピング表示を定期掃除
  useEffect(() => {
    if (Object.keys(typingUsers).length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const next: Record<string, { name: string; expiresAt: number }> = {};
        let changed = false;
        Object.entries(prev).forEach(([k, v]) => {
          if (v.expiresAt > now) {
            next[k] = v;
          } else {
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 800);
    return () => clearInterval(timer);
  }, [typingUsers]);

  // チャット履歴・リアクション・タイピングBroadcastの読み込み＆リアルタイム購読
  useEffect(() => {
    if (!selectedPost) {
      chatChannelRef.current = null;
      setTypingUsers({});
      setActiveActionMsgId(null);
      setConfirmDeleteReplyId(null);
      setToolMenuOpen(false);
      return;
    }

    const fetchChatData = async () => {
      setLoadingReplies(true);
      const { data: replyData } = await supabase
        .from("post_replies")
        .select("*")
        .eq("post_id", selectedPost.id)
        .order("created_at", { ascending: true });

      const loadedReplies = (replyData as Reply[]) || [];
      setReplies(loadedReplies);

      if (loadedReplies.length > 0) {
        const replyIds = loadedReplies.map((r) => r.id);
        const { data: reactionData } = await supabase
          .from("reply_reactions")
          .select("*")
          .in("reply_id", replyIds);
        setReactions((reactionData as Reaction[]) || []);
      } else {
        setReactions([]);
      }
      setLoadingReplies(false);
    };

    fetchChatData();

    const chatChannel = supabase
      .channel(`chat-${selectedPost.id}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const senderId = String(payload?.userId || "");
        const senderName = String(payload?.name || "MEMBER");
        if (!senderId || senderId === currentUserId) return;

        if (payload?.stopped) {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[senderId];
            return next;
          });
        } else {
          setTypingUsers((prev) => ({
            ...prev,
            [senderId]: {
              name: senderName,
              expiresAt: Date.now() + 3500,
            },
          }));
        }
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "post_replies",
          filter: `post_id=eq.${selectedPost.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Reply;
          if (newMsg.user_id) {
            setTypingUsers((prev) => {
              const next = { ...prev };
              delete next[newMsg.user_id as string];
              return next;
            });
          }
          setReplies((prev) => {
            if (prev.some((r) => r.id === newMsg.id)) return prev;
            if (
              newMsg.user_id !== currentUserId &&
              soundEnabledRef.current &&
              notifyRef.current
            ) {
              notifyRef.current();
            }
            return [...prev, newMsg];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "post_replies",
          filter: `post_id=eq.${selectedPost.id}`,
        },
        (payload) => {
          const updated = payload.new as Reply;
          setReplies((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "post_replies",
        },
        (payload) => {
          const deletedId = payload.old.id as string;
          setReplies((prev) => prev.filter((r) => r.id !== deletedId));
          setReactions((prev) => prev.filter((rx) => rx.reply_id !== deletedId));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reply_reactions",
        },
        (payload) => {
          const newRx = payload.new as Reaction;
          setReactions((prev) => {
            if (prev.some((r) => r.id === newRx.id)) return prev;
            return [...prev, newRx];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "reply_reactions",
        },
        (payload) => {
          const deletedId = payload.old.id as string;
          setReactions((prev) => prev.filter((r) => r.id !== deletedId));
        }
      )
      .subscribe();

    chatChannelRef.current = chatChannel;

    return () => {
      chatChannelRef.current = null;
      supabase.removeChannel(chatChannel);
    };
  }, [selectedPost, supabase, currentUserId]);

  useEffect(() => {
    if (!chatSearch.trim()) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [replies, chatSearch]);

  // 入力中イベントのブロードキャスト送信（1.5秒間隔でスロットル）
  const notifyTypingBroadcast = (stopped = false) => {
    if (!chatChannelRef.current || !currentUserId) return;
    const now = Date.now();
    if (!stopped && now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = stopped ? 0 : now;

    chatChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId: currentUserId,
        name: authorName.trim() || "MEMBER",
        stopped,
      },
    });
  };

  // 新規スレッド投稿
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;

    if (usePasscode && !/^\d{8}$/.test(roomPasscode)) {
      setError("鍵付き部屋のパスコードは数字のみ8桁で入力してください。");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payloadWithExtra = {
      author_name: authorName.trim() || "MEMBER",
      author_avatar: avatarUrl || "preset:initial",
      content: content.trim(),
      category,
      passcode: usePasscode ? roomPasscode : null,
    };

    const { data, error } = await supabase
      .from("posts")
      .insert(payloadWithExtra)
      .select()
      .single();

    if (error) {
      setError(`部屋の作成に失敗しました: ${error.message}`);
      setSubmitting(false);
      return;
    }

    if (data && usePasscode) {
      const nextUnlocked = Array.from(new Set([...unlockedRoomIds, data.id]));
      setUnlockedRoomIds(nextUnlocked);
      localStorage.setItem(UNLOCKED_ROOMS_KEY, JSON.stringify(nextUnlocked));
    }
    setContent("");
    setUsePasscode(false);
    setRoomPasscode("");
    await fetchPosts();
    setSubmitting(false);
  };

  // スレッドクリック時の入室判定
  const handleOpenPost = (post: Post) => {
    if (mentionAlert?.postId === post.id) {
      setMentionAlert(null);
    }

    const isLocked = Boolean(post.passcode && /^\d{8}$/.test(post.passcode));
    const isOwner = Boolean(currentUserId && post.user_id === currentUserId);
    const isUnlocked = unlockedRoomIds.includes(post.id);

    if (isLocked && !isOwner && !isUnlocked && !isAdmin) {
      setPasscodeModalPost(post);
      setPasscodeInput("");
      setPasscodeError(null);
      return;
    }

    setChatSearch("");
    setAttachError(null);
    setQuoteTarget(null);
    setActiveActionMsgId(null);
    setConfirmDeleteReplyId(null);
    setToolMenuOpen(false);
    setSelectedPost(post);
  };

  // 数字8桁パスコード照合
  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcodeModalPost) return;

    if (!/^\d{8}$/.test(passcodeInput)) {
      setPasscodeError("数字のみ8桁で入力してください。");
      return;
    }

    if (passcodeInput !== passcodeModalPost.passcode) {
      setPasscodeError("パスコードが一致しません。");
      return;
    }

    const nextUnlocked = Array.from(
      new Set([...unlockedRoomIds, passcodeModalPost.id])
    );
    setUnlockedRoomIds(nextUnlocked);
    localStorage.setItem(UNLOCKED_ROOMS_KEY, JSON.stringify(nextUnlocked));

    const target = passcodeModalPost;
    setPasscodeModalPost(null);
    setPasscodeInput("");
    setPasscodeError(null);
    setChatSearch("");
    setAttachError(null);
    setQuoteTarget(null);
    setActiveActionMsgId(null);
    setConfirmDeleteReplyId(null);
    setToolMenuOpen(false);
    setSelectedPost(target);
  };

  // スレッド削除（作成者・管理者）
  const handleDeletePost = async (postId: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (!error) {
      setConfirmDeletePostId(null);
      if (selectedPost?.id === postId) {
        setSelectedPost(null);
      }
      await fetchPosts();
    }
  };

  // 下書き添付ファイルのクリア
  const clearDraftAttachment = () => {
    if (draftPreviewUrl) {
      URL.revokeObjectURL(draftPreviewUrl);
    }
    setDraftFile(null);
    setDraftPreviewUrl(null);
    setDraftIsGif(false);
    setDraftIsGenericFile(false);
  };

  // ツールメニューからの画像・GIF・一般ファイル選択
  const handleToolAttachmentSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: "image" | "gif" | "file"
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    setToolMenuOpen(false);
    if (!file) return;

    setAttachError(null);

    if (file.size > 8 * 1024 * 1024) {
      setAttachError("ファイルサイズは8MB以下のものを選択してください。");
      return;
    }

    clearDraftAttachment();

    const isImageFile = file.type.startsWith("image/");
    const isGif = file.type === "image/gif" || mode === "gif";

    if (isImageFile) {
      setDraftFile(file);
      setDraftPreviewUrl(URL.createObjectURL(file));
      setDraftIsGif(isGif);
      setDraftIsGenericFile(false);
    } else {
      setDraftFile(file);
      setDraftPreviewUrl(null);
      setDraftIsGif(false);
      setDraftIsGenericFile(true);
    }
  };

  // チャットメッセージ送信（引用返信＋画像/GIF/ファイル＋コード対応）
  const handleSendReply = async () => {
    if (!selectedPost || sendingReply) return;
    if (!replyText.trim() && !draftFile && !draftCode.trim()) return;

    setSendingReply(true);
    setAttachError(null);
    setToolMenuOpen(false);
    notifyTypingBroadcast(true);

    const textToSend =
      replyText.trim() ||
      (draftFile
        ? draftIsGenericFile
          ? `[FILE: ${draftFile.name}]`
          : draftIsGif
          ? "[GIF ATTACHMENT]"
          : "[IMAGE ATTACHMENT]"
        : "[CODE SNIPPET]");
    const fileToUpload = draftFile;
    const isGifFile = draftIsGif;
    const isGeneric = draftIsGenericFile;
    const codeToSend = draftCode.trim() || null;
    const quoteToSend = quoteTarget;

    let uploadedAttachmentUrl: string | null = null;

    if (fileToUpload) {
      try {
        const ownerPrefix = currentUserId || "public";

        if (isGeneric) {
          const extMatch = fileToUpload.name.match(/\.([a-zA-Z0-9]{1,8})$/);
          const safeExt = extMatch ? extMatch[1].toLowerCase() : "bin";
          const filePath = `${ownerPrefix}/file-${Date.now()}.${safeExt}`;

          const { error: uploadErr } = await supabase.storage
            .from("avatars")
            .upload(filePath, fileToUpload, {
              contentType: fileToUpload.type || "application/octet-stream",
              upsert: true,
            });

          if (!uploadErr) {
            const { data: pubData } = supabase.storage
              .from("avatars")
              .getPublicUrl(filePath);
            uploadedAttachmentUrl = `${pubData.publicUrl}#name=${encodeURIComponent(
              fileToUpload.name
            )}`;
          } else {
            setAttachError(
              `ファイルのアップロードに失敗しました: ${uploadErr.message}`
            );
            setSendingReply(false);
            return;
          }
        } else {
          const prepared = await prepareAttachmentBlob(fileToUpload);
          const filePath = `${ownerPrefix}/chat-${Date.now()}.${prepared.ext}`;

          const { error: uploadErr } = await supabase.storage
            .from("avatars")
            .upload(filePath, prepared.blob, {
              contentType: prepared.contentType,
              upsert: true,
            });

          if (!uploadErr) {
            const { data: pubData } = supabase.storage
              .from("avatars")
              .getPublicUrl(filePath);
            uploadedAttachmentUrl = pubData.publicUrl;
          } else if (!isGifFile && prepared.fallbackDataUrl.length < 300000) {
            uploadedAttachmentUrl = prepared.fallbackDataUrl;
          } else {
            setAttachError(
              `画像/GIFのアップロードに失敗しました: ${uploadErr.message}`
            );
            setSendingReply(false);
            return;
          }
        }
      } catch {
        setAttachError("添付ファイルの処理に失敗しました。");
        setSendingReply(false);
        return;
      }
    }

    const res = await supabase
      .from("post_replies")
      .insert({
        post_id: selectedPost.id,
        author_name: authorName.trim() || "MEMBER",
        author_avatar: avatarUrl || "preset:initial",
        content: textToSend,
        image_url: uploadedAttachmentUrl,
        code_snippet: codeToSend,
        is_pinned: false,
        reply_to_id: quoteToSend?.id || null,
        reply_to_author: quoteToSend?.author_name || null,
        reply_to_snippet: quoteToSend
          ? quoteToSend.content.slice(0, 80)
          : null,
      })
      .select()
      .single();

    if (res.error) {
      setAttachError(
        `送信エラー（SupabaseでSQLを実行してください）: ${res.error.message}`
      );
      setSendingReply(false);
      return;
    }

    clearDraftAttachment();
    setReplyText("");
    setQuoteTarget(null);
    setDraftCode("");
    setShowCodeBox(false);

    if (res.data) {
      setReplies((prev) => {
        if (prev.some((r) => r.id === res.data.id)) return prev;
        return [...prev, res.data as Reply];
      });
    }
    setSendingReply(false);
  };

  // チャットメッセージ削除（本人・トーク主・管理者）
  const handleDeleteReply = async (replyId: string) => {
    const { error } = await supabase
      .from("post_replies")
      .delete()
      .eq("id", replyId);

    if (!error) {
      setReplies((prev) => prev.filter((r) => r.id !== replyId));
      setReactions((prev) => prev.filter((rx) => rx.reply_id !== replyId));
      if (activeActionMsgId === replyId) setActiveActionMsgId(null);
      if (confirmDeleteReplyId === replyId) setConfirmDeleteReplyId(null);
    } else {
      setAttachError(
        `メッセージの削除に失敗しました（権限を確認してください）: ${error.message}`
      );
    }
  };

  // 重要メッセージのピン留め切り替え
  const handleTogglePin = async (msg: Reply) => {
    const nextPinned = !msg.is_pinned;
    setReplies((prev) =>
      prev.map((r) => (r.id === msg.id ? { ...r, is_pinned: nextPinned } : r))
    );
    await supabase
      .from("post_replies")
      .update({ is_pinned: nextPinned })
      .eq("id", msg.id);
  };

  // リアクション（ACK / 重要）のトグル
  const handleToggleReaction = async (
    replyId: string,
    type: ReactionType
  ) => {
    if (!currentUserId) return;

    const existing = reactions.find(
      (r) =>
        r.reply_id === replyId &&
        r.user_id === currentUserId &&
        r.reaction_type === type
    );

    if (existing) {
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      await supabase.from("reply_reactions").delete().eq("id", existing.id);
    } else {
      const tempId = `temp-${Date.now()}`;
      const optimistic: Reaction = {
        id: tempId,
        reply_id: replyId,
        user_id: currentUserId,
        reaction_type: type,
      };
      setReactions((prev) => [...prev, optimistic]);

      const { data, error } = await supabase
        .from("reply_reactions")
        .insert({
          reply_id: replyId,
          reaction_type: type,
        })
        .select()
        .single();

      if (!error && data) {
        setReactions((prev) =>
          prev.map((r) => (r.id === tempId ? (data as Reaction) : r))
        );
      } else {
        setReactions((prev) => prev.filter((r) => r.id !== tempId));
      }
    }
  };

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 1800);
  };

  // 引用元メッセージへスムーズスクロール＆ハイライト
  const handleJumpToReply = (targetId?: string | null) => {
    if (!targetId) return;
    const el = document.getElementById(`reply-msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedReplyId(targetId);
      setTimeout(() => setHighlightedReplyId(null), 1600);
    }
  };

  // メッセージ本体タップ時にアクションメニューを開閉
  const handleMessageTap = (
    e: React.MouseEvent<HTMLDivElement>,
    msgId: string
  ) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        "button, a, iframe, .chat-attached-img, .chat-file-card, .chat-quote-box, .chat-code-card"
      )
    ) {
      return;
    }
    setActiveActionMsgId((prev) => (prev === msgId ? null : msgId));
  };

  // チャットログの .md / .txt ダウンロード
  const handleExportLog = (format: "md" | "txt") => {
    if (!selectedPost) return;

    const nowStr = new Date().toLocaleString("ja-JP");
    const lines: string[] = [];

    if (format === "md") {
      lines.push(`# SHIE HASSAIKAI — COMMUNICATION LOG`);
      lines.push(`- **EXPORTED AT**: ${nowStr}`);
      lines.push(`- **CATEGORY**: ${selectedPost.category || "GENERAL"}`);
      lines.push(`- **TOPIC HOST**: ${selectedPost.author_name} [トーク主]`);
      lines.push(`- **CREATED AT**: ${formatDate(selectedPost.created_at)}`);
      lines.push(`- **TOTAL MESSAGES**: ${replies.length}`);
      lines.push(``);
      lines.push(`## TOPIC MESSAGE`);
      lines.push(`> ${selectedPost.content.replace(/\n/g, "\n> ")}`);
      lines.push(``);
      lines.push(`## CHAT TRANSCRIPT`);
      lines.push(``);

      replies.forEach((r, idx) => {
        const hostLabel = isTopicCreator(r.user_id, r.author_name)
          ? " `[トーク主]`"
          : "";
        const pinLabel = r.is_pinned ? " 📌PINNED" : "";
        lines.push(
          `### ${idx + 1}. ${r.author_name}${hostLabel} (${formatDate(
            r.created_at
          )})${pinLabel}`
        );
        if (r.reply_to_author && r.reply_to_snippet) {
          lines.push(
            `> ↩ **${r.reply_to_author}**: ${r.reply_to_snippet.replace(
              /\n/g,
              " "
            )}`
          );
        }
        lines.push(r.content);
        if (r.code_snippet) {
          lines.push("```");
          lines.push(r.code_snippet);
          lines.push("```");
        }
        if (r.image_url) {
          lines.push(`- Attachment: ${r.image_url}`);
        }
        lines.push(``);
      });
    } else {
      lines.push(`==================================================`);
      lines.push(`SHIE HASSAIKAI — COMMUNICATION LOG`);
      lines.push(`EXPORTED AT : ${nowStr}`);
      lines.push(`CATEGORY    : ${selectedPost.category || "GENERAL"}`);
      lines.push(`TOPIC HOST  : ${selectedPost.author_name} [トーク主]`);
      lines.push(`CREATED AT  : ${formatDate(selectedPost.created_at)}`);
      lines.push(`==================================================`);
      lines.push(`[TOPIC]`);
      lines.push(selectedPost.content);
      lines.push(`--------------------------------------------------`);

      replies.forEach((r, idx) => {
        const hostLabel = isTopicCreator(r.user_id, r.author_name)
          ? " [トーク主]"
          : "";
        const pinLabel = r.is_pinned ? " [PINNED]" : "";
        lines.push(
          `#${String(idx + 1).padStart(3, "0")} | ${formatDate(
            r.created_at
          )} | ${r.author_name}${hostLabel}${pinLabel}`
        );
        if (r.reply_to_author && r.reply_to_snippet) {
          lines.push(
            `  ↩ 引用 (${r.reply_to_author}): ${r.reply_to_snippet.replace(
              /\n/g,
              " "
            )}`
          );
        }
        lines.push(r.content);
        if (r.code_snippet) {
          lines.push(`--- CODE / LOG ---`);
          lines.push(r.code_snippet);
          lines.push(`------------------`);
        }
        if (r.image_url) {
          lines.push(`[ATTACHMENT]: ${r.image_url}`);
        }
        lines.push(``);
      });
    }

    const contentStr = lines.join("\n");
    const blob = new Blob([contentStr], {
      type:
        format === "md"
          ? "text/markdown;charset=utf-8;"
          : "text/plain;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `shie-chat-log-${dateStamp}-${selectedPost.id.slice(
      0,
      6
    )}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTimeOnly = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isTopicCreator = useCallback(
    (userId?: string | null, name?: string | null) => {
      if (!selectedPost) return false;
      if (selectedPost.user_id && userId) {
        return selectedPost.user_id === userId;
      }
      if (name) {
        return selectedPost.author_name === name;
      }
      return false;
    },
    [selectedPost]
  );

  const filteredPosts = useMemo(() => {
    if (filterCategory === "ALL") return posts;
    return posts.filter((p) => (p.category || "GENERAL") === filterCategory);
  }, [posts, filterCategory]);

  const filteredReplies = useMemo(() => {
    const q = chatSearch.trim().toLowerCase();
    if (!q) return replies;
    return replies.filter(
      (r) =>
        r.content.toLowerCase().includes(q) ||
        r.author_name.toLowerCase().includes(q)
    );
  }, [replies, chatSearch]);

  const pinnedReplies = useMemo(
    () => replies.filter((r) => Boolean(r.is_pinned)),
    [replies]
  );

  const chatParticipants = useMemo(() => {
    if (!selectedPost) return [];
    const map = new Map<
      string,
      { name: string; avatar?: string | null; userId?: string | null }
    >();
    map.set(selectedPost.author_name, {
      name: selectedPost.author_name,
      avatar: selectedPost.author_avatar,
      userId: selectedPost.user_id,
    });
    replies.forEach((r) => {
      map.set(r.author_name, {
        name: r.author_name,
        avatar: r.author_avatar,
        userId: r.user_id,
      });
    });
    return Array.from(map.values());
  }, [selectedPost, replies]);

  const activeTypingNames = useMemo(() => {
    return Object.values(typingUsers).map((u) => u.name);
  }, [typingUsers]);

  const currentDisplayName = authorName.trim() || "MEMBER";
  const hasToolDraft = Boolean(draftFile || showCodeBox);

  // URL自動リンク ＋ @メンションハイライト表示
  const renderMessageContent = (text: string) => {
    const tokenRegex = /(https?:\/\/[^\s]+|@[^\s@]+)/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, idx) => {
      if (!part) return null;

      if (part.startsWith("http://") || part.startsWith("https://")) {
        return (
          <a
            key={idx}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="chat-auto-link"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }

      if (part.startsWith("@") && part.length > 1) {
        const isMe =
          part.slice(1).toLowerCase() === currentDisplayName.toLowerCase();
        return (
          <span
            key={idx}
            className={`chat-mention-highlight ${isMe ? "is-me" : ""}`}
          >
            {part}
          </span>
        );
      }

      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <>
      {/* メンション受信バナー */}
      {mentionAlert && (
        <div className="bbs-mention-banner">
          <div className="bbs-mention-banner-text">
            <i className="chat-dot" />
            <strong>@{currentDisplayName} 宛のメンション通知:</strong>
            <span>
              {mentionAlert.sender}「{mentionAlert.preview}」
            </span>
          </div>
          <div className="bbs-mention-banner-actions">
            <button
              type="button"
              className="bbs-mention-jump-btn"
              onClick={() => {
                const target = posts.find((p) => p.id === mentionAlert.postId);
                setMentionAlert(null);
                if (target) handleOpenPost(target);
              }}
            >
              開く ↗
            </button>
            <button
              type="button"
              className="bbs-mention-close-btn"
              onClick={() => setMentionAlert(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className={`bbs-container ${selectedPost ? "is-chat-active" : ""}`}>
        {!selectedPost ? (
          <>
            {/* 一覧画面：左カラム */}
            <div className="bbs-left-column">
              <section className="profile-card">
                <div className="profile-card-summary">
                  <UserAvatar
                    name={currentDisplayName}
                    avatar={avatarUrl}
                    size="lg"
                  />
                  <div className="profile-card-info">
                    <span className="profile-card-label">OPERATOR PROFILE</span>
                    <strong className="profile-card-name">
                      {currentDisplayName}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="profile-edit-toggle"
                    onClick={() => onOpenSettings?.()}
                  >
                    ⚙ 設定変更
                  </button>
                </div>
              </section>

              <form className="bbs-form" onSubmit={handleSubmit}>
                <div className="bbs-form-header">
                  <span>NEW TRANSMISSION</span>
                  <span>MAX 500 CHARS</span>
                </div>

                <div className="bbs-field">
                  <label>CATEGORY / TAG</label>
                  <div className="bbs-category-group">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        className={`bbs-category-btn cat-${cat.value.toLowerCase()} ${
                          category === cat.value ? "is-selected" : ""
                        }`}
                        onClick={() => setCategory(cat.value)}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bbs-field">
                  <label htmlFor="bbs-content">MESSAGE</label>
                  <textarea
                    id="bbs-content"
                    className="bbs-textarea"
                    placeholder={`「${currentDisplayName}」として新規トピックを投稿...`}
                    rows={4}
                    maxLength={500}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                  />
                </div>

                {/* 数字8桁暗号パスコードオプション */}
                <div className="bbs-passcode-panel">
                  <div className="bbs-passcode-head">
                    <label className="bbs-passcode-label">
                      <input
                        type="checkbox"
                        checked={usePasscode}
                        onChange={(e) => {
                          setUsePasscode(e.target.checked);
                          if (!e.target.checked) setRoomPasscode("");
                        }}
                      />
                      <span>🔒 鍵付き部屋にする（数字8桁パスコード）</span>
                    </label>
                    {usePasscode && (
                      <button
                        type="button"
                        className="bbs-passcode-gen"
                        onClick={() =>
                          setRoomPasscode(generate8DigitPasscode())
                        }
                      >
                        自動生成
                      </button>
                    )}
                  </div>
                  {usePasscode && (
                    <div className="bbs-passcode-row">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="\d{8}"
                        maxLength={8}
                        className="bbs-input bbs-passcode-input"
                        placeholder="数字8桁を入力（例: 48291035）"
                        value={roomPasscode}
                        onChange={(e) =>
                          setRoomPasscode(e.target.value.replace(/\D/g, ""))
                        }
                      />
                      <span className="bbs-passcode-len">
                        {roomPasscode.length}/8
                      </span>
                    </div>
                  )}
                </div>

                {error && <p className="bbs-error">{error}</p>}

                <div className="bbs-form-footer">
                  <span className="bbs-counter">{content.length} / 500</span>
                  <button
                    type="submit"
                    className="button button-red bbs-submit"
                    disabled={submitting || !content.trim()}
                  >
                    <span>{submitting ? "送信中..." : "投稿する"}</span>
                    <span className="button-arrow">↗</span>
                  </button>
                </div>
              </form>
            </div>

            {/* 一覧画面：右カラム */}
            <div className="bbs-list-wrap">
              <div className="bbs-list-header">
                <span>MESSAGE LOG（クリックでチャット）</span>
                <div className="bbs-header-right">
                  <span className="active-nodes-badge">
                    <i className="chat-dot" /> ACTIVE NODES:{" "}
                    {onlineMembers.length}
                  </span>
                  <span>{filteredPosts.length} RECORDS</span>
                </div>
              </div>

              <div className="bbs-filter-bar">
                {(
                  ["ALL", "GENERAL", "RESEARCH", "URGENT"] as FilterCategory[]
                ).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`bbs-filter-btn ${
                      filterCategory === tab ? "is-active" : ""
                    }`}
                    onClick={() => setFilterCategory(tab)}
                  >
                    {tab === "ALL"
                      ? "ALL"
                      : tab === "GENERAL"
                      ? "GENERAL / 雑談"
                      : tab === "RESEARCH"
                      ? "RESEARCH / 調査"
                      : "URGENT / 重要"}
                  </button>
                ))}
              </div>

              <div className="bbs-list">
                {loading ? (
                  <div className="bbs-empty">LOADING LOGS...</div>
                ) : filteredPosts.length === 0 ? (
                  <div className="bbs-empty">該当する投稿はありません。</div>
                ) : (
                  filteredPosts.map((post, index) => {
                    const replyCount = post.post_replies?.length ?? 0;
                    const prevRead = readCounts[post.id] ?? replyCount;
                    const unreadCount = Math.max(0, replyCount - prevRead);
                    const hasMentionInPost = mentionAlert?.postId === post.id;

                    const postCat = (post.category ||
                      "GENERAL") as PostCategory;
                    const isOwnPost =
                      currentUserId !== null && post.user_id === currentUserId;
                    const canDeletePost = isOwnPost || isAdmin;
                    const isLocked = Boolean(
                      post.passcode && /^\d{8}$/.test(post.passcode)
                    );
                    const isUnlocked =
                      isOwnPost || isAdmin || unlockedRoomIds.includes(post.id);

                    return (
                      <article
                        key={post.id}
                        className={`bbs-item bbs-item-clickable ${
                          unreadCount > 0 || hasMentionInPost
                            ? "has-unread-room"
                            : ""
                        }`}
                        onClick={() => handleOpenPost(post)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleOpenPost(post);
                          }
                        }}
                      >
                        <div className="bbs-item-meta">
                          <span className="bbs-item-no">
                            #
                            {String(filteredPosts.length - index).padStart(
                              3,
                              "0"
                            )}
                          </span>
                          <span
                            className={`bbs-tag-badge tag-${postCat.toLowerCase()}`}
                          >
                            {postCat}
                          </span>
                          <span className="bbs-author-chip">
                            <UserAvatar
                              name={post.author_name}
                              avatar={
                                isOwnPost
                                  ? post.author_avatar || avatarUrl
                                  : post.author_avatar
                              }
                              size="sm"
                            />
                            <strong className="bbs-item-author">
                              {post.author_name}
                            </strong>
                            <span className="chat-host-badge">[トーク主]</span>
                          </span>
                          <span className="bbs-chat-badge">
                            CHAT [{replyCount}] ↗
                          </span>

                          {isLocked && (
                            <span className="bbs-lock-badge">
                              🔒 {isUnlocked ? "UNLOCKED" : "LOCKED"}
                            </span>
                          )}

                          {(unreadCount > 0 || hasMentionInPost) && (
                            <span className="bbs-unread-badge">
                              {hasMentionInPost
                                ? "@MENTION"
                                : `NEW +${unreadCount}`}
                            </span>
                          )}

                          {canDeletePost && (
                            <div
                              className="bbs-delete-wrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {confirmDeletePostId === post.id ? (
                                <>
                                  <button
                                    type="button"
                                    className="bbs-delete-confirm"
                                    onClick={() => handleDeletePost(post.id)}
                                  >
                                    確定
                                  </button>
                                  <button
                                    type="button"
                                    className="bbs-delete-cancel"
                                    onClick={() => setConfirmDeletePostId(null)}
                                  >
                                    戻す
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="bbs-delete-btn"
                                  onClick={() =>
                                    setConfirmDeletePostId(post.id)
                                  }
                                >
                                  削除
                                </button>
                              )}
                            </div>
                          )}

                          <time className="bbs-item-date">
                            {formatDate(post.created_at)}
                          </time>
                        </div>
                        <p className="bbs-item-content">
                          {isLocked && !isUnlocked
                            ? "🔒 数字8桁の暗号パスコードで保護された作戦会議室です。"
                            : post.content}
                        </p>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </>
        ) : (
          /* チャット画面：上部コンパクトバー ＋ 下部リサイズ可能ワイドチャット */
          <div className="chat-wide-workspace">
            {/* 上部コンパクトツールバー */}
            <div className="chat-top-intel-bar">
              <div className="chat-top-profile">
                <UserAvatar
                  name={currentDisplayName}
                  avatar={avatarUrl}
                  size="sm"
                />
                <strong>{currentDisplayName}</strong>
                <button
                  type="button"
                  className="profile-edit-toggle"
                  onClick={() => onOpenSettings?.()}
                >
                  ⚙ 設定
                </button>
              </div>

              <div className="chat-top-online">
                <span className="active-nodes-badge">
                  <i className="chat-dot" /> ONLINE: {onlineMembers.length}
                </span>
                <div className="chat-top-avatars">
                  {onlineMembers.map((m) => (
                    <span
                      key={m.key}
                      className="chat-top-member-pill"
                      title={`${m.name}${
                        isTopicCreator(m.user_id, m.name) ? " [トーク主]" : ""
                      }`}
                    >
                      <UserAvatar
                        name={m.name}
                        avatar={m.avatar}
                        size="sm"
                      />
                      <span>{m.name}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="chat-top-participants">
                <span className="chat-top-label">@メンション:</span>
                {chatParticipants.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="intel-participant-chip"
                    onClick={() => {
                      setReplyText((prev) =>
                        prev ? `${prev} @${p.name} ` : `@${p.name} `
                      );
                      chatInputRef.current?.focus();
                    }}
                  >
                    <span>@{p.name}</span>
                  </button>
                ))}
              </div>

              <div className="chat-top-search">
                <input
                  type="text"
                  className="bbs-input chat-top-search-input"
                  placeholder="ログ内検索..."
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                />
                {chatSearch && (
                  <button
                    type="button"
                    className="chat-search-clear"
                    onClick={() => setChatSearch("")}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* 下部ワイドチャットルーム（ドラッグで縦横リサイズ可能） */}
            <div
              ref={chatRoomRef}
              className={`chat-room chat-room-wide ${
                isResizingChat ? "is-resizing" : ""
              }`}
              style={{
                width: chatWidth ? `${chatWidth}px` : "100%",
                height: chatHeight ? `${chatHeight}px` : undefined,
              }}
            >
              <div className="chat-header">
                <button
                  type="button"
                  className="chat-back-btn"
                  onClick={() => {
                    notifyTypingBroadcast(true);
                    setSelectedPost(null);
                    setChatSearch("");
                    setAttachError(null);
                    setQuoteTarget(null);
                    setActiveActionMsgId(null);
                    setConfirmDeleteReplyId(null);
                    setToolMenuOpen(false);
                    fetchPosts();
                  }}
                >
                  ← トピック一覧へ戻る
                </button>
                <div className="chat-header-status-group">
                  <div
                    className="chat-size-controls"
                    title="枠の端や右下の角をドラッグしても大きさを変えられます"
                  >
                    <span className="chat-size-readout">
                      {chatWidth ? `${chatWidth}px` : "FULL"} ×{" "}
                      {chatHeight ? `${chatHeight}px` : "AUTO"}
                    </span>
                    <button
                      type="button"
                      className="chat-size-preset-btn"
                      onClick={() => applyChatSizePreset("compact")}
                    >
                      小
                    </button>
                    <button
                      type="button"
                      className="chat-size-preset-btn"
                      onClick={() => applyChatSizePreset("default")}
                    >
                      標準
                    </button>
                    <button
                      type="button"
                      className="chat-size-preset-btn"
                      onClick={() => applyChatSizePreset("tall")}
                    >
                      大
                    </button>
                  </div>

                  <div className="chat-export-group">
                    <button
                      type="button"
                      className="chat-export-btn"
                      title="ログをMarkdown(.md)形式で保存"
                      onClick={() => handleExportLog("md")}
                    >
                      ⬇ .MD
                    </button>
                    <button
                      type="button"
                      className="chat-export-btn"
                      title="ログをテキスト(.txt)形式で保存"
                      onClick={() => handleExportLog("txt")}
                    >
                      ⬇ .TXT
                    </button>
                  </div>
                  {selectedPost.passcode && (
                    <span className="bbs-lock-badge">
                      🔒 PASS: {selectedPost.passcode}
                    </span>
                  )}
                  <span className="chat-room-status">
                    <i className="chat-dot" /> LIVE CHANNEL
                  </span>
                </div>
              </div>

              <div className="chat-topic-pin">
                <div className="chat-topic-meta">
                  <div className="chat-topic-meta-left">
                    <span
                      className={`bbs-tag-badge tag-${(
                        selectedPost.category || "GENERAL"
                      ).toLowerCase()}`}
                    >
                      {selectedPost.category || "GENERAL"}
                    </span>
                    <UserAvatar
                      name={selectedPost.author_name}
                      avatar={selectedPost.author_avatar}
                      size="sm"
                    />
                    <span>TOPIC BY {selectedPost.author_name}</span>
                    <span className="chat-host-badge">[トーク主]</span>
                  </div>
                  <div className="chat-topic-meta-right">
                    {((currentUserId !== null &&
                      selectedPost.user_id === currentUserId) ||
                      isAdmin) && (
                      <button
                        type="button"
                        className="bbs-delete-btn"
                        onClick={() => handleDeletePost(selectedPost.id)}
                      >
                        トピック削除
                      </button>
                    )}
                    <span>{formatDate(selectedPost.created_at)}</span>
                  </div>
                </div>
                <p>{selectedPost.content}</p>
              </div>

              {/* 📌 ピン留めされた重要連絡バー */}
              {pinnedReplies.length > 0 && (
                <div className="chat-pinned-strip">
                  <div className="chat-pinned-strip-head">
                    <span>📌 PINNED ({pinnedReplies.length})</span>
                  </div>
                  <div className="chat-pinned-strip-items">
                    {pinnedReplies.map((pin) => (
                      <div key={pin.id} className="chat-pinned-strip-row">
                        <span className="chat-pinned-strip-text">
                          <strong>
                            {pin.author_name}
                            {isTopicCreator(pin.user_id, pin.author_name)
                              ? " [トーク主]"
                              : ""}
                            :
                          </strong>{" "}
                          {pin.content}
                        </span>
                        <button
                          type="button"
                          className="chat-unpin-mini"
                          onClick={() => handleTogglePin(pin)}
                        >
                          解除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="chat-messages">
                {loadingReplies ? (
                  <div className="bbs-empty">CONNECTING...</div>
                ) : filteredReplies.length === 0 ? (
                  <div className="bbs-empty">
                    {chatSearch
                      ? "検索条件に一致するメッセージはありません。"
                      : "メッセージはまだありません。最初の返信を送信してください。"}
                  </div>
                ) : (
                  filteredReplies.map((msg) => {
                    const isMine =
                      currentUserId !== null && msg.user_id === currentUserId;
                    const isHostOfCurrentRoom = Boolean(
                      currentUserId &&
                        selectedPost &&
                        selectedPost.user_id === currentUserId
                    );
                    const canDeleteOtherMsg =
                      !isMine && (isHostOfCurrentRoom || isAdmin);
                    const msgIsHost = isTopicCreator(
                      msg.user_id,
                      msg.author_name
                    );
                    const attachment = msg.image_url
                      ? parseAttachmentInfo(msg.image_url)
                      : null;
                    const youtubeIds = extractYouTubeIds(msg.content);
                    const msgReactions = reactions.filter(
                      (r) => r.reply_id === msg.id
                    );
                    const ackList = msgReactions.filter(
                      (r) => r.reaction_type === "ACK"
                    );
                    const impList = msgReactions.filter(
                      (r) => r.reaction_type === "IMPORTANT"
                    );
                    const hasAcked = ackList.some(
                      (r) => r.user_id === currentUserId
                    );
                    const hasImped = impList.some(
                      (r) => r.user_id === currentUserId
                    );
                    const isActionsOpen = activeActionMsgId === msg.id;
                    const hasReactionBadges =
                      ackList.length > 0 ||
                      impList.length > 0 ||
                      Boolean(msg.is_pinned);

                    return (
                      <div
                        key={msg.id}
                        id={`reply-msg-${msg.id}`}
                        data-msg-action-id={msg.id}
                        onClick={(e) => handleMessageTap(e, msg.id)}
                        className={`chat-row ${isMine ? "is-mine" : "is-other"} ${
                          highlightedReplyId === msg.id
                            ? "is-highlighted-row"
                            : ""
                        } ${isActionsOpen ? "is-actions-open" : ""}`}
                      >
                        <div className="chat-message-layout">
                          {!isMine && (
                            <div className="chat-avatar-col">
                              <UserAvatar
                                name={msg.author_name}
                                avatar={msg.author_avatar}
                                size="md"
                              />
                            </div>
                          )}

                          <div className="chat-body-col">
                            {!isMine ? (
                              <div className="chat-sender-row">
                                <span className="chat-sender">
                                  {msg.author_name}
                                </span>
                                {msgIsHost && (
                                  <span className="chat-host-badge">
                                    [トーク主]
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="chat-mention-reply-btn"
                                  onClick={() => {
                                    setReplyText((prev) =>
                                      prev
                                        ? `${prev} @${msg.author_name} `
                                        : `@${msg.author_name} `
                                    );
                                    setActiveActionMsgId(null);
                                    chatInputRef.current?.focus();
                                  }}
                                >
                                  @返信
                                </button>
                              </div>
                            ) : (
                              msgIsHost && (
                                <div className="chat-sender-row is-mine-sender">
                                  <span className="chat-host-badge">
                                    [トーク主]
                                  </span>
                                  <span className="chat-sender">
                                    {msg.author_name}
                                  </span>
                                </div>
                              )
                            )}

                            <div className="chat-bubble-wrap">
                              {isMine && (
                                <div className="chat-side-meta">
                                  <button
                                    type="button"
                                    className="chat-unsend-btn"
                                    onClick={() => handleDeleteReply(msg.id)}
                                    title="送信取消"
                                  >
                                    取消
                                  </button>
                                  <span className="chat-time">
                                    {formatTimeOnly(msg.created_at)}
                                  </span>
                                </div>
                              )}

                              <div
                                className={`chat-bubble chat-bubble-interactive ${
                                  msg.is_pinned ? "is-pinned-bubble" : ""
                                }`}
                              >
                                {msg.reply_to_author && (
                                  <div
                                    className="chat-quote-box"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() =>
                                      handleJumpToReply(msg.reply_to_id)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        handleJumpToReply(msg.reply_to_id);
                                      }
                                    }}
                                  >
                                    <span className="chat-quote-author">
                                      ↩ {msg.reply_to_author}
                                    </span>
                                    <p className="chat-quote-snippet">
                                      {msg.reply_to_snippet || ""}
                                    </p>
                                  </div>
                                )}

                                <div>{renderMessageContent(msg.content)}</div>

                                {youtubeIds.map((vid) => (
                                  <div
                                    key={vid}
                                    className="chat-youtube-embed"
                                  >
                                    <iframe
                                      src={`https://www.youtube.com/embed/${vid}`}
                                      title="YouTube video player"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    />
                                  </div>
                                ))}

                                {attachment && attachment.isImage && (
                                  <div className="chat-attached-media-wrap">
                                    <img
                                      src={attachment.cleanUrl}
                                      alt={
                                        attachment.isGif
                                          ? "添付GIF"
                                          : "添付画像"
                                      }
                                      className="chat-attached-img"
                                      onClick={() =>
                                        setLightboxImage(attachment.cleanUrl)
                                      }
                                    />
                                    {attachment.isGif && (
                                      <span className="chat-gif-tag">GIF</span>
                                    )}
                                  </div>
                                )}

                                {attachment && !attachment.isImage && (
                                  <a
                                    href={attachment.cleanUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={attachment.fileName}
                                    className="chat-file-card"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span className="chat-file-card-icon">
                                      📎
                                    </span>
                                    <span className="chat-file-card-info">
                                      <strong>{attachment.fileName}</strong>
                                      <small>FILE ATTACHMENT ↗</small>
                                    </span>
                                  </a>
                                )}

                                {msg.code_snippet && (
                                  <div className="chat-code-card">
                                    <div className="chat-code-card-head">
                                      <span>CODE / LOG</span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCopyCode(
                                            msg.id,
                                            msg.code_snippet || ""
                                          )
                                        }
                                      >
                                        {copiedCodeId === msg.id
                                          ? "✓ COPIED"
                                          : "COPY"}
                                      </button>
                                    </div>
                                    <pre>
                                      <code>{msg.code_snippet}</code>
                                    </pre>
                                  </div>
                                )}
                              </div>

                              {!isMine && (
                                <div className="chat-side-meta is-other-side">
                                  {canDeleteOtherMsg && (
                                    <div className="chat-mod-delete-wrap">
                                      {confirmDeleteReplyId === msg.id ? (
                                        <>
                                          <button
                                            type="button"
                                            className="chat-mod-delete-confirm"
                                            onClick={() => {
                                              setConfirmDeleteReplyId(null);
                                              handleDeleteReply(msg.id);
                                            }}
                                          >
                                            確定
                                          </button>
                                          <button
                                            type="button"
                                            className="chat-mod-delete-cancel"
                                            onClick={() =>
                                              setConfirmDeleteReplyId(null)
                                            }
                                          >
                                            戻す
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          className="chat-unsend-btn is-mod-delete"
                                          onClick={() =>
                                            setConfirmDeleteReplyId(msg.id)
                                          }
                                          title="トーク主・管理者権限でこのメッセージを削除"
                                        >
                                          削除
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  <span className="chat-time">
                                    {formatTimeOnly(msg.created_at)}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* リアクション済みのコンパクトバッジ */}
                            {hasReactionBadges && (
                              <div className="chat-reaction-summary">
                                {ackList.length > 0 && (
                                  <span
                                    className={`chat-mini-badge ${
                                      hasAcked ? "is-active" : ""
                                    }`}
                                  >
                                    ✓ {ackList.length}
                                  </span>
                                )}
                                {impList.length > 0 && (
                                  <span
                                    className={`chat-mini-badge is-important ${
                                      hasImped ? "is-active" : ""
                                    }`}
                                  >
                                    ★ {impList.length}
                                  </span>
                                )}
                                {msg.is_pinned && (
                                  <span className="chat-mini-badge is-pinned">
                                    📌 固定中
                                  </span>
                                )}
                              </div>
                            )}

                            {/* ホバー / 1回タップでアニメーション表示されるアクションボタン */}
                            <div className="chat-reactions-bar">
                              <button
                                type="button"
                                className="chat-reaction-btn"
                                onClick={() => {
                                  setQuoteTarget({
                                    id: msg.id,
                                    author_name: msg.author_name,
                                    content: msg.content,
                                  });
                                  setActiveActionMsgId(null);
                                  chatInputRef.current?.focus();
                                }}
                              >
                                ↩ 引用
                              </button>
                              <button
                                type="button"
                                className={`chat-reaction-btn ${
                                  hasAcked ? "is-active" : ""
                                }`}
                                onClick={() =>
                                  handleToggleReaction(msg.id, "ACK")
                                }
                              >
                                ✓ 了解
                                {ackList.length > 0 ? ` ${ackList.length}` : ""}
                              </button>
                              <button
                                type="button"
                                className={`chat-reaction-btn is-important ${
                                  hasImped ? "is-active" : ""
                                }`}
                                onClick={() =>
                                  handleToggleReaction(msg.id, "IMPORTANT")
                                }
                              >
                                ★ 重要
                                {impList.length > 0 ? ` ${impList.length}` : ""}
                              </button>
                              <button
                                type="button"
                                className={`chat-reaction-btn ${
                                  msg.is_pinned ? "is-active" : ""
                                }`}
                                onClick={() => handleTogglePin(msg)}
                              >
                                📌 {msg.is_pinned ? "解除" : "固定"}
                              </button>
                              {canDeleteOtherMsg && (
                                <button
                                  type="button"
                                  className="chat-reaction-btn is-danger"
                                  onClick={() => handleDeleteReply(msg.id)}
                                >
                                  🗑 削除
                                </button>
                              )}
                            </div>
                          </div>

                          {isMine && (
                            <div className="chat-avatar-col">
                              <UserAvatar
                                name={msg.author_name}
                                avatar={msg.author_avatar || avatarUrl}
                                size="md"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* 「〇〇が入力中...」リアルタイム表示 */}
              {activeTypingNames.length > 0 && (
                <div className="chat-typing-bar">
                  <span className="chat-typing-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>
                    {activeTypingNames.join("、")} が入力中...
                  </span>
                </div>
              )}

              {/* 引用返信プレビュー＆添付画像・GIF・ファイル・コードブロック下書き */}
              {(quoteTarget ||
                draftPreviewUrl ||
                draftIsGenericFile ||
                showCodeBox ||
                attachError) && (
                <div className="chat-compose-extras">
                  {quoteTarget && (
                    <div className="chat-quote-preview">
                      <div className="chat-quote-preview-text">
                        <strong>↩ {quoteTarget.author_name} への返信</strong>
                        <span>{quoteTarget.content}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQuoteTarget(null)}
                      >
                        ×
                      </button>
                    </div>
                  )}
                  {attachError && (
                    <p className="bbs-error" style={{ margin: 0 }}>
                      {attachError}
                    </p>
                  )}
                  {draftPreviewUrl && (
                    <div className="chat-draft-img-box">
                      <img src={draftPreviewUrl} alt="添付プレビュー" />
                      {draftIsGif && (
                        <span className="chat-gif-tag is-inline">GIF</span>
                      )}
                      <button type="button" onClick={clearDraftAttachment}>
                        × 削除
                      </button>
                    </div>
                  )}
                  {draftIsGenericFile && draftFile && (
                    <div className="chat-draft-file-box">
                      <span className="chat-draft-file-icon">📎</span>
                      <div className="chat-draft-file-meta">
                        <strong>{draftFile.name}</strong>
                        <span>{formatFileSize(draftFile.size)}</span>
                      </div>
                      <button type="button" onClick={clearDraftAttachment}>
                        × 削除
                      </button>
                    </div>
                  )}
                  {showCodeBox && (
                    <div className="chat-draft-code-box">
                      <div className="chat-draft-code-head">
                        <span>CODE / LOG SNIPPET</span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCodeBox(false);
                            setDraftCode("");
                          }}
                        >
                          × 閉じる
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        placeholder="共有するコードやログを貼り付け..."
                        value={draftCode}
                        onChange={(e) => setDraftCode(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="chat-input-bar">
                <UserAvatar
                  name={currentDisplayName}
                  avatar={avatarUrl}
                  size="md"
                />

                {/* ツールメニュー用 hidden inputs */}
                <input
                  ref={chatImageInputRef}
                  type="file"
                  accept="image/*"
                  className="profile-file-hidden"
                  onChange={(e) => handleToolAttachmentSelect(e, "image")}
                />
                <input
                  ref={chatGifInputRef}
                  type="file"
                  accept="image/gif,.gif"
                  className="profile-file-hidden"
                  onChange={(e) => handleToolAttachmentSelect(e, "gif")}
                />
                <input
                  ref={chatGenericFileInputRef}
                  type="file"
                  className="profile-file-hidden"
                  onChange={(e) => handleToolAttachmentSelect(e, "file")}
                />

                {/* 統合された「ツール🧰」ボタン＋アニメーション展開メニュー */}
                <div className="chat-tool-wrap" ref={toolMenuRef}>
                  <button
                    type="button"
                    className={`chat-tool-trigger-btn ${
                      toolMenuOpen ? "is-open" : ""
                    } ${hasToolDraft ? "has-active-tool" : ""}`}
                    aria-expanded={toolMenuOpen}
                    onClick={() => setToolMenuOpen((prev) => !prev)}
                  >
                    <span className="chat-tool-emoji">🧰</span>
                    <span>ツール</span>
                  </button>

                  <div
                    className={`chat-tool-popover ${
                      toolMenuOpen ? "is-open" : ""
                    }`}
                    role="menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="chat-tool-menu-item"
                      onClick={() => chatImageInputRef.current?.click()}
                    >
                      <span className="chat-tool-item-icon">🖼️</span>
                      <span className="chat-tool-item-label">
                        <strong>画像を添付</strong>
                        <small>PNG / JPG / WEBP</small>
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className="chat-tool-menu-item"
                      onClick={() => chatGifInputRef.current?.click()}
                    >
                      <span className="chat-tool-item-icon">🎞️</span>
                      <span className="chat-tool-item-label">
                        <strong>GIFを添付</strong>
                        <small>アニメーションGIF</small>
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className="chat-tool-menu-item"
                      onClick={() => chatGenericFileInputRef.current?.click()}
                    >
                      <span className="chat-tool-item-icon">📎</span>
                      <span className="chat-tool-item-label">
                        <strong>ファイルを添付</strong>
                        <small>FILE / PDF / TXT / ZIP</small>
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className={`chat-tool-menu-item ${
                        showCodeBox ? "is-selected" : ""
                      }`}
                      onClick={() => {
                        setShowCodeBox((v) => !v);
                        setToolMenuOpen(false);
                      }}
                    >
                      <span className="chat-tool-item-icon">{"</>"}</span>
                      <span className="chat-tool-item-label">
                        <strong>コードを共有</strong>
                        <small>CODE / LOG スニペット</small>
                      </span>
                    </button>
                  </div>
                </div>

                <textarea
                  ref={chatInputRef}
                  className="chat-input"
                  placeholder={
                    enterToSend
                      ? `「${currentDisplayName}」として送信... (@名前でメンション / Enterで送信)`
                      : `「${currentDisplayName}」として送信... (Ctrl+Enterで送信)`
                  }
                  rows={1}
                  maxLength={500}
                  value={replyText}
                  onChange={(e) => {
                    setReplyText(e.target.value);
                    if (e.target.value.trim()) {
                      notifyTypingBroadcast(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (enterToSend) {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    } else if (
                      e.key === "Enter" &&
                      (e.ctrlKey || e.metaKey)
                    ) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />
                <button
                  type="button"
                  className="chat-send-btn"
                  disabled={
                    sendingReply ||
                    (!replyText.trim() && !draftFile && !draftCode.trim())
                  }
                  onClick={handleSendReply}
                >
                  {sendingReply ? "送信中" : "送信"}
                </button>
              </div>

              {/* ドラッグリサイズ用ハンドル（右辺・下辺・右下角） */}
              <div
                className="chat-resize-edge-right"
                title="左右ドラッグで横幅を調整"
                onMouseDown={(e) =>
                  startChatResize("right", e.clientX, e.clientY)
                }
                onTouchStart={(e) => {
                  if (e.touches[0]) {
                    startChatResize(
                      "right",
                      e.touches[0].clientX,
                      e.touches[0].clientY
                    );
                  }
                }}
              />
              <div
                className="chat-resize-edge-bottom"
                title="上下ドラッグで高さを調整"
                onMouseDown={(e) =>
                  startChatResize("bottom", e.clientX, e.clientY)
                }
                onTouchStart={(e) => {
                  if (e.touches[0]) {
                    startChatResize(
                      "bottom",
                      e.touches[0].clientX,
                      e.touches[0].clientY
                    );
                  }
                }}
              >
                <span className="chat-resize-grip-bar" />
              </div>
              <div
                className="chat-resize-corner"
                title="ドラッグで縦横サイズを自由に調整"
                onMouseDown={(e) =>
                  startChatResize("corner", e.clientX, e.clientY)
                }
                onTouchStart={(e) => {
                  if (e.touches[0]) {
                    startChatResize(
                      "corner",
                      e.touches[0].clientX,
                      e.touches[0].clientY
                    );
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 🔒 数字8桁パスコード入力モーダル */}
      {passcodeModalPost && (
        <div
          className="settings-modal-backdrop"
          onClick={() => setPasscodeModalPost(null)}
        >
          <div
            className="settings-modal"
            style={{ maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-modal-header">
              <div>
                <span className="settings-modal-kicker">
                  ENCRYPTED CHANNEL
                </span>
                <h2>🔒 数字8桁パスコード認証</h2>
              </div>
              <button
                type="button"
                className="settings-modal-close"
                onClick={() => setPasscodeModalPost(null)}
              >
                ×
              </button>
            </div>
            <form
              className="settings-modal-body"
              onSubmit={handleVerifyPasscode}
            >
              <div className="bbs-field">
                <label htmlFor="room-passcode-verify">
                  8-DIGIT NUMERIC PASSCODE
                </label>
                <input
                  id="room-passcode-verify"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{8}"
                  maxLength={8}
                  autoFocus
                  className="bbs-input bbs-passcode-verify-input"
                  placeholder="00000000"
                  value={passcodeInput}
                  onChange={(e) =>
                    setPasscodeInput(e.target.value.replace(/\D/g, ""))
                  }
                />
              </div>
              {passcodeError && <p className="bbs-error">{passcodeError}</p>}
              <div className="settings-modal-footer">
                <button
                  type="button"
                  className="settings-cancel-btn"
                  onClick={() => setPasscodeModalPost(null)}
                >
                  キャンセル
                </button>
                <button type="submit" className="profile-save-btn">
                  認証して入室する ↗
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 添付画像・GIF拡大プレビュー */}
      {lightboxImage && (
        <div
          className="settings-modal-backdrop"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="chat-lightbox-wrap"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={lightboxImage} alt="拡大表示" />
            <button
              type="button"
              className="profile-save-btn"
              onClick={() => setLightboxImage(null)}
            >
              閉じる ×
            </button>
          </div>
        </div>
      )}

      {/* 設定モーダル */}
      {settingsOpen && (
        <div
          className="settings-modal-backdrop"
          onClick={() => onCloseSettings?.()}
        >
          <div
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-modal-header">
              <div>
                <span className="settings-modal-kicker">
                  TERMINAL CONFIGURATION
                </span>
                <h2 id="settings-modal-title">オペレーター・システム設定</h2>
              </div>
              <button
                type="button"
                className="settings-modal-close"
                onClick={() => onCloseSettings?.()}
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            <form className="settings-modal-body" onSubmit={handleSaveProfile}>
              <div className="profile-editor-preview">
                <UserAvatar
                  name={draftName.trim() || "MEMBER"}
                  avatar={draftAvatar}
                  size="lg"
                />
                <div className="profile-preview-text">
                  <span className="profile-card-label">LIVE PREVIEW</span>
                  <strong>{draftName.trim() || "MEMBER"}</strong>
                </div>
                <div className="profile-upload-actions">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="profile-file-hidden"
                    onChange={handleAvatarFileChange}
                  />
                  <button
                    type="button"
                    className="profile-upload-btn"
                    disabled={uploadingAvatar}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadingAvatar
                      ? "画像処理中..."
                      : "好きな画像を選択"}
                  </button>
                  <small>正方形に自動リサイズされます</small>
                </div>
              </div>

              <div className="bbs-field">
                <label>PRESET ICONS / 紋章アイコン選択</label>
                <div className="profile-preset-grid">
                  {PRESET_AVATARS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`profile-preset-btn ${
                        draftAvatar === preset.id ? "is-selected" : ""
                      }`}
                      onClick={() => setDraftAvatar(preset.id)}
                    >
                      <UserAvatar
                        name={draftName.trim() || "MEMBER"}
                        avatar={preset.id}
                        size="sm"
                      />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bbs-field">
                <label htmlFor="modal-username">USER NAME / ユーザーネーム</label>
                <input
                  id="modal-username"
                  type="text"
                  className="bbs-input"
                  placeholder="表示名を入力"
                  maxLength={30}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                />
              </div>

              <div className="settings-options-group">
                <div className="settings-option-row">
                  <div>
                    <strong>着信通知サウンド</strong>
                    <small>相手からメッセージが届いたときに通信音を鳴らします</small>
                  </div>
                  <div className="settings-option-controls">
                    <button
                      type="button"
                      className="settings-mini-btn"
                      onClick={() => onNotifySound?.()}
                    >
                      試聴
                    </button>
                    <button
                      type="button"
                      className={`settings-switch-btn ${
                        soundEnabled ? "is-on" : ""
                      }`}
                      onClick={() => onToggleSound?.()}
                    >
                      {soundEnabled ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>

                <div className="settings-option-row">
                  <div>
                    <strong>Enterキーでチャット送信</strong>
                    <small>
                      OFFにすると Enter は改行、Ctrl+Enter で送信になります
                    </small>
                  </div>
                  <button
                    type="button"
                    className={`settings-switch-btn ${
                      draftEnterSend ? "is-on" : ""
                    }`}
                    onClick={() => setDraftEnterSend(!draftEnterSend)}
                  >
                    {draftEnterSend ? "ON" : "OFF"}
                  </button>
                </div>
              </div>

              {profileNotice && (
                <p className="profile-notice">{profileNotice}</p>
              )}

              <div className="settings-modal-footer">
                <button
                  type="button"
                  className="settings-cancel-btn"
                  onClick={() => onCloseSettings?.()}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="profile-save-btn"
                  disabled={savingProfile || uploadingAvatar}
                >
                  {savingProfile ? "反映中..." : "設定を保存して即座に反映"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
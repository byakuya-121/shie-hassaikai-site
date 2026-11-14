
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./login-form";

// SupabaseのCookie認証を使うため、即時ナビゲーション検証を無効化
export const instant = false;

export default async function WelcomePage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();

  // ログイン済みならホームへ
  if (!error && data?.claims) {
    redirect("/home");
  }

  return <LoginForm />;
}

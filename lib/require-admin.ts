import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

// =========================================
// 요청 보낸 사람이 admin인지 확인
// admin이 아니면(로그인 안 함 포함) null 반환
// =========================================
export async function requireAdmin() {
  const cookieStore = await cookies();

  const supabaseServer = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );

  const {
    data: { user: authUser },
  } = await supabaseServer.auth.getUser();

  if (!authUser) {
    return null;
  }

  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .single();

  if (!userRow || userRow.role !== "admin") {
    return null;
  }

  return authUser;
}

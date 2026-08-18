import { createBrowserClient } from "@supabase/ssr";

// 브라우저(클라이언트) 전용 클라이언트 (anon 키 사용)
// 세션을 쿠키에 저장해서 미들웨어(서버)와 세션 정보를 공유합니다.
export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
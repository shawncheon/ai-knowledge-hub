import { createClient } from "@supabase/supabase-js";

// 서버 전용 클라이언트 (service_role 키 사용, 모든 권한)
// 이 파일은 반드시 API route(서버 코드)에서만 import 해야 합니다.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);
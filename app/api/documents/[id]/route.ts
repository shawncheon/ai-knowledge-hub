import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

// =========================================
// 요청 보낸 사람이 admin인지 확인
// =========================================
async function requireAdmin() {
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
    }
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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // =========================================
    // 0. 관리자 권한 확인
    // =========================================
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "문서 삭제는 관리자만 가능합니다." },
        { status: 403 }
      );
    }

    const { id } = await params;

    // =========================================
    // 1. 문서 정보 조회 (Storage 경로 확인용)
    // =========================================
    const { data: documentRow, error: fetchError } = await supabaseAdmin
      .from("documents")
      .select("storage_path, file_name")
      .eq("id", id)
      .single();

    if (fetchError || !documentRow) {
      return NextResponse.json(
        { success: false, error: "문서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // =========================================
    // 2. Storage에서 원본 파일 삭제
    // =========================================
    if (documentRow.storage_path) {
      const { error: storageError } = await supabaseAdmin.storage
        .from("documents")
        .remove([documentRow.storage_path]);

      if (storageError) {
        console.error("Storage 파일 삭제 실패:", storageError);
        // Storage 삭제 실패해도 DB 정리는 계속 진행
      }
    }

    // =========================================
    // 3. DB에서 문서 삭제 (청크는 cascade로 자동 삭제)
    // =========================================
    const { error: deleteError } = await supabaseAdmin
      .from("documents")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return NextResponse.json({
      success: true,
      message: `"${documentRow.file_name}" 문서가 삭제되었습니다.`,
    });
  } catch (error) {
    console.error("Document Delete Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "문서 삭제 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
// =========================================
// GET: 문서 상세 정보 조회 (텍스트 미리보기 포함)
// =========================================
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: doc, error } = await supabaseAdmin
      .from("documents")
      .select(
        "id, file_name, file_size, chunk_count, created_at, full_text, storage_path"
      )
      .eq("id", id)
      .single();

    if (error || !doc) {
      return NextResponse.json(
        { success: false, error: "문서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        fileName: doc.file_name,
        fileSize: doc.file_size,
        chunkCount: doc.chunk_count,
        createdAt: doc.created_at,
        textPreview: (doc.full_text || "").slice(0, 3000),
        hasFile: !!doc.storage_path,
      },
    });
  } catch (error) {
    console.error("Document Detail Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "문서 조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
// =========================================
// (직접입력용) 텍스트를 일정 길이로 청크 분할
// =========================================
function splitIntoChunks(
  text: string,
  chunkSize = 800,
  overlap = 100
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    start += chunkSize - overlap;
  }

  return chunks;
}

// =========================================
// PUT: 직접 입력 정보 수정 (기존 청크 삭제 후 재생성)
// =========================================
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 0. 관리자 권한 확인
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "정보 수정은 관리자만 가능합니다." },
        { status: 403 }
      );
    }

    const { id } = await params;

    // 1. 기존 문서 확인 (파일 업로드 문서는 수정 불가)
    const { data: existingDoc, error: fetchError } = await supabaseAdmin
      .from("documents")
      .select("id, storage_path")
      .eq("id", id)
      .single();

    if (fetchError || !existingDoc) {
      return NextResponse.json(
        { success: false, error: "문서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (existingDoc.storage_path) {
      return NextResponse.json(
        {
          success: false,
          error:
            "파일 업로드로 등록된 문서는 수정할 수 없습니다. 삭제 후 다시 업로드해주세요.",
        },
        { status: 400 }
      );
    }

    // 2. 요청 데이터 확인
    const { title, content } = await req.json();

    const trimmedTitle = (title || "").trim();
    const trimmedContent = (content || "").trim();

    if (!trimmedTitle) {
      return NextResponse.json(
        { success: false, error: "제목을 입력해주세요." },
        { status: 400 }
      );
    }

    if (!trimmedContent) {
      return NextResponse.json(
        { success: false, error: "내용을 입력해주세요." },
        { status: 400 }
      );
    }

    // 3. 새 내용으로 청킹
    const chunks = splitIntoChunks(trimmedContent);

    if (chunks.length === 0) {
      return NextResponse.json(
        { success: false, error: "등록할 내용이 너무 짧습니다." },
        { status: 400 }
      );
    }

    // 4. 새 임베딩 생성
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const embedResponse = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: chunks,
      config: {
        outputDimensionality: 768,
      },
    });

    const embeddings = embedResponse.embeddings || [];

    if (embeddings.length !== chunks.length) {
      throw new Error("임베딩 개수가 청크 개수와 일치하지 않습니다.");
    }

    // 5. 기존 청크 삭제
    const { error: deleteChunksError } = await supabaseAdmin
      .from("document_chunks")
      .delete()
      .eq("document_id", id);

    if (deleteChunksError) {
      throw new Error(deleteChunksError.message);
    }

    // 6. 새 청크 저장
    const chunkRows = chunks.map((chunkContent, index) => ({
      document_id: id,
      content: chunkContent,
      chunk_index: index,
      embedding: embeddings[index].values,
    }));

    const { error: insertChunksError } = await supabaseAdmin
      .from("document_chunks")
      .insert(chunkRows);

    if (insertChunksError) {
      throw new Error(insertChunksError.message);
    }

    // 7. 문서 메타데이터 갱신
    const { data: updatedDoc, error: updateError } = await supabaseAdmin
      .from("documents")
      .update({
        file_name: trimmedTitle,
        file_size: Buffer.byteLength(trimmedContent, "utf-8"),
        full_text: trimmedContent,
        chunk_count: chunks.length,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError || !updatedDoc) {
      throw new Error(updateError?.message || "문서 수정에 실패했습니다.");
    }

    return NextResponse.json({
      success: true,
      document: {
        id: updatedDoc.id,
        fileName: updatedDoc.file_name,
        fileSize: updatedDoc.file_size,
        chunkCount: updatedDoc.chunk_count,
        createdAt: updatedDoc.created_at,
        textPreview: trimmedContent.slice(0, 3000),
      },
      message: "정보가 수정되었습니다.",
    });
  } catch (error) {
    console.error("Document Update Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "정보 수정 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
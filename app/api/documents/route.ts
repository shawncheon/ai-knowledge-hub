import { NextResponse } from "next/server";
import { createRequire } from "module";
import { GoogleGenAI } from "@google/genai";
import * as XLSX from "xlsx";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export const runtime = "nodejs";

const require = createRequire(import.meta.url);

// =========================================
// (PDF/직접입력용) 텍스트를 일정 길이로 청크 분할
// =========================================
function splitIntoChunks(
  text: string,
  chunkSize = 800,
  overlap = 100,
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
// 파일명을 Supabase Storage 키로 써도 안전하게 정리
// (공백/특수문자 등을 밑줄로 치환)
// =========================================
function sanitizeFileName(name: string): string {
  const lastDotIndex = name.lastIndexOf(".");
  const ext = lastDotIndex !== -1 ? name.slice(lastDotIndex) : "";
  const base = lastDotIndex !== -1 ? name.slice(0, lastDotIndex) : name;

  const safeBase = base
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return `${safeBase || "file"}${ext}`;
}
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

// =========================================
// (Excel용) 시트를 "1행 = 1청크" 자연어 문장으로 변환
// =========================================
function excelToChunks(buffer: Buffer): string[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  });

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((h) => String(h).trim());
  const dataRows = rows.slice(1);

  const chunks: string[] = [];

  dataRows.forEach((row, rowIndex) => {
    const fields: string[] = [];

    headers.forEach((header, colIndex) => {
      const value = row[colIndex];

      if (header && value !== undefined && String(value).trim() !== "") {
        fields.push(`${header}: ${String(value).trim()}`);
      }
    });

    if (fields.length > 0) {
      chunks.push(`${rowIndex + 1}번째 행 — ${fields.join(", ")}`);
    }
  });

  return chunks;
}

export async function POST(req: Request) {
  try {
    // =========================================
    // 0. 관리자 권한 확인
    // =========================================
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "정보 등록은 관리자만 가능합니다." },
        { status: 403 },
      );
    }

    // =========================================
    // 1. FormData 받기
    // =========================================
    const formData = await req.formData();
    const registerType = (formData.get("type") as string | null) || "file";

    const documentId = crypto.randomUUID();

    let fullText = "";
    let chunks: string[] = [];
    let fileName = "";
    let fileSize = 0;
    let storagePath: string | null = null;

    // =========================================
    // 2-A. 직접 입력(텍스트) 등록
    // =========================================
    if (registerType === "text") {
      const title = (formData.get("title") as string | null)?.trim();
      const content = (formData.get("content") as string | null)?.trim();

      if (!title) {
        return NextResponse.json(
          { success: false, error: "제목을 입력해주세요." },
          { status: 400 },
        );
      }

      if (!content) {
        return NextResponse.json(
          { success: false, error: "내용을 입력해주세요." },
          { status: 400 },
        );
      }

      fullText = content;
      chunks = splitIntoChunks(fullText);
      fileName = title;
      fileSize = Buffer.byteLength(content, "utf-8");
      storagePath = null; // 원본 파일이 없음

      if (chunks.length === 0) {
        return NextResponse.json(
          { success: false, error: "등록할 내용이 너무 짧습니다." },
          { status: 400 },
        );
      }
    } else if (registerType === "url") {
      // =========================================
      // 2-C. URL 등록
      // =========================================
      const sourceUrl = (formData.get("url") as string | null)?.trim();

      if (!sourceUrl) {
        return NextResponse.json(
          { success: false, error: "URL을 입력해주세요." },
          { status: 400 },
        );
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(sourceUrl);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("invalid protocol");
        }
      } catch {
        return NextResponse.json(
          { success: false, error: "올바른 URL 형식이 아닙니다." },
          { status: 400 },
        );
      }

      let pageResponse: Response;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        pageResponse = await fetch(sourceUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; InternalKnowledgeBot/1.0)",
          },
          signal: controller.signal,
          redirect: "follow",
        });

        clearTimeout(timeout);
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: "페이지에 접속하지 못했습니다. URL을 다시 확인해주세요.",
          },
          { status: 400 },
        );
      }

      if (!pageResponse.ok) {
        return NextResponse.json(
          {
            success: false,
            error: `페이지를 가져오지 못했습니다. (상태 코드: ${pageResponse.status})`,
          },
          { status: 400 },
        );
      }

      // =========================================
      // 인코딩(charset) 감지 후 올바르게 디코딩
      // (일부 공공/구형 사이트는 UTF-8이 아니라 EUC-KR/CP949를 씀)
      // =========================================
      const buffer = Buffer.from(await pageResponse.arrayBuffer());

      const responseContentType =
        pageResponse.headers.get("content-type") || "";
      const charsetMatch = responseContentType.match(/charset=([^;]+)/i);
      let detectedCharset = charsetMatch?.[1]?.trim().toLowerCase();

      if (!detectedCharset) {
        const preview = buffer.toString("utf-8", 0, 1000);
        const metaMatch = preview.match(/charset=["']?([a-zA-Z0-9-]+)/i);
        detectedCharset = metaMatch?.[1]?.toLowerCase();
      }

      const iconv = require("iconv-lite");

      const html =
        detectedCharset &&
        !detectedCharset.includes("utf-8") &&
        !detectedCharset.includes("utf8")
          ? iconv.decode(buffer, detectedCharset)
          : buffer.toString("utf-8");

      let extractedTitle = sourceUrl;
      let extractedText = "";

      try {
        const dom = new JSDOM(html, { url: sourceUrl });
        const article = new Readability(dom.window.document).parse();

        if (article?.textContent) {
          extractedText = article.textContent.trim();
          extractedTitle = article.title || sourceUrl;
        }
      } catch {
        // 아래 폴백 처리로 이어짐
      }

      if (!extractedText || extractedText.length < 50) {
        return NextResponse.json(
          {
            success: false,
            error:
              "페이지에서 본문 내용을 추출하지 못했습니다. 로그인이 필요하거나, 자바스크립트로 렌더링되는 페이지일 수 있습니다.",
          },
          { status: 400 },
        );
      }

      fullText = extractedText;
      chunks = splitIntoChunks(fullText);
      fileName = extractedTitle;
      fileSize = Buffer.byteLength(extractedText, "utf-8");
      storagePath = null;

      if (chunks.length === 0) {
        return NextResponse.json(
          { success: false, error: "등록할 내용이 너무 짧습니다." },
          { status: 400 },
        );
      }
    } else {
      // =========================================
      // 2-B. 파일(PDF/Excel) 업로드
      // =========================================
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: "파일이 없습니다." },
          { status: 400 },
        );
      }

      const lowerName = file.name.toLowerCase();
      const isPdf =
        file.type === "application/pdf" || lowerName.endsWith(".pdf");
      const isExcel =
        lowerName.endsWith(".xlsx") ||
        lowerName.endsWith(".xls") ||
        lowerName.endsWith(".csv");

      if (!isPdf && !isExcel) {
        return NextResponse.json(
          {
            success: false,
            error:
              "PDF 또는 Excel(.xlsx, .xls, .csv) 파일만 업로드할 수 있습니다.",
          },
          { status: 400 },
        );
      }

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return NextResponse.json(
          { success: false, error: "파일 크기는 10MB 이하만 가능합니다." },
          { status: 400 },
        );
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      fileName = file.name;
      fileSize = file.size;

      // 확장자만 추출해서, 저장 경로는 documentId + 확장자로만 구성
      // (한글/특수문자 파일명이 Storage key로 쓰일 때 생기는 오류를 원천 차단)
      const lastDotIndex = file.name.lastIndexOf(".");
      const ext = lastDotIndex !== -1 ? file.name.slice(lastDotIndex) : "";

      storagePath = `${documentId}/file${ext}`;

      if (isPdf) {
        const { PDFParse } = require("pdf-parse");
        const { CanvasFactory } = require("pdf-parse/worker");
        const parser = new PDFParse({ data: buffer, CanvasFactory });
        const parsed = await parser.getText();
        await parser.destroy();

        fullText = parsed.text || "";

        if (!fullText.trim()) {
          return NextResponse.json(
            { success: false, error: "PDF에서 텍스트를 추출하지 못했습니다." },
            { status: 400 },
          );
        }

        chunks = splitIntoChunks(fullText);
      } else {
        chunks = excelToChunks(buffer);

        if (chunks.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Excel 파일에서 데이터를 추출하지 못했습니다. 첫 행이 헤더인지 확인해주세요.",
            },
            { status: 400 },
          );
        }

        fullText = chunks.join("\n");
      }

      // 원본 파일 Storage 업로드
      const contentType = isPdf
        ? "application/pdf"
        : file.type ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      const { error: storageError } = await supabaseAdmin.storage
        .from("documents")
        .upload(storagePath, buffer, {
          contentType,
          upsert: false,
        });

      if (storageError) {
        throw new Error(`파일 저장에 실패했습니다: ${storageError.message}`);
      }
    }

    console.log("청크 개수:", chunks.length);

    // =========================================
    // 3. Gemini 임베딩 생성 (배치)
    // =========================================
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY가 설정되지 않았습니다." },
        { status: 500 },
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

    console.log("임베딩 생성 완료");

    // =========================================
    // 4. Supabase에 문서 메타데이터 저장
    // =========================================
    const sourceUrlToSave =
      registerType === "url"
        ? ((formData.get("url") as string | null)?.trim() ?? null)
        : null;

    const { data: documentRow, error: docError } = await supabaseAdmin
      .from("documents")
      .insert({
        id: documentId,
        file_name: fileName,
        file_size: fileSize,
        full_text: fullText,
        chunk_count: chunks.length,
        storage_path: storagePath,
        source_url: sourceUrlToSave,
      })
      .select()
      .single();

    if (docError || !documentRow) {
      throw new Error(docError?.message || "문서 저장에 실패했습니다.");
    }

    // =========================================
    // 5. 청크 + 임베딩 저장
    // =========================================
    const chunkRows = chunks.map((content, index) => ({
      document_id: documentRow.id,
      content,
      chunk_index: index,
      embedding: embeddings[index].values,
    }));

    const { error: chunkError } = await supabaseAdmin
      .from("document_chunks")
      .insert(chunkRows);

    if (chunkError) {
      throw new Error(chunkError.message);
    }

    console.log("문서 및 청크 저장 완료:", documentRow.id);

    // =========================================
    // 6. 결과 반환
    // =========================================
    return NextResponse.json({
      success: true,
      document: {
        id: documentRow.id,
        fileName: documentRow.file_name,
        fileSize: documentRow.file_size,
        chunkCount: documentRow.chunk_count,
        createdAt: documentRow.created_at,
        textPreview: fullText.slice(0, 3000),
      },
      message: "정보 등록이 완료되었습니다.",
    });
  } catch (error) {
    console.error("Document Register Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "정보 등록 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}

// =========================================
// GET: 등록된 문서 목록 조회
// =========================================
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("id, file_name, file_size, chunk_count, created_at, storage_path")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const documents = (data || []).map((doc) => ({
      id: doc.id,
      file_name: doc.file_name,
      file_size: doc.file_size,
      chunk_count: doc.chunk_count,
      created_at: doc.created_at,
      hasFile: !!doc.storage_path,
    }));

    return NextResponse.json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error("Document List Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "문서 목록을 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

import fs from "node:fs/promises";
import pdf from "pdf-parse";
import { ocrPdfToText } from "./ocr.js";

function normalizeText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLines(text) {
  return normalizeText(text)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function sliceAroundCurriculum(lines) {
  const idx = lines.findIndex((l) => /교과\s*학습\s*발달\s*상황|교과학습발달상황/.test(l));
  if (idx === -1) return { lines, warnings: ["'교과학습발달상황' 섹션 키워드를 찾지 못해 전체 텍스트에서 파싱을 시도합니다."] };
  return { lines: lines.slice(idx, Math.min(lines.length, idx + 1500)), warnings: [] };
}

function toInt(v) {
  const n = Number(String(v).replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseRowFromTokens(tokens) {
  // 기대 형태 (대략): 학년 학기 교과군 과목 단위 석차등급 석차 수강인원
  if (tokens.length < 8) return null;
  const grade = toInt(tokens[0]);
  const term = toInt(tokens[1]);
  const subjectGroup = tokens[2];
  const subject = tokens[3];
  const credit = toInt(tokens[4]);
  const rankGrade = toInt(tokens[5]);
  const rank = toInt(tokens[6]);
  const studentCount = toInt(tokens[7]);
  if (![grade, term, credit, rankGrade, rank, studentCount].every((x) => typeof x === "number")) return null;
  return { grade, term, subjectGroup, subject, credit, rankGrade, rank, studentCount };
}

function parseCurriculumFromLines(lines) {
  const warnings = [];
  const rows = [];

  let currentGrade = null;
  let currentTerm = null;

  for (const line of lines) {
    // 학년/학기 컨텍스트 추정 (OCR이 "1 | 2학기"를 "1 | 28"처럼 찍는 경우가 있음)
    {
      const mCtx =
        line.match(/(\d)\s*[|ㅣ]\s*(\d)\s*학기/) ??
        line.match(/(\d)\s*[|ㅣ]\s*(\d+)\b/);
      if (mCtx) {
        const g = toInt(mCtx[1]);
        let t = toInt(mCtx[2]);
        // OCR 보정: "2학기"가 "28"처럼 인식되는 경우 첫 자리로 복원
        if (t && t > 2) {
          const raw = String(mCtx[2]).trim();
          const first = toInt(raw[0]);
          if (first && (first === 1 || first === 2)) t = first;
        }

        if (g && t && t >= 1 && t <= 2) {
          currentGrade = g;
          currentTerm = t;
          continue;
        }
      }
    }

    // 케이스1: "1 1 수학 수학Ⅰ 4 2 15/220"
    const m = line.match(
      /^(\d)\s+(\d)\s+(.+?)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s*[\/]\s*(\d+)\s*$/,
    );
    if (m) {
      const row = {
        grade: toInt(m[1]),
        term: toInt(m[2]),
        subjectGroup: m[3].trim(),
        subject: m[4].trim(),
        credit: toInt(m[5]),
        rankGrade: toInt(m[6]),
        rank: toInt(m[7]),
        studentCount: toInt(m[8]),
      };
      if (Object.values(row).every((v) => v !== null)) rows.push(row);
      continue;
    }

    // 케이스1-2 (OCR 스캔형 생기부): "국어 국어 3 87/76.9(12.0) B(38) 4"
    // - grade/term이 표 위에 별도로 있고, 행에는 보통 없음
    // - 수강자수는 성취도 토큰의 괄호값(B(38))에서 추출 가능
    const tokens1 = line.split(/\s+/).map((t) => t.trim()).filter(Boolean);
    if (tokens1.length >= 5) {
      const scoreTokenRe = /^\d+\s*\/\s*[\d.]+\s*\([\d.]+\)\s*$/;
      // scoreToken이 공백 없이 붙어야 하므로 먼저 공백 제거 버전도 체크
      const scoreTokenRe2 = /^\d+\/[\d.]+\([\d.]+\)$/;
      let creditIdx = -1;
      for (let i = 0; i < tokens1.length - 1; i += 1) {
        if (toInt(tokens1[i]) && (scoreTokenRe.test(tokens1[i + 1]) || scoreTokenRe2.test(tokens1[i + 1]))) {
          creditIdx = i;
          break;
        }
      }

      if (creditIdx !== -1) {
        const credit = toInt(tokens1[creditIdx]);
        let before = tokens1.slice(0, creditIdx);
        if (credit && before.length >= 1) {
          // OCR 잡음 제거: 앞쪽 숫자/기호 토큰 제거 후 첫 한글 토큰부터 사용
          while (before.length > 0 && !/[가-힣]/.test(before[0])) before = before.slice(1);
          if (before.length === 0) continue;

          const subjectGroup = before[0];
          const subject = before.length >= 2 ? before.slice(1).join(" ") : before[0];
          const achToken = tokens1[creditIdx + 2] ?? "";
          const mAch = achToken.match(/^([A-E])\((\d+)\)$/i);
          // (수강자수) 추출: 성취도 토큰(A(38)) 뿐 아니라 라인 전체에서 마지막 괄호 숫자를 사용
          const parenNums = [...line.matchAll(/\((\d{2,4})\)/g)].map((x) => toInt(x[1])).filter((x) => x != null);
          const studentCount = (mAch ? toInt(mAch[2]) : null) ?? (parenNums.length ? parenNums[parenNums.length - 1] : null);

          // 석차등급 추출: 마지막 토큰이 깨져도 라인 끝쪽의 1~9를 탐색
          const mRankGrade = line.match(/(\b[1-9]\b)\s*$/) ?? line.match(/([1-9])\s*$/);
          const rankGrade = mRankGrade ? toInt(mRankGrade[1]) : null;

          // 석차/석차백분위 계산에 필요한 rank는 이 표에 없을 수 있음
          rows.push({
            grade: currentGrade ?? 0,
            term: currentTerm ?? 0,
            subjectGroup,
            subject,
            credit,
            rankGrade: rankGrade ?? 0,
            rank: null,
            studentCount,
          });
          continue;
        }
      }
    }

    // 케이스2: 탭/복수 공백으로 분리된 표
    const tokens = line.split(/\s{2,}|\t+/).map((t) => t.trim()).filter(Boolean);
    const row = parseRowFromTokens(tokens);
    if (row) {
      rows.push(row);
      continue;
    }
  }

  // 학년/학기 컨텍스트가 뒤에서 잡히는 경우(첫 행 등) 0값을 백필
  {
    const pendingIdx = [];
    let last = null; // {grade, term}
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      const okGrade = typeof r.grade === "number" && r.grade > 0;
      const okTerm = typeof r.term === "number" && r.term > 0;
      if (okGrade && okTerm) {
        last = { grade: r.grade, term: r.term };
        if (pendingIdx.length) {
          for (const j of pendingIdx) {
            rows[j] = { ...rows[j], grade: last.grade, term: last.term };
          }
          pendingIdx.length = 0;
        }
        continue;
      }
      if (!last) pendingIdx.push(i);
      else rows[i] = { ...r, grade: last.grade, term: last.term };
    }
  }

  if (rows.length === 0) {
    warnings.push("교과 행을 1건도 추출하지 못했습니다. PDF 텍스트 추출 결과(줄바꿈/공백)가 표 형태와 맞지 않을 수 있습니다.");
  }

  // OCR 케이스에서 학년/학기가 못 잡히면 0으로 들어갈 수 있어 경고
  if (rows.some((r) => r.grade === 0 || r.term === 0)) {
    warnings.push("일부 행의 학년/학기 정보를 추정하지 못했습니다(0으로 저장). OCR 텍스트에서 '1|1학기' 같은 표기 인식이 필요할 수 있습니다.");
  }

  if (rows.some((r) => r.rank == null)) {
    warnings.push("일부(또는 전체) 행에서 석차(rank)를 추출하지 못했습니다. 이 양식은 석차 대신 성취도/석차등급 중심일 수 있어 percentile은 null이 될 수 있습니다.");
  }

  return { curriculum: rows, warnings };
}

export async function parsePdfCurriculum(pdfPath) {
  const buf = await fs.readFile(pdfPath);
  const parsed = await pdf(buf);
  let text = parsed.text || "";

  const warnings = [];
  const hangulCount = (text.match(/[가-힣]/g) || []).length;
  const hasUsefulText = text.trim().length >= 300 && hangulCount >= 30;
  if (!hasUsefulText) {
    warnings.push("PDF 텍스트 레이어가 거의 없어 OCR로 텍스트를 생성합니다. (시간이 걸릴 수 있음)");
    // OCR로 '교과학습발달상황'이 있는 페이지 주변만 우선 인식
    text = await ocrPdfToText(pdfPath, {
      maxPages: 30,
      lang: "kor+eng",
      keyword: /교과\s*학습\s*발달\s*상황|교과학습발달상황/,
    });
  }

  const lines = splitLines(text);

  const { lines: scopedLines, warnings: scopeWarnings } = sliceAroundCurriculum(lines);
  const parsedRows = parseCurriculumFromLines(scopedLines);

  return {
    curriculum: parsedRows.curriculum,
    warnings: [...warnings, ...scopeWarnings, ...parsedRows.warnings],
  };
}


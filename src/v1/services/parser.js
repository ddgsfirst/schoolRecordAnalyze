import fs from "node:fs/promises";
import pdf from "pdf-parse";
import { ocrPdfToText } from "./ocr.js";

function normalizeText(text) {
  return String(text || "")
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
    .filter(Boolean);
}

function toInt(v) {
  const n = Number(String(v).replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseCurriculumFromLines(lines) {
  const warnings = [];
  const rows = [];

  let currentGrade = null;
  let currentTerm = null;

  function updateContextFromLine(line) {
    const compact = line.replace(/\s+/g, "");

    // Grade + term in one line.
    let m = compact.match(/([1-3])학년([12])학기/);
    if (m) {
      currentGrade = toInt(m[1]);
      currentTerm = toInt(m[2]);
      return true;
    }

    // Grade + term with separators.
    m = compact.match(/([1-3])[|/:]([12])학기?/);
    if (m) {
      currentGrade = toInt(m[1]);
      currentTerm = toInt(m[2]);
      return true;
    }

    // OCR fallback: "1|18" / "1|28" -> semester inferred from first digit.
    m = compact.match(/([1-3])[|/:](\d{2,})/);
    if (m) {
      const g = toInt(m[1]);
      const d = String(m[2]);
      const t = toInt(d[0]);
      if (g && (t === 1 || t === 2)) {
        currentGrade = g;
        currentTerm = t;
        return true;
      }
    }

    // Grade-only context line, e.g. "2학년".
    m = compact.match(/^([1-3])학년$/);
    if (m) {
      currentGrade = toInt(m[1]);
      return true;
    }

    // OCR fallback for grade-only labels like "2 학년" merged with symbols.
    m = compact.match(/([1-3])학년/);
    if (m) {
      currentGrade = toInt(m[1]);
    }

    // Term-only context line, e.g. "1학기"/"2학기".
    m = compact.match(/([12])학기/);
    if (m && currentGrade != null) {
      currentTerm = toInt(m[1]);
      return true;
    }

    return false;
  }

  for (const line of lines) {
    updateContextFromLine(line);

    // Pattern A: explicit row with grade/term.
    const m = line.match(
      /^([1-3])\s+([12])\s+(.+?)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s*\/\s*(\d+)\s*$/,
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

    // Pattern B: OCR style row without explicit rank.
    // Example: "국어 국어 3 87/76.9(12.0) B(38) 4"
    const tokens = line.split(/\s+/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length >= 5) {
      let creditIdx = -1;
      for (let i = 0; i < tokens.length - 1; i += 1) {
        const isCredit = toInt(tokens[i]) != null;
        const isScoreToken = /^\d+\/[\d.]+(?:\([\d.]+\))?$/.test(tokens[i + 1]);
        if (isCredit && isScoreToken) {
          creditIdx = i;
          break;
        }
      }

      if (creditIdx !== -1) {
        const credit = toInt(tokens[creditIdx]);
        let nameTokens = tokens.slice(0, creditIdx);
        while (nameTokens.length > 0 && !/[A-Za-z가-힣]/.test(nameTokens[0])) {
          nameTokens = nameTokens.slice(1);
        }

        if (credit && nameTokens.length > 0) {
          const subjectGroup = nameTokens[0];
          const subject = nameTokens.length >= 2 ? nameTokens.slice(1).join(" ") : nameTokens[0];

          const achToken = tokens[creditIdx + 2] ?? "";
          const mAch = achToken.match(/^([A-E])\((\d+)\)$/i);
          const parenNums = [...line.matchAll(/\((\d{2,4})\)/g)]
            .map((x) => toInt(x[1]))
            .filter((x) => x != null);
          const studentCount =
            (mAch ? toInt(mAch[2]) : null) ??
            (parenNums.length ? parenNums[parenNums.length - 1] : null);

          const mRankGrade = line.match(/([1-9])\s*$/);
          const rankGrade = mRankGrade ? toInt(mRankGrade[1]) : 0;

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

    // Pattern C: wide-space/tab tokenized table row.
    const wide = line.split(/\s{2,}|\t+/).map((t) => t.trim()).filter(Boolean);
    if (wide.length >= 8) {
      const row = {
        grade: toInt(wide[0]),
        term: toInt(wide[1]),
        subjectGroup: wide[2],
        subject: wide[3],
        credit: toInt(wide[4]),
        rankGrade: toInt(wide[5]),
        rank: toInt(wide[6]),
        studentCount: toInt(wide[7]),
      };
      if (
        typeof row.grade === "number" &&
        typeof row.term === "number" &&
        typeof row.credit === "number" &&
        typeof row.rankGrade === "number" &&
        typeof row.rank === "number" &&
        typeof row.studentCount === "number"
      ) {
        rows.push(row);
      }
    }
  }

  // Backfill missing grade/term from nearest previous known context.
  {
    let last = null;
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      const ok = r.grade > 0 && r.term > 0;
      if (ok) {
        last = { grade: r.grade, term: r.term };
        continue;
      }
      if (last) rows[i] = { ...r, grade: last.grade, term: last.term };
    }
  }

  if (rows.length === 0) {
    warnings.push("No curriculum rows were extracted from the document.");
  }
  const gradeSet = new Set(rows.map((r) => r.grade).filter((g) => g > 0));
  if (gradeSet.size > 0 && gradeSet.size < 3) {
    warnings.push("Only partial grades were extracted (not all of grade 1/2/3 were found).");
  }
  if (rows.some((r) => r.grade === 0 || r.term === 0)) {
    warnings.push("Some rows are missing grade/term context after OCR parsing.");
  }
  if (rows.some((r) => r.rank == null)) {
    warnings.push("Some rows are missing rank; percentile may be approximated from rank grade.");
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
    warnings.push("PDF text layer is weak; OCR fallback is used.");
    text = await ocrPdfToText(pdfPath, { lang: "kor+eng" });
  }

  const lines = splitLines(text);
  const parsedRows = parseCurriculumFromLines(lines);

  return {
    curriculum: parsedRows.curriculum,
    warnings: [...warnings, ...parsedRows.warnings],
  };
}

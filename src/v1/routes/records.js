import express from "express";
import multer from "multer";
import path from "node:path";
import { nanoid } from "nanoid";
import { asyncHandler, httpError, ok } from "../lib/http.js";
import { ensureUploadDir } from "../storage/uploads.js";
import { getRecord, listCurriculum, upsertRecord } from "../storage/db.js";
import { parsePdfCurriculum } from "../services/parser.js";
import {
  calculateSubjectScores,
  calculateSubjectGroupScores,
  calculateTrends,
} from "../services/scoring.js";

export const recordsRouter = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        const dir = await ensureUploadDir();
        cb(null, dir);
      } catch (e) {
        cb(e);
      }
    },
    filename: (req, file, cb) => {
      const recordId = req.recordId;
      const ext = path.extname(file.originalname || ".pdf") || ".pdf";
      cb(null, `${recordId}${ext}`);
    },
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
});

recordsRouter.post(
  "/",
  (req, _res, next) => {
    req.recordId = `rec_${nanoid(10)}`;
    next();
  },
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw httpError(400, "file is required");

    const studentId = typeof req.body?.studentId === "string" ? req.body.studentId : null;
    const recordId = req.recordId;

    await upsertRecord(recordId, {
      recordId,
      studentId,
      status: "uploaded",
      uploadedAt: new Date().toISOString(),
      file: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path,
      },
    });

    return ok(res, { recordId, status: "uploaded" });
  }),
);

recordsRouter.post(
  "/:recordId/parse",
  asyncHandler(async (req, res) => {
    const { recordId } = req.params;
    const rec = await getRecord(recordId);
    if (!rec) throw httpError(404, "record not found");
    if (!rec.file?.path) throw httpError(400, "record file not found");

    let curriculum;
    let warnings;
    try {
      ({ curriculum, warnings } = await parsePdfCurriculum(rec.file.path));
    } catch (e) {
      throw httpError(
        400,
        `failed to parse PDF (invalid PDF or unsupported layout): ${e?.message ?? "unknown error"}`,
      );
    }

    await upsertRecord(recordId, {
      status: "parsed",
      parsedAt: new Date().toISOString(),
      curriculum,
      parseWarnings: warnings,
    });

    return ok(res, { status: "parsed" });
  }),
);

recordsRouter.get(
  "/:recordId/curriculum",
  asyncHandler(async (req, res) => {
    const { recordId } = req.params;
    const curriculum = await listCurriculum(recordId);
    if (!curriculum) throw httpError(404, "curriculum not found (parse first)");
    return ok(res, curriculum);
  }),
);

recordsRouter.post(
  "/:recordId/calculate",
  asyncHandler(async (req, res) => {
    const { recordId } = req.params;
    const curriculum = await listCurriculum(recordId);
    if (!curriculum) throw httpError(404, "curriculum not found (parse first)");
    return ok(res, calculateSubjectScores(curriculum));
  }),
);

recordsRouter.get(
  "/:recordId/subject-group",
  asyncHandler(async (req, res) => {
    const { recordId } = req.params;
    const curriculum = await listCurriculum(recordId);
    if (!curriculum) throw httpError(404, "curriculum not found (parse first)");
    return ok(res, calculateSubjectGroupScores(calculateSubjectScores(curriculum)));
  }),
);

recordsRouter.get(
  "/:recordId/trend",
  asyncHandler(async (req, res) => {
    const { recordId } = req.params;
    const curriculum = await listCurriculum(recordId);
    if (!curriculum) throw httpError(404, "curriculum not found (parse first)");
    const subjectScores = calculateSubjectScores(curriculum);
    return ok(res, calculateTrends(subjectScores));
  }),
);


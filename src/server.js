import express from "express";
import { apiV1Router } from "./v1/router.js";
import swaggerUi from "swagger-ui-express";
import { buildOpenApiSpec } from "./openapi.js";

const app = express();

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const openApiSpec = buildOpenApiSpec();
app.get("/openapi.json", (_req, res) => res.json(openApiSpec));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, { explorer: true }));

app.use("/api/v1", apiV1Router);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const code = typeof err?.statusCode === "number" ? err.statusCode : 500;
  const message = err?.message || "Internal Server Error";
  res.status(code).json({
    success: false,
    error: { code, message },
  });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  // Intentionally minimal startup log
  console.log(`API listening on http://localhost:${port}`);
});


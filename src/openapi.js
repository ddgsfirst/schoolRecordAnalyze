import swaggerJSDoc from "swagger-jsdoc";

export function buildOpenApiSpec() {
  return swaggerJSDoc({
    definition: {
      openapi: "3.0.3",
      info: {
        title: "Student Record Analysis API",
        version: "1.0.0",
        description:
          "생기부(PDF)를 업로드하고 교과학습발달상황 데이터를 추출하여 점수/교과군/성장 분석을 제공하는 API",
      },
      servers: [{ url: "/" }],
      components: {
        schemas: {
          ApiSuccess: {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {},
            },
            required: ["success", "data"],
          },
          ApiError: {
            type: "object",
            properties: {
              success: { type: "boolean", example: false },
              error: {
                type: "object",
                properties: {
                  code: { type: "integer", example: 400 },
                  message: { type: "string", example: "Invalid request" },
                },
                required: ["code", "message"],
              },
            },
            required: ["success", "error"],
          },
          UploadResponse: {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  recordId: { type: "string", example: "rec_001" },
                  status: { type: "string", example: "uploaded" },
                },
                required: ["recordId", "status"],
              },
            },
          },
          ParseResponse: {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  status: { type: "string", example: "parsed" },
                },
                required: ["status"],
              },
            },
          },
          CurriculumRow: {
            type: "object",
            properties: {
              grade: { type: "integer", example: 1 },
              term: { type: "integer", example: 1 },
              subjectGroup: { type: "string", example: "수학" },
              subject: { type: "string", example: "수학Ⅰ" },
              credit: { type: "integer", example: 4 },
              rankGrade: { type: "integer", nullable: true, example: 2 },
              rank: { type: "integer", nullable: true, example: 15 },
              studentCount: { type: "integer", nullable: true, example: 220 },
            },
            required: ["grade", "term", "subjectGroup", "subject", "credit"],
          },
          CalculateRow: {
            type: "object",
            properties: {
              grade: { type: "integer", example: 1 },
              term: { type: "integer", example: 1 },
              subjectGroup: { type: "string", example: "수학" },
              subject: { type: "string", example: "수학Ⅰ" },
              credit: { type: "integer", example: 4 },
              rankGrade: { type: "integer", nullable: true, example: 2 },
              rank: { type: "integer", nullable: true, example: 15 },
              studentCount: { type: "integer", nullable: true, example: 220 },
              gradeScore: { type: "number", nullable: true, example: 88.9 },
              percentile: { type: "number", nullable: true, example: 93.2 },
              finalScore: { type: "number", nullable: true, example: 91.4 },
            },
            required: ["subject", "credit"],
          },
          SubjectGroupScore: {
            type: "object",
            properties: {
              subjectGroup: { type: "string", example: "수학" },
              groupScore: { type: "number", nullable: true, example: 89.7 },
            },
            required: ["subjectGroup", "groupScore"],
          },
          TrendRow: {
            type: "object",
            properties: {
              subject: { type: "string", example: "수학Ⅰ" },
              previousPercentile: { type: "number", example: 82.1 },
              currentPercentile: { type: "number", example: 90.4 },
              trend: { type: "string", enum: ["상승", "유지", "하락"], example: "상승" },
            },
            required: ["subject", "previousPercentile", "currentPercentile", "trend"],
          },
        },
      },
      paths: {
        "/api/v1/records": {
          post: {
            summary: "생기부 업로드",
            description: "생기부 파일(PDF 등)을 업로드하고 recordId를 생성합니다.",
            requestBody: {
              required: true,
              content: {
                "multipart/form-data": {
                  schema: {
                    type: "object",
                    properties: {
                      file: { type: "string", format: "binary" },
                      studentId: { type: "string" },
                    },
                    required: ["file"],
                  },
                },
              },
            },
            responses: {
              200: {
                description: "OK",
                content: { "application/json": { schema: { $ref: "#/components/schemas/UploadResponse" } } },
              },
              400: { description: "Bad Request", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
              500: { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
            },
          },
        },
        "/api/v1/records/{recordId}/parse": {
          post: {
            summary: "교과학습발달상황 파싱",
            parameters: [
              {
                name: "recordId",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              200: {
                description: "OK",
                content: { "application/json": { schema: { $ref: "#/components/schemas/ParseResponse" } } },
              },
              400: { description: "Bad Request", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
              404: { description: "Not Found", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
              500: { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
            },
          },
        },
        "/api/v1/records/{recordId}/curriculum": {
          get: {
            summary: "교과 데이터 조회",
            parameters: [
              { name: "recordId", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: {
              200: {
                description: "OK",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        success: { type: "boolean", example: true },
                        data: { type: "array", items: { $ref: "#/components/schemas/CurriculumRow" } },
                      },
                      required: ["success", "data"],
                    },
                  },
                },
              },
              404: { description: "Not Found", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
              500: { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
            },
          },
        },
        "/api/v1/records/{recordId}/calculate": {
          post: {
            summary: "교과목 점수 계산",
            parameters: [
              { name: "recordId", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: {
              200: {
                description: "OK",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        success: { type: "boolean", example: true },
                        data: { type: "array", items: { $ref: "#/components/schemas/CalculateRow" } },
                      },
                      required: ["success", "data"],
                    },
                  },
                },
              },
              404: { description: "Not Found", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
              500: { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
            },
          },
        },
        "/api/v1/records/{recordId}/subject-group": {
          get: {
            summary: "교과군 단위 분석",
            parameters: [
              { name: "recordId", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: {
              200: {
                description: "OK",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        success: { type: "boolean", example: true },
                        data: { type: "array", items: { $ref: "#/components/schemas/SubjectGroupScore" } },
                      },
                      required: ["success", "data"],
                    },
                  },
                },
              },
              404: { description: "Not Found", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
              500: { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
            },
          },
        },
        "/api/v1/records/{recordId}/trend": {
          get: {
            summary: "학기별 성장 분석",
            parameters: [
              { name: "recordId", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: {
              200: {
                description: "OK",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        success: { type: "boolean", example: true },
                        data: { type: "array", items: { $ref: "#/components/schemas/TrendRow" } },
                      },
                      required: ["success", "data"],
                    },
                  },
                },
              },
              404: { description: "Not Found", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
              500: { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
            },
          },
        },
      },
    },
    apis: [],
  });
}


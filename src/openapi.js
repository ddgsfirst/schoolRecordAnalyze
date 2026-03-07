import swaggerJSDoc from "swagger-jsdoc";

export function buildOpenApiSpec() {
  return swaggerJSDoc({
    definition: {
      openapi: "3.0.3",
      info: {
        title: "Student Record Analysis API",
        version: "1.0.0",
        description:
          "Upload student-record PDFs, parse curriculum rows, and return score analytics.",
      },
      servers: [{ url: "/" }],
      components: {
        schemas: {
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
            required: ["success", "data"],
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
            required: ["success", "data"],
          },
          CurriculumRow: {
            type: "object",
            properties: {
              grade: { type: "integer", example: 1 },
              term: { type: "integer", example: 1 },
              subjectGroup: { type: "string", example: "Math" },
              subject: { type: "string", example: "Math I" },
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
              subjectGroup: { type: "string", example: "Math" },
              subject: { type: "string", example: "Math I" },
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
              subjectGroup: { type: "string", example: "Math" },
              groupScore: { type: "number", nullable: true, example: 89.7 },
            },
            required: ["subjectGroup", "groupScore"],
          },
          TrendRow: {
            type: "object",
            properties: {
              subject: { type: "string", example: "Math I" },
              previousPercentile: { type: "number", example: 82.1 },
              currentPercentile: { type: "number", example: 90.4 },
              trend: { type: "string", example: "유지" },
            },
            required: ["subject", "previousPercentile", "currentPercentile", "trend"],
          },
          AnalysisResponse: {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  recordId: { type: "string", example: "rec_001" },
                  status: { type: "string", nullable: true, example: "parsed" },
                  parseWarnings: { type: "array", items: { type: "string" } },
                  byYearTerm: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        grade: { type: "integer", example: 1 },
                        term: { type: "integer", example: 1 },
                        curriculum: { type: "array", items: { $ref: "#/components/schemas/CurriculumRow" } },
                        subjectScores: { type: "array", items: { $ref: "#/components/schemas/CalculateRow" } },
                        subjectGroupScores: { type: "array", items: { $ref: "#/components/schemas/SubjectGroupScore" } },
                      },
                      required: ["grade", "term", "curriculum", "subjectScores", "subjectGroupScores"],
                    },
                  },
                  curriculum: { type: "array", items: { $ref: "#/components/schemas/CurriculumRow" } },
                  subjectScores: { type: "array", items: { $ref: "#/components/schemas/CalculateRow" } },
                  subjectGroupScores: { type: "array", items: { $ref: "#/components/schemas/SubjectGroupScore" } },
                  trends: { type: "array", items: { $ref: "#/components/schemas/TrendRow" } },
                },
                required: [
                  "recordId",
                  "status",
                  "parseWarnings",
                  "byYearTerm",
                  "curriculum",
                  "subjectScores",
                  "subjectGroupScores",
                  "trends",
                ],
              },
            },
            required: ["success", "data"],
          },
        },
      },
      paths: {
        "/api/v1/records": {
          post: {
            summary: "Upload student record file",
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
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/UploadResponse" },
                  },
                },
              },
              400: { description: "Bad Request", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
              500: { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
            },
          },
        },
        "/api/v1/records/{recordId}/parse": {
          post: {
            summary: "Parse curriculum from record file",
            parameters: [{ name: "recordId", in: "path", required: true, schema: { type: "string" } }],
            responses: {
              200: {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/ParseResponse" },
                  },
                },
              },
              400: { description: "Bad Request", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
              404: { description: "Not Found", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
              500: { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
            },
          },
        },
        "/api/v1/records/{recordId}/curriculum": {
          get: {
            summary: "Get parsed curriculum rows",
            parameters: [{ name: "recordId", in: "path", required: true, schema: { type: "string" } }],
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
            summary: "Calculate subject scores",
            parameters: [{ name: "recordId", in: "path", required: true, schema: { type: "string" } }],
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
            summary: "Calculate subject-group scores",
            parameters: [{ name: "recordId", in: "path", required: true, schema: { type: "string" } }],
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
            summary: "Calculate term trend",
            parameters: [{ name: "recordId", in: "path", required: true, schema: { type: "string" } }],
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
        "/api/v1/records/{recordId}/analysis": {
          get: {
            summary: "Get consolidated analysis",
            description:
              "Returns curriculum, subject scores, subject-group scores, and trends in one response.",
            parameters: [{ name: "recordId", in: "path", required: true, schema: { type: "string" } }],
            responses: {
              200: {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/AnalysisResponse" },
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

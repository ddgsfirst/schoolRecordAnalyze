import express from "express";
import { recordsRouter } from "./routes/records.js";

export const apiV1Router = express.Router();

apiV1Router.use("/records", recordsRouter);


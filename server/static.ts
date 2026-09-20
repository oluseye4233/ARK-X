import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { injectSeoMetadata, requestPath } from "./seo";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", async (req, res, next) => {
    try {
      const template = await fs.promises.readFile(path.resolve(distPath, "index.html"), "utf-8");
      res.type("html").send(injectSeoMetadata(template, requestPath(req)));
    } catch (error) {
      next(error);
    }
  });
}

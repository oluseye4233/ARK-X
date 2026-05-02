import type { Request, Response, NextFunction, RequestHandler } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const PgStore = connectPgSimple(session);

export function buildSessionMiddleware(): RequestHandler {
  const isProd = process.env.NODE_ENV === "production";
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (isProd) {
      throw new Error("SESSION_SECRET must be set in production. Refusing to start with a default secret.");
    }
    console.warn("[auth] SESSION_SECRET not set — using insecure dev default. Do NOT deploy without setting SESSION_SECRET.");
  }
  const effectiveSecret = secret || "ark-dev-only-secret-DO-NOT-USE-IN-PROD";
  return session({
    store: new PgStore({
      conString: process.env.DATABASE_URL!,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: effectiveSecret,
    name: "ark.sid",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24 * 14,
    },
  });
}

export function currentUserId(req: Request): string | null {
  return req.session?.userId ?? null;
}

export function loginSession(req: Request, userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required." });
  }
  next();
};

export function requireSelf(paramName: string): RequestHandler {
  return (req, res, next) => {
    const sid = req.session?.userId;
    if (!sid) return res.status(401).json({ message: "Authentication required." });
    if (req.params[paramName] !== sid) {
      return res.status(403).json({ message: "Forbidden — you may only access your own resources." });
    }
    next();
  };
}

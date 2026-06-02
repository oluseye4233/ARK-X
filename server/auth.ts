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

export const requireInstructor: RequestHandler = async (req, res, next) => {
  const sid = req.session?.userId;
  if (!sid) return res.status(401).json({ message: "Authentication required." });
  try {
    const { storage } = await import("./storage");
    const { isInstructor } = await import("@shared/schema");
    const u = await storage.getUser(sid);
    if (!u || !isInstructor(u.role)) {
      return res.status(403).json({ message: "Instructor role required." });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: "Role check failed." });
  }
};

// Institution-admin gate for the workforce / HR-connector surface (Task #25).
// An institution admin is an ENTERPRISE-plan user with a non-empty institution
// on their profile. Fails CLOSED: missing session → 401; not ENTERPRISE or no
// institution → 403. On success the resolved institution is stashed on the
// request so routes derive scope from the session, never from the client.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      institutionScope?: string;
    }
  }
}

export const requireInstitutionAdmin: RequestHandler = async (req, res, next) => {
  const sid = req.session?.userId;
  if (!sid) return res.status(401).json({ message: "Authentication required." });
  try {
    const { storage } = await import("./storage");
    const u = await storage.getUser(sid);
    if (!u || u.subscriptionPlan !== "ENTERPRISE") {
      return res.status(403).json({ message: "Institution admin (ENTERPRISE plan) required." });
    }
    const institution = (u.institution ?? "").trim();
    if (!institution) {
      return res.status(403).json({ message: "No institution on your profile — workforce tools unavailable." });
    }
    req.institutionScope = institution;
    next();
  } catch (err) {
    res.status(500).json({ message: "Institution admin check failed." });
  }
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

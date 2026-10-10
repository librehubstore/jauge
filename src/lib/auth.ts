import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendMail } from "./mail";
import { notifyAdmins } from "./notify";
import { hashPassword, isCommonPassword, verifyPassword } from "./password";
import { emailDomainAllowed, getSetting } from "./settings";

function emailFromJwt(token: string) {
  try {
    return String(JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).email ?? "").toLowerCase() || null;
  } catch {
    return null;
  }
}

type U = { id: string; email: string; name: string; locale?: string; status?: string };

/** Statut d'un compte dont l'email vient d'être vérifié (spec 4.1). */
async function statusAfterVerification() {
  return (await getSetting("require_admin_approval")) ? "pending_approval" : "active";
}

async function activateAfterVerification(u: U) {
  const [row] = await db.select({ status: schema.user.status }).from(schema.user).where(eq(schema.user.id, u.id));
  if (row?.status !== "pending_verification") return;
  const status = await statusAfterVerification();
  await db.update(schema.user).set({ status }).where(eq(schema.user.id, u.id));
  if (status === "pending_approval") await notifyAdmins("account_pending_approval", { userId: u.id, email: u.email });
}

export const auth = betterAuth({
  appName: "Jauge",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "user" },
      status: { type: "string", input: false, defaultValue: "pending_verification" },
      locale: { type: "string", input: true, defaultValue: "fr" },
    },
    // Domaines autorisés + Google : email vérifié obligatoire.
    async validateUserInfo({ user, source }) {
      if (source.method === "oauth" && source.oauth?.profile?.email_verified === false) {
        return { error: "EMAIL_NOT_VERIFIED_BY_PROVIDER" };
      }
      if (user.email && !emailDomainAllowed(user.email, await getSetting("allowed_email_domains"))) {
        return { error: "SIGNUP_NOT_ALLOWED", errorDescription: "Inscription impossible avec cette adresse." };
      }
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: false,
    resetPasswordTokenExpiresIn: 3600,
    revokeSessionsOnPasswordReset: true,
    password: { hash: hashPassword, verify: verifyPassword },
    async sendResetPassword({ user, url }) {
      await sendMail("reset", { email: user.email, name: user.name, locale: (user as U).locale ?? "fr" }, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,
    expiresIn: 24 * 3600,
    async sendVerificationEmail({ user, url }) {
      await sendMail("verify", { email: user.email, name: user.name, locale: (user as U).locale ?? "fr" }, url);
    },
    async afterEmailVerification(user) {
      await activateAfterVerification(user as U);
    },
  },
  socialProviders: process.env.GOOGLE_CLIENT_ID ? {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  } : undefined,
  account: {
    // Rattachement Google ↔ compte existant seulement si ce compte a déjà vérifié son email.
    accountLinking: { enabled: true, trustedProviders: ["google"], requireLocalEmailVerified: true },
  },
  session: { expiresIn: 30 * 86400, updateAge: 86400 },
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-up/email": { window: 3600, max: 5 },
      "/send-verification-email": { window: 3600, max: 3 },
      "/request-password-reset": { window: 3600, max: 3 },
      // ponytail: limite par IP+route, pas un vrai verrouillage par compte ; suffisant pour 10 échecs / 15 min.
      "/sign-in/email": { window: 900, max: 10 },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Jetons de vérification sans état : un lien déjà utilisé doit afficher une erreur (spec 4.1).
      if (ctx.path === "/verify-email" && typeof ctx.query?.token === "string") {
        ctx.query.callbackURL = "/verify"; // toujours la page d'atterrissage dédiée
        const email = emailFromJwt(ctx.query.token);
        const [u] = email ? await db.select({ v: schema.user.emailVerified }).from(schema.user).where(eq(schema.user.email, email)) : [];
        if (u?.v) throw ctx.redirect("/verify?error=LINK_USED");
      }
      const pw = ctx.path === "/sign-up/email" ? ctx.body?.password : ctx.path === "/reset-password" ? ctx.body?.newPassword : null;
      if (typeof pw === "string" && isCommonPassword(pw)) throw new APIError("BAD_REQUEST", { message: "PASSWORD_TOO_COMMON" });
      if (ctx.path === "/sign-up/email" && !emailDomainAllowed(String(ctx.body?.email ?? ""), await getSetting("allowed_email_domains"))) {
        throw new APIError("FORBIDDEN", { message: "SIGNUP_NOT_ALLOWED" });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          // Contrôle de domaine ici : validateUserInfo n'est pas appelé pour l'inscription email/mot de passe.
          if (!emailDomainAllowed(user.email, await getSetting("allowed_email_domains"))) {
            throw new APIError("FORBIDDEN", { message: "SIGNUP_NOT_ALLOWED" });
          }
          // Compte créé via Google (email déjà vérifié) : pas d'étape de vérification.
          const status = user.emailVerified ? await statusAfterVerification() : "pending_verification";
          return { data: { ...user, status, role: "user" } };
        },
        async after(user) {
          if ((user as U).status === "pending_approval") {
            await notifyAdmins("account_pending_approval", { userId: user.id, email: user.email });
          }
        },
      },
    },
    session: {
      create: {
        // Aucun compte non actif (en attente de validation, désactivé) n'obtient de session.
        async before(session) {
          const [u] = await db.select({ status: schema.user.status }).from(schema.user).where(eq(schema.user.id, session.userId));
          if (u?.status === "pending_approval") throw new APIError("FORBIDDEN", { message: "ACCOUNT_PENDING_APPROVAL" });
          if (u?.status === "disabled") throw new APIError("FORBIDDEN", { message: "ACCOUNT_DISABLED" });
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

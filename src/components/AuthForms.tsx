"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

type AuthErr = { code?: string; message?: string; status?: number } | null;

function useErrorText() {
  const t = useTranslations("auth.errors");
  return (e: AuthErr) => {
    if (!e) return null;
    if (e.status === 429) return t("TOO_MANY_REQUESTS");
    for (const k of [e.code, e.message]) if (k && t.has(k)) return t(k);
    return t("default");
  };
}

const Alert = ({ kind = "error", children }: { kind?: "error" | "info"; children: React.ReactNode }) => (
  <p role={kind === "error" ? "alert" : "status"}
    className={`rounded-md px-3 py-2 text-sm ${kind === "error" ? "bg-danger/10 text-danger" : "bg-accent/10 text-fg"}`}>
    {children}
  </p>
);

function GoogleButton({ enabled }: { enabled: boolean }) {
  const t = useTranslations("auth");
  if (!enabled) return null;
  return (
    <>
      <button type="button" className="btn-ghost w-full"
        onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/", errorCallbackURL: "/login" })}>
        {t("google")}
      </button>
      <p className="my-4 text-center text-xs uppercase tracking-wide text-muted">{t("or")}</p>
    </>
  );
}

export function LoginForm({ google }: { google: boolean }) {
  const t = useTranslations("auth");
  const errText = useErrorText();
  const router = useRouter();
  const params = useSearchParams();
  const [err, setErr] = useState<AuthErr>(params.get("error") ? { code: params.get("error")!.toUpperCase() } : null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null); setInfo(null);
    const f = new FormData(e.currentTarget);
    const { error } = await authClient.signIn.email({ email: String(f.get("email")), password: String(f.get("password")) });
    setBusy(false);
    if (error) return setErr(error);
    const next = params.get("next");
    router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  async function resend() {
    await authClient.sendVerificationEmail({ email, callbackURL: "/verify" });
    setInfo(t("resent"));
  }

  return (
    <>
      <h1 className="mb-5 text-xl font-semibold">{t("signIn")}</h1>
      <GoogleButton enabled={google} />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">{t("email")}</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">{t("password")}</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {err && <Alert>{errText(err)}</Alert>}
        {err?.code === "EMAIL_NOT_VERIFIED" && email && (
          <button type="button" className="text-sm text-accent underline" onClick={resend}>{t("resend")}</button>
        )}
        {info && <Alert kind="info">{info}</Alert>}
        <button className="btn-primary w-full" disabled={busy}>{t("signIn")}</button>
      </form>
      <div className="mt-5 flex justify-between text-sm">
        <Link className="text-accent underline-offset-2 hover:underline" href="/forgot">{t("forgot")}</Link>
        <Link className="text-accent underline-offset-2 hover:underline" href="/signup">{t("signUp")}</Link>
      </div>
    </>
  );
}

export function SignupForm({ google }: { google: boolean }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const errText = useErrorText();
  const [err, setErr] = useState<AuthErr>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const { error } = await authClient.signUp.email({
      email, password: String(f.get("password")), name: String(f.get("name")), locale, callbackURL: "/verify",
    });
    setBusy(false);
    if (error) return setErr(error);
    setSentTo(email);
  }

  if (sentTo) return <Alert kind="info">{t("checkEmail", { email: sentTo })}</Alert>;
  return (
    <>
      <h1 className="mb-5 text-xl font-semibold">{t("signUp")}</h1>
      <GoogleButton enabled={google} />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">{t("name")}</label>
          <input className="input" id="name" name="name" autoComplete="name" required maxLength={80} />
        </div>
        <div>
          <label className="label" htmlFor="email">{t("email")}</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">{t("password")}</label>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password"
            minLength={12} maxLength={128} required aria-describedby="pw-hint" />
          <p id="pw-hint" className="mt-1 text-xs text-muted">{t("passwordHint")}</p>
        </div>
        {err && <Alert>{errText(err)}</Alert>}
        <button className="btn-primary w-full" disabled={busy}>{t("signUp")}</button>
      </form>
      <p className="mt-5 text-sm text-muted">
        {t("haveAccount")} <Link className="text-accent hover:underline" href="/login">{t("signIn")}</Link>
      </p>
    </>
  );
}

export function ForgotForm() {
  const t = useTranslations("auth");
  const [done, setDone] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    // Réponse identique que le compte existe ou non.
    await authClient.requestPasswordReset({ email: String(f.get("email")), redirectTo: "/reset" });
    setDone(true);
  }
  return (
    <>
      <h1 className="mb-5 text-xl font-semibold">{t("forgotTitle")}</h1>
      {done ? <Alert kind="info">{t("forgotSent")}</Alert> : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">{t("email")}</label>
            <input className="input" id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <button className="btn-primary w-full">{t("send")}</button>
        </form>
      )}
      <p className="mt-5 text-sm"><Link className="text-accent hover:underline" href="/login">{t("signIn")}</Link></p>
    </>
  );
}

export function ResetForm() {
  const t = useTranslations("auth");
  const errText = useErrorText();
  const params = useSearchParams();
  const token = params.get("token");
  const [err, setErr] = useState<AuthErr>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await authClient.resetPassword({ newPassword: String(f.get("password")), token: token! });
    if (error) return setErr(error);
    setDone(true);
  }

  if (!token || params.get("error")) return <Alert>{t("resetInvalid")}</Alert>;
  return (
    <>
      <h1 className="mb-5 text-xl font-semibold">{t("forgotTitle")}</h1>
      {done ? <Alert kind="info">{t("resetDone")} <Link className="underline" href="/login">{t("signIn")}</Link></Alert> : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="password">{t("newPassword")}</label>
            <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={12} required />
            <p className="mt-1 text-xs text-muted">{t("passwordHint")}</p>
          </div>
          {err && <Alert>{errText(err)}</Alert>}
          <button className="btn-primary w-full">{t("save")}</button>
        </form>
      )}
    </>
  );
}

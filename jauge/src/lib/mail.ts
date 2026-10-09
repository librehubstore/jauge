import { createTranslator } from "next-intl";
import { LOCALES, type Locale } from "@/i18n/config";

type MailKind = "verify" | "reset";

async function translator(locale: string) {
  const l = (LOCALES as readonly string[]).includes(locale) ? (locale as Locale) : "fr";
  const messages = (await import(`../../messages/${l}.json`)).default;
  return createTranslator({ locale: l, messages, namespace: "email" });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Envoie un email transactionnel via Brevo ; sans clé API, l'écrit dans la console (développement). */
export async function sendMail(kind: MailKind, to: { email: string; name: string; locale: string }, url: string) {
  const t = await translator(to.locale);
  const subject = t(`${kind}.subject`);
  const html = `<p>${esc(t("hello", { name: to.name }))}</p><p>${esc(t(`${kind}.body`))}</p>` +
    `<p><a href="${esc(url)}">${esc(t(`${kind}.cta`))}</a></p><p style="color:#666">${esc(t(`${kind}.footer`))}</p>`;

  if (!process.env.BREVO_API_KEY) {
    console.info(`[mail:dev] to=${to.email} subject="${subject}" url=${url}`);
    return;
  }
  const from = process.env.MAIL_FROM ?? "Jauge <no-reply@example.com>";
  const m = from.match(/^(.*)<(.+)>$/);
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: m ? { name: m[1].trim(), email: m[2].trim() } : { email: from },
      to: [{ email: to.email, name: to.name }],
      subject, htmlContent: html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[mail] échec Brevo ${res.status}: ${body}`);
    throw new Error("MAIL_SEND_FAILED");
  }
}

import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getSetting } from "@/lib/settings";

// Page d'atterrissage du lien de vérification (Better Auth redirige ici, avec ?error=… en cas d'échec).
export default async function VerifyPage({ searchParams }: PageProps<"/verify">) {
  const t = await getTranslations("auth");
  const { error } = await searchParams;
  if (error) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-danger">{t("verifyInvalid")}</p>
        <Link className="btn-ghost w-full" href="/login">{t("signIn")}</Link>
      </div>
    );
  }
  const pending = await getSetting("require_admin_approval");
  return (
    <div className="space-y-4">
      <p role="status" className="text-sm">{pending ? t("pendingApproval") : t("verified")}</p>
      {!pending && <Link className="btn-primary w-full" href="/login">{t("signIn")}</Link>}
    </div>
  );
}

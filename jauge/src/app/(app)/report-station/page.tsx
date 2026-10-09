import { getTranslations } from "next-intl/server";
import { MissingStationForm } from "@/components/MissingStationForm";
import { requireUser } from "@/lib/session";

export default async function ReportStationPage() {
  await requireUser();
  const t = await getTranslations("contrib");
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-xl space-y-3 p-4">
        <h1 className="text-2xl font-semibold">{t("missingTitle")}</h1>
        <p className="text-sm text-muted">{t("missingHelp")}</p>
        <MissingStationForm />
      </div>
    </div>
  );
}

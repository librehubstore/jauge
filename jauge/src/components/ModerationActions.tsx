"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { moderateContribution } from "@/app/actions/admin";

export function ModerationActions({ id }: { id: number }) {
  const t = useTranslations("moderation");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <input className="input max-w-xs flex-1" placeholder={t("reason")} aria-label={t("reason")} value={reason}
        maxLength={300} onChange={(e) => setReason(e.target.value)} />
      <button className="btn-primary" disabled={pending} onClick={() => start(() => moderateContribution(id, "approve", reason))}>{t("approve")}</button>
      <button className="btn-danger" disabled={pending} onClick={() => start(() => moderateContribution(id, "reject", reason))}>{t("reject")}</button>
    </div>
  );
}

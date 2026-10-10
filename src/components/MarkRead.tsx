"use client";

import { useEffect } from "react";
import { markNotificationsRead } from "@/app/actions/app";

/** Marque les notifications comme lues à l'ouverture de la page. */
export function MarkRead({ hasUnread }: { hasUnread: boolean }) {
  useEffect(() => { if (hasUnread) void markNotificationsRead(); }, [hasUnread]);
  return null;
}

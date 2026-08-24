"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { trackD7ReturnGoal, trackLoginGoal } from "@/lib/metrika-funnel";

/**
 * Fires Metrika funnel goals:
 * - login — once when the session becomes authenticated
 * - d7_return — once when returning ≥7 days after first open
 */
export function MetrikaFunnel() {
  const { status } = useSession();
  const loginSent = useRef(false);

  useEffect(() => {
    trackD7ReturnGoal();
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || loginSent.current) {
      return;
    }
    loginSent.current = true;
    trackLoginGoal();
  }, [status]);

  return null;
}

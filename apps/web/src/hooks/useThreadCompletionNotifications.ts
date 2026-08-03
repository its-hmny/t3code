/**
 * Fires a native OS notification whenever a thread transitions from the
 * "running" (Working) state to a settled state (completed, needs input, etc.).
 *
 * Activated only when the `notifyOnThreadCompletion` client setting is enabled
 * and the browser has been granted notification permission.
 */
import { useEffect, useRef } from "react";
import { useThreadShells } from "../state/entities";
import type { SidebarThreadSummary } from "../types";

type TrackedStatus = "running" | "settled";

function resolveStatus(thread: SidebarThreadSummary): TrackedStatus {
  const sessionStatus = thread.session?.status;
  if (sessionStatus === "running" || sessionStatus === "starting") {
    return "running";
  }
  return "settled";
}

function buildNotificationBody(thread: SidebarThreadSummary): string {
  if (thread.hasPendingApprovals) return "Approval needed.";
  if (thread.hasPendingUserInput) return "Waiting for your input.";
  if (thread.hasActionableProposedPlan) return "Plan ready for review.";
  return "Task completed.";
}

export function useThreadCompletionNotifications(enabled: boolean): void {
  const threads = useThreadShells();
  // Track the last known status per thread key (environmentId:threadId).
  const previousStatusRef = useRef<Map<string, TrackedStatus>>(new Map());
  // Whether we've already requested permission this session.
  const permissionRequestedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      previousStatusRef.current.clear();
      return;
    }

    // Request permission once when the feature is first enabled.
    if (
      !permissionRequestedRef.current &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      permissionRequestedRef.current = true;
      void Notification.requestPermission();
    }

    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      return;
    }

    const previous = previousStatusRef.current;
    const next = new Map<string, TrackedStatus>();

    for (const thread of threads) {
      // Skip archived threads — no notification needed.
      if (thread.archivedAt !== null) continue;

      const key = `${thread.environmentId}:${thread.id}`;
      const currentStatus = resolveStatus(thread);
      const previousStatus = previous.get(key);

      next.set(key, currentStatus);

      // Fire when transitioning running → settled.
      if (previousStatus === "running" && currentStatus === "settled") {
        const notification = new Notification(thread.title, {
          body: buildNotificationBody(thread),
          icon: "/favicon-32x32.png",
          // tag deduplicates: a second completion on the same thread
          // replaces the previous notification rather than stacking.
          tag: `t3code-thread-${key}`,
          silent: false,
        });

        // Clicking the notification focuses the app window.
        notification.addEventListener("click", () => {
          window.focus();
          notification.close();
        });
      }
    }

    previousStatusRef.current = next;
  }, [enabled, threads]);
}

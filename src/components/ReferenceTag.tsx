"use client";

import { useSyncExternalStore } from "react";

/**
 * REVIEW AID: shows which reference site a page's layout was modelled on.
 * Compact on small screens and dismissible (the × hides it for the current tab session).
 * Hide everywhere with NEXT_PUBLIC_HIDE_REFERENCE_TAG=true, or delete this file and its usages.
 */
const KEY = "ix-ref-tag-hidden";
const EVENT = "ix-ref-tag-change";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}
function getSnapshot() {
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
// Server render and hydration always start visible; the stored dismissal applies right after.
const getServerSnapshot = () => false;

export function ReferenceTag({ reference }: { reference?: { name: string; url?: string } }) {
  const hidden = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!reference || hidden || process.env.NEXT_PUBLIC_HIDE_REFERENCE_TAG === "true") return null;

  const label = (
    <>
      <span className="font-semibold">Layout ref:</span> {reference.name}
    </>
  );
  return (
    <div className="fixed bottom-3 left-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-full bg-amber-300 py-1 pl-3 pr-1 text-[11px] text-ink shadow-lg sm:bottom-4 sm:left-4 sm:text-xs">
      {reference.url ? (
        <a href={reference.url} target="_blank" rel="noopener noreferrer" className="truncate underline-offset-2 hover:underline">
          {label}
        </a>
      ) : (
        <span className="truncate">{label}</span>
      )}
      <button
        type="button"
        aria-label="Hide layout reference tag"
        onClick={() => {
          try {
            window.sessionStorage.setItem(KEY, "1");
          } catch {
            /* storage unavailable: nothing to persist */
          }
          window.dispatchEvent(new Event(EVENT));
        }}
        className="ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-black/10"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

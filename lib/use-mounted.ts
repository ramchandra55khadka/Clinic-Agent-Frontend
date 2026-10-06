"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * True after the first client render. Lets components that must render
 * differently on the server (portals, date-dependent UI) wait for hydration
 * without tripping the no-set-state-in-effect lint rule.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

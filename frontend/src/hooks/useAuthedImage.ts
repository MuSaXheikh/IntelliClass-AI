"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Loaded {
  path: string;
  url: string | null;
  failed: boolean;
}

/** Loads a protected image through the API client and returns an object URL (revoked on change). */
export function useAuthedImage(path: string | null): { url: string | null; failed: boolean } {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!path) return;
    let active = true;
    let objectUrl: string | null = null;
    api
      .blobUrl(path)
      .then((created) => {
        if (!active) {
          URL.revokeObjectURL(created);
          return;
        }
        objectUrl = created;
        setLoaded({ path, url: created, failed: false });
      })
      .catch(() => {
        if (active) setLoaded({ path, url: null, failed: true });
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  // Derive during render so a path change never shows the previous image.
  const current = loaded && loaded.path === path ? loaded : null;
  return { url: current?.url ?? null, failed: current?.failed ?? false };
}

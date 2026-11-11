"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "./api";

// Charge une ressource GET et expose reload() pour rafraîchir après une modification
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!url) return;
    let actif = true;
    api<T>("GET", url)
      .then((d) => {
        if (!actif) return;
        setData(d);
        setError(null);
      })
      .catch((e) => actif && setError(errMsg(e)));
    return () => {
      actif = false;
    };
  }, [url, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading: data === undefined && !error, reload };
}

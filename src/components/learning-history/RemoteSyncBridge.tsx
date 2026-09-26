"use client";

import { useEffect } from "react";
import { remoteSyncController } from "@/modules/learning-history/remote/browser-runtime";

export function RemoteSyncBridge() {
  useEffect(() => {
    remoteSyncController.initialize();
    return () => remoteSyncController.dispose();
  }, []);
  return null;
}

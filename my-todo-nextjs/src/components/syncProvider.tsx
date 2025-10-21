"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [syncStatus, setSyncStatus] = useState<{
    isSyncing: boolean;
    unsyncedCount: number;
  }>({
    isSyncing: false,
    unsyncedCount: 0,
  });

  useEffect(() => {
    // Function to process sync queue
    const syncData = async () => {
      if (!navigator.onLine) return;

      setSyncStatus((prev) => ({ ...prev, isSyncing: true }));

      try {
        await db.processSyncQueue();
        const count = await db.getUnsyncedCount();
        setSyncStatus({ isSyncing: false, unsyncedCount: count });
      } catch (error) {
        console.error("Sync failed:", error);
        setSyncStatus((prev) => ({ ...prev, isSyncing: false }));
      }
    };

    // Update unsynced count
    const updateUnsyncedCount = async () => {
      const count = await db.getUnsyncedCount();
      setSyncStatus((prev) => ({ ...prev, unsyncedCount: count }));
    };

    // Sync when coming online
    const handleOnline = () => {
      console.log("Connection restored - syncing data...");
      syncData();
    };

    // Update count when going offline
    const handleOffline = () => {
      console.log("Connection lost - changes will be queued");
      updateUnsyncedCount();
    };

    // Initial sync check
    if (navigator.onLine) {
      syncData();
    } else {
      updateUnsyncedCount();
    }

    // Periodic sync every 30 seconds when online
    const syncInterval = setInterval(() => {
      if (navigator.onLine) {
        syncData();
      }
    }, 30000);

    // Listen for online/offline events
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Listen for visibility change (tab becomes active)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        syncData();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Show sync status indicator
  return (
    <>
      {syncStatus.unsyncedCount > 0 && (
        <div className="fixed bottom-4 right-4 z-50 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          {syncStatus.isSyncing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Syncing {syncStatus.unsyncedCount} items...</span>
            </>
          ) : (
            <>
              <span className="inline-block w-2 h-2 bg-white rounded-full"></span>
              <span>{syncStatus.unsyncedCount} unsynced items</span>
            </>
          )}
        </div>
      )}
      {children}
    </>
  );
}
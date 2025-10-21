"use client";

import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/app/Sidebar/Side-bar";
import { db } from "@/lib/db";

export function SidebarLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const syncTodos = async () => {
      try {
        const unsyncedTodos = await db.todos
          .where("isSynced")
          .equals(false as any)
          .toArray();

        if (unsyncedTodos.length > 0) {
          // Here you would typically send to your backend API
          // For now, we'll just mark them as synced
          await db.todos.bulkPut(
            unsyncedTodos.map((todo) => ({
              ...todo,
              isSynced: true,
            }))
          );

          console.log(`Synced ${unsyncedTodos.length} todos`);
        }
      } catch (error) {
        console.error("Sync failed:", error);
      }
    };

    // Sync when coming back online
    window.addEventListener("online", syncTodos);

    // Initial sync check
    if (navigator.onLine) {
      syncTodos();
    }

    return () => {
      window.removeEventListener("online", syncTodos);
    };
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 h-screen w-full flex flex-col">
        <div className="flex-row items-center sticky top-0 z-10 p-4 bg-gray-100 dark:bg-gray-800 flex gap-2">
          <SidebarTrigger />
          <h1 className="text-2xl font-bold">My Todo List.</h1>
        </div>
        {children}
      </main>
    </SidebarProvider>
  );
}
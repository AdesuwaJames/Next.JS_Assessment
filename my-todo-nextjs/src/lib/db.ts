import Dexie from "dexie";

export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  date: string;
  bgClass?: string;
  lastUpdated?: number;
  isSynced?: boolean;
}

export interface SyncQueueItem {
  id?: number;
  todoId: number;
  action: "create" | "update" | "delete";
  data: Todo | null;
  timestamp: number;
  attempts: number;
}

export class TodoDB extends Dexie {
  todos!: Dexie.Table<Todo, number>;
  syncQueue!: Dexie.Table<SyncQueueItem, number>;

  constructor() {
    super("TodoDB");

    // Define schema versions
    this.version(1).stores({
      todos: "id, title, completed, date, lastUpdated, isSynced",
    });

    this.version(2).stores({
      todos: "id, title, completed, date, lastUpdated, isSynced",
      syncQueue: "++id, todoId, action, timestamp, attempts",
    });

    // Listen for "online" events to auto-sync
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.processSyncQueue());
    }
  }

  /**
   * Add a new todo locally and queue for sync
   */
  async addTodo(todo: Omit<Todo, "isSynced" | "lastUpdated">): Promise<void> {
    const newTodo: Todo = {
      ...todo,
      lastUpdated: Date.now(),
      isSynced: false,
    };

    await this.todos.add(newTodo);
    await this.addToSyncQueue("create", newTodo);
  }

  /**
   * Update an existing todo locally and queue for sync
   */
  async updateTodo(id: number, changes: Partial<Todo>): Promise<void> {
    const existing = await this.todos.get(id);
    if (!existing) return;

    const updatedTodo: Todo = {
      ...existing,
      ...changes,
      lastUpdated: Date.now(),
      isSynced: false,
    };

    await this.todos.put(updatedTodo);
    await this.addToSyncQueue("update", updatedTodo);
  }

  /**
   * Delete a todo locally and queue for sync
   */
  async deleteTodo(id: number): Promise<void> {
    const existing = await this.todos.get(id);
    if (!existing) return;

    await this.todos.delete(id);
    await this.addToSyncQueue("delete", existing);
  }

  /**
   * Add item to sync queue
   */
  async addToSyncQueue(
    action: "create" | "update" | "delete",
    todo: Todo
  ): Promise<void> {
    await this.syncQueue.add({
      todoId: todo.id,
      action,
      data: todo,
      timestamp: Date.now(),
      attempts: 0,
    });
  }

  /**
   * Process sync queue when online
   */
  async processSyncQueue(): Promise<void> {
    if (!navigator.onLine) return;

    const queueItems = await this.syncQueue.toArray();

    for (const item of queueItems) {
      try {
        // Simulate or call your API here
        console.log(`Syncing ${item.action} for todo ${item.todoId}`);

        // Example simulated API call:
        // const res = await fetch("/api/todos", {
        //   method: item.action === "delete" ? "DELETE" : "POST",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify(item.data),
        // });

        // if (!res.ok) throw new Error("API sync failed");

        // Mark todo as synced
        if (item.data && item.action !== "delete") {
          await this.todos.update(item.todoId, { isSynced: true });
        }

        // Remove from queue
        await this.syncQueue.delete(item.id!);
      } catch (error) {
        console.error(`Failed to sync todo ${item.todoId}:`, error);

        // Increment attempt count
        await this.syncQueue.update(item.id!, {
          attempts: item.attempts + 1,
        });

        // Remove from queue after 5 failed attempts
        if (item.attempts >= 5) {
          console.warn(
            `Removing todo ${item.todoId} from queue after 5 failed attempts`
          );
          await this.syncQueue.delete(item.id!);
        }
      }
    }
  }

  /**
   * Get unsynced todos count
   */
  async getUnsyncedCount(): Promise<number> {
    return await this.todos.where("isSynced").equals(false as any).count();
  }

  /**
   * Clear all local data (useful for testing)
   */
  async clearAll(): Promise<void> {
    await this.todos.clear();
    await this.syncQueue.clear();
    localStorage.removeItem("todos");
  }
}
// Auto-sync when the browser comes online
if (typeof window !== "undefined") {
  window.addEventListener("online", async () => {
    console.log("🌐 Connection restored. Syncing pending changes...");
    await db.processSyncQueue();
  });
}


export const db = new TodoDB();

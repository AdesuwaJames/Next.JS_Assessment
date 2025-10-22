// src/hooks/useTodos.ts
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import type { Todo } from "@/lib/db";

// Define the API response type
interface ApiTodo {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
}

export const useTodos = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAndSaveTodos = async () => {
    try {
      const res = await fetch("https://jsonplaceholder.typicode.com/todos");
      const data: ApiTodo[] = await res.json();
      
      const enhanced: Todo[] = data.slice(0, 30).map((item: ApiTodo, index: number) => ({
        id: item.id,
        title: item.title,
        completed: item.completed,
        date: new Date(2025, 5, (index % 30) + 1).toISOString(),
        bgClass: `hsla(${Math.floor(Math.random() * 360)}, 70%, 90%, 0.5)`,
        isSynced: true, // Assuming these are synced since they come from API
        lastUpdated: Date.now(),
      }));

      await db.todos.bulkPut(enhanced);
      setTodos(enhanced);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch todos:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadFromIndexedDB = async () => {
      try {
        const stored = await db.todos.toArray();
        if (stored.length) {
          setTodos(stored);
          setLoading(false);
        } else {
          await fetchAndSaveTodos();
        }
      } catch (error) {
        console.error("Failed to load todos from IndexedDB:", error);
        setLoading(false);
      }
    };
    
    loadFromIndexedDB();
  }, []);

  const addTodo = async (todo: Omit<Todo, "id">) => {
    try {
      // Generate a temporary ID if not provided
      const newTodo: Todo = {
        ...todo,
        id: Date.now(), // Use timestamp as ID
      };
      
      await db.addTodo(newTodo); // Use the method from your TodoDB class
      setTodos([newTodo, ...todos]);
    } catch (error) {
      console.error("Failed to add todo:", error);
    }
  };

  return {
    todos,
    loading,
    addTodo,
    setTodos,
  };
};
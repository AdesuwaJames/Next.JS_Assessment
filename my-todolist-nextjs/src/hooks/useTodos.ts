// src/hooks/useTodos.ts
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import type { Todo } from "@/lib/db";

export const useTodos = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAndSaveTodos = async () => {
    const res = await fetch("https://jsonplaceholder.typicode.com/todos");
    const data = await res.json();
    const enhanced = data.slice(0, 30).map((item: any, index: number) => ({
      ...item,
      date: new Date(2025, 5, (index % 30) + 1).toISOString(),
      bgClass: `hsla(${Math.floor(Math.random() * 360)}, 70%, 90%, 0.5)`,
    }));

    await db.todos.bulkPut(enhanced);
    setTodos(enhanced);
    setLoading(false);
  };

  useEffect(() => {
    const loadFromIndexedDB = async () => {
      const stored = await db.todos.toArray();
      if (stored.length) {
        setTodos(stored);
        setLoading(false);
      } else {
        fetchAndSaveTodos();
      }
    };
    loadFromIndexedDB();
  }, []);

  const addTodo = async (todo: Todo) => {
    await db.todos.add(todo);
    setTodos([todo, ...todos]);
  };

  return {
    todos,
    loading,
    addTodo,
    setTodos,
  };
};

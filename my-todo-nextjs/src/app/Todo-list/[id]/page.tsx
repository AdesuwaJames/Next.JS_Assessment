"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from '@/lib/db';
import type { Todo } from '@/lib/db';
import { TbArrowBackUp } from "react-icons/tb";

export default function TodoDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [todo, setTodo] = useState<Todo | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState("");
  const [completed, setCompleted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const loadTodo = async () => {
      if (!id) return;
      
      try {
        const todoFromDB = await db.todos.get(parseInt(id));
        if (todoFromDB) {
          setTodo(todoFromDB);
          setTitle(todoFromDB.title);
          setCompleted(todoFromDB.completed);
        }
      } catch (error) {
        console.error("Failed to load todo:", error);
      }
    };

    loadTodo();
  }, [id]);

  const handleUpdate = async () => {
    if (!todo) return;
    
    const updatedTodo = { 
      ...todo, 
      title, 
      completed,
      lastUpdated: Date.now(),
      isSynced: isOnline
    };

    setTodo(updatedTodo);
    await db.todos.put(updatedTodo);

    setEditMode(false);
    alert("Todo updated successfully!");
  };

  const handleDelete = async () => {
    if (!todo) return;
    
    await db.todos.delete(todo.id);
    alert("Todo deleted successfully!");
    router.push("/");
  };

  if (!todo) return <p className="p-6">Todo not found...</p>;
  
  function handleBack() {
    router.push("/");
  }

  return (
    <div className="w-full h-screen flex items-center justify-center bg-white dark:bg-gray-900 flex-col">
      <div className="cursor-pointer w-[80%] mb-5" onClick={handleBack}>
        <TbArrowBackUp size={35} color="#ffffff" className="p-2 rounded-sm bg-black" />
      </div>
      <div className="p-6 w-[80%] h-[60%] bg-white dark:bg-gray-800 rounded-lg shadow-md">
        {editMode ? (
          <div className="space-y-4">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                aria-label="Mark as completed"
              />
              Completed
            </label>
            <Button onClick={handleUpdate}>Save</Button>
            <Button variant="outline" onClick={() => setEditMode(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">{todo.title}</h1>
            <p>Status: {todo.completed ? "✅ Completed" : "⌛ Pending"}</p>
            {todo.date && (
              <p className="text-gray-500 text-sm">Date: {new Date(todo.date).toDateString()}</p>
            )}
            {!isOnline && (
              <p className="text-yellow-600 text-sm">Offline mode - changes will sync when online</p>
            )}
            <div className="flex gap-4">
              <Button onClick={() => setEditMode(true)}>Edit</Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
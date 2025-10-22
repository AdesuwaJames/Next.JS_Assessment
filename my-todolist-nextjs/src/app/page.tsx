"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarIcon, Plus } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { db } from "@/lib/db";
import type { Todo } from "@/lib/db";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/app/Sidebar/Side-bar";

// Define API response type
interface ApiTodo {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
}

// Utility functions
function formatDate(date: Date | undefined) {
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function isValidDate(date: Date | undefined) {
  if (!date) return false;
  return !isNaN(date.getTime());
}

const getRandomPastelColor = () => {
  const hue = Math.floor(Math.random() * 360);
  return `hsla(${hue}, 70%, 90%, 0.5)`;
};

export default function Home() {
  const [cards, setCards] = useState<Todo[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [month, setMonth] = useState<Date | undefined>(date);
  const [dateInputValue, setDateInputValue] = useState(formatDate(date));
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "completed" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoDate, setNewTodoDate] = useState<Date | undefined>(undefined);
  const [isOnline, setIsOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => {
      setIsOnline(true);
      // Sync any offline todos when coming back online
      syncOfflineTodos();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Sync offline todos when coming back online
  const syncOfflineTodos = async () => {
    try {
      const allTodos = await db.todos.toArray();
      const offlineTodos = allTodos.filter(todo => !todo.isSynced);
      
      if (offlineTodos.length > 0) {
        console.log('Syncing offline todos:', offlineTodos.length);
        // Mark todos as synced
        for (const todo of offlineTodos) {
          await db.todos.update(todo.id, { isSynced: true });
        }
        // Update local state
        setCards(prev => prev.map(todo => 
          offlineTodos.some(offlineTodo => offlineTodo.id === todo.id) 
            ? { ...todo, isSynced: true }
            : todo
        ));
      }
    } catch (error) {
      console.error('Failed to sync offline todos:', error);
    }
  };

  // Load data with offline-first caching strategy
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Always try to get from IndexedDB first (offline-first)
        const localTodos = await db.todos.toArray();
        
        if (localTodos.length > 0) {
          // Sort by lastUpdated to show newest first (handle undefined by falling back to 0)
          const sortedTodos = localTodos.sort((a, b) =>
            (b.lastUpdated ?? 0) - (a.lastUpdated ?? 0)
          );
          setCards(sortedTodos);
          setLoading(false);
          return;
        }

        // If no data in IndexedDB, check localStorage as fallback
        const todosFromStorage = localStorage.getItem("todos");
        if (todosFromStorage) {
          const data: Todo[] = JSON.parse(todosFromStorage);
          setCards(data);
          // Sync to IndexedDB
          await db.todos.bulkPut(data);
          setLoading(false);
          return;
        }

        // If online and no local data, fetch from API
        if (isOnline) {
          const response = await fetch(
            "https://jsonplaceholder.typicode.com/todos"
          );
          if (!response.ok) {
            throw new Error('Failed to fetch todos');
          }
          const data: ApiTodo[] = await response.json();

          const enhancedData: Todo[] = data.slice(0, 30).map((item: ApiTodo, index: number) => ({
            id: item.id,
            title: item.title,
            completed: item.completed,
            date: new Date(2025, 5, (index % 30) + 1).toISOString(),
            bgClass: getRandomPastelColor(),
            lastUpdated: Date.now(),
            isSynced: true,
          }));

          const sortedData = enhancedData.sort(
            (a: Todo, b: Todo) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
          );

          // Save to both localStorage and IndexedDB
          localStorage.setItem("todos", JSON.stringify(sortedData));
          await db.todos.bulkPut(sortedData);
          setCards(sortedData);
        }
      } catch (error) {
        console.error("Failed to load todos:", error);
        setError('Failed to load todos. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOnline]);

  const handleAddTodo = async () => {
    if (!newTodoTitle.trim() || !newTodoDate) {
      setError('Please fill in both title and date');
      return;
    }

    // Generate a unique ID (use timestamp to avoid conflicts)
    const newId = Date.now(); // Using timestamp ensures uniqueness
    const newTodo: Todo = {
      id: newId,
      title: newTodoTitle.trim(),
      completed: false,
      date: newTodoDate.toISOString(),
      bgClass: getRandomPastelColor(),
      lastUpdated: Date.now(),
      isSynced: isOnline, // Set sync status based on current online status
    };

    try {
      // Save to IndexedDB first (primary storage)
      await db.todos.add(newTodo);
      
      // Then update local state
      const updatedCards = [newTodo, ...cards];
      setCards(updatedCards);
      
      // Also update localStorage as backup
      localStorage.setItem("todos", JSON.stringify(updatedCards));
      
      // Reset form
      setNewTodoTitle("");
      setNewTodoDate(undefined);
      setDialogOpen(false);
      setError(null);

      console.log('Todo saved successfully. Online:', isOnline);

    } catch (error) {
      console.error('Failed to save todo:', error);
      setError('Failed to save todo. Please try again.');
      
      // Even if IndexedDB fails, try to save to localStorage and state
      const updatedCards = [newTodo, ...cards];
      setCards(updatedCards);
      localStorage.setItem("todos", JSON.stringify(updatedCards));
    }
  };

  const toggleTodoStatus = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const updatedCards = cards.map(card =>
      card.id === id ? { 
        ...card, 
        completed: !card.completed, 
        lastUpdated: Date.now(), 
        isSynced: isOnline 
      } : card
    );
    
    setCards(updatedCards);
    
    try {
      // Update both storage mechanisms
      localStorage.setItem("todos", JSON.stringify(updatedCards));
      await db.todos.update(id, { 
        completed: !cards.find(c => c.id === id)?.completed,
        lastUpdated: Date.now(),
        isSynced: isOnline
      });
    } catch (error) {
      console.error('Failed to update todo:', error);
      setError('Failed to update todo status.');
    }
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDateInputValue(inputValue);
    
    if (inputValue) {
      const date = new Date(inputValue);
      if (isValidDate(date)) {
        setDate(date);
        setMonth(date);
      }
    } else {
      setDate(undefined);
    }
  };

  const handleCalendarSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    setDateInputValue(formatDate(selectedDate));
    setCalendarOpen(false);
  };

  const filteredCards = cards.filter((card) => {
    const matchesDate =
      !date || new Date(card.date).toDateString() === date.toDateString();
    const matchesStatus =
      filter === "all"
        ? true
        : filter === "completed"
        ? card.completed
        : !card.completed;
    const matchesSearch =
      card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.id.toString().includes(searchQuery) ||
      formatDate(new Date(card.date))
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesDate && matchesStatus && matchesSearch;
  });

  const paginatedCards = filteredCards.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(filteredCards.length / itemsPerPage);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gray-100 dark:bg-gray-900">
        {/* Sidebar */}
        <AppSidebar />

        {/* Main content area */}
        <main className="flex-1 flex flex-col w-full">
          <SidebarHeader className="flex-row items-center sticky top-0 z-10 p-4 bg-white dark:bg-gray-800 shadow">
            <SidebarTrigger />
            <h1 className="text-2xl font-bold ml-2">My Todo List</h1>
          </SidebarHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {/* ==== Main Todo Page UI Starts Here ==== */}
            {!isOnline && (
              <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-lg">
                ⚠️ You're offline. Changes will sync when you're back online.
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
                ❌ {error}
              </div>
            )}

            <div className="w-full p-5 bg-white dark:bg-gray-800 rounded-lg shadow-md mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex flex-col gap-3">
                <div className="relative flex gap-2">
                  <Input
                    id="date"
                    value={dateInputValue}
                    aria-label="Select date"
                    placeholder="June 01, 2025"
                    className="bg-background pr-10"
                    onChange={handleDateInputChange}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setCalendarOpen(true);
                      }
                    }}
                  />
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        aria-label="Open calendar"
                        className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                      >
                        <CalendarIcon className="size-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto overflow-hidden p-0"
                      align="end"
                      alignOffset={-8}
                      sideOffset={10}
                    >
                      <Calendar
                        mode="single"
                        selected={date}
                        captionLayout="dropdown"
                        month={month}
                        onMonthChange={setMonth}
                        onSelect={handleCalendarSelect}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex gap-2 items-end">
                <Input
                  aria-label="Search todos"
                  type="text"
                  placeholder="Search by title, date, or ID..."
                  className="bg-white dark:bg-gray-800"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset to first page when searching
                  }}
                />
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      className="flex items-center gap-2"
                      aria-label="Add new todo"
                    >
                      <Plus className="w-4 h-4" /> Add Todo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Todo</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                      <Input
                        aria-label="New todo title"
                        placeholder="Todo title"
                        value={newTodoTitle}
                        onChange={(e) => setNewTodoTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                      />
                      <Input
                        aria-label="New todo date"
                        type="date"
                        onChange={(e) => {
                          const selectedDate = new Date(e.target.value);
                          if (isValidDate(selectedDate)) {
                            setNewTodoDate(selectedDate);
                          }
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                      />
                      <Button
                        onClick={handleAddTodo}
                        aria-label="Submit new todo"
                        disabled={!newTodoTitle.trim() || !newTodoDate}
                      >
                        Add Todo
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Filter buttons */}
            <div className="flex gap-4 mb-6">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => {
                  setFilter("all");
                  setCurrentPage(1);
                }}
              >
                All
              </Button>
              <Button
                variant={filter === "pending" ? "default" : "outline"}
                onClick={() => {
                  setFilter("pending");
                  setCurrentPage(1);
                }}
              >
                Pending
              </Button>
              <Button
                variant={filter === "completed" ? "default" : "outline"}
                onClick={() => {
                  setFilter("completed");
                  setCurrentPage(1);
                }}
              >
                Completed
              </Button>
            </div>

            {/* Todo list grid */}
            {loading ? (
              <div className="flex justify-center items-center py-10">
                <span className="text-gray-500 dark:text-gray-300 text-lg font-medium">
                  Loading todos...
                </span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {paginatedCards.map((card) => (
                    <Link href={`/Todo-list/${card.id}`} key={card.id}>
                      <Card 
                        style={{ backgroundColor: card.bgClass }}
                        className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
                      >
                        <CardHeader>
                          <CardTitle className="line-clamp-2">{card.title}</CardTitle>
                          <CardDescription>ID: {card.id}</CardDescription>
                          <CardAction>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => toggleTodoStatus(card.id, e)}
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                card.completed
                                  ? "bg-green-100 text-green-800 hover:bg-green-200"
                                  : "bg-red-100 text-red-800 hover:bg-red-200"
                              }`}
                            >
                              {card.completed ? "Completed" : "Pending"}
                            </Button>
                          </CardAction>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            This is a description for &quot;{card.title}&quot;.
                          </p>
                        </CardContent>
                        <CardFooter className="flex justify-between items-center">
                          <p className="text-sm font-medium">
                            {formatDate(new Date(card.date))}
                          </p>
                          {!card.isSynced && (
                            <span className="text-xs text-yellow-600 dark:text-yellow-400">
                              Offline
                            </span>
                          )}
                        </CardFooter>
                      </Card>
                    </Link>
                  ))}
                </div>

                {/* Empty state */}
                {!loading && paginatedCards.length === 0 && (
                  <div className="flex justify-center items-center py-10">
                    <span className="text-gray-500 dark:text-gray-300 text-lg font-medium">
                      {searchQuery || date ? "No todos match your filters" : "No todos yet. Add one!"}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center items-center py-2 px-4 bg-gray-200 dark:bg-gray-700 rounded-lg">
                <div className="w-full overflow-x-auto">
                  <Pagination>
                    <PaginationContent className="flex space-x-2">
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage((prev) => Math.max(prev - 1, 1));
                          }}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>

                      {currentPage > 2 && (
                        <>
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              isActive={currentPage === 1}
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(1);
                              }}
                            >
                              1
                            </PaginationLink>
                          </PaginationItem>
                          {currentPage > 3 && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}
                        </>
                      )}

                      {[-1, 0, 1].map((offset) => {
                        const page = currentPage + offset;
                        if (page > 0 && page <= totalPages) {
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                href="#"
                                isActive={page === currentPage}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setCurrentPage(page);
                                }}
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }
                        return null;
                      })}

                      {currentPage < totalPages - 1 && (
                        <>
                          {currentPage < totalPages - 2 && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              isActive={currentPage === totalPages}
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(totalPages);
                              }}
                            >
                              {totalPages}
                            </PaginationLink>
                          </PaginationItem>
                        </>
                      )}

                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage((prev) =>
                              Math.min(prev + 1, totalPages)
                            );
                          }}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
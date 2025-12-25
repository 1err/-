import React, { useState } from 'react';
import { Check, Circle, Plus, Trash2, StickyNote } from 'lucide-react';
import { TodoItem } from '../types';

interface TodoListProps {
  todos: TodoItem[];
  setTodos: any; // Keeping for compatibility but unused if handlers are provided
  onAdd: (todo: TodoItem) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TodoList: React.FC<TodoListProps> = ({ todos, onAdd, onToggle, onDelete }) => {
  const [newTodo, setNewTodo] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    
    const newItem: TodoItem = {
      id: Date.now().toString(),
      text: newTodo,
      completed: false,
      notes: ''
    };
    
    onAdd(newItem);
    setNewTodo('');
    setIsAdding(false);
  };

  return (
    <div className="max-w-3xl mx-auto w-full animate-slide-up">
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        <div className="p-8 bg-gradient-to-r from-pink-50 to-purple-50 border-b border-gray-100 flex justify-between items-center">
          <div>
             <h2 className="text-2xl font-bold text-gray-800 serif">愿望清单</h2>
             <p className="text-gray-500 text-sm mt-1">想和宝贝一起完成的好多好多事</p>
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className={`p-2 rounded-full transition-all ${isAdding ? 'bg-gray-200 text-gray-600 rotate-45' : 'bg-pink-100 text-pink-500 hover:bg-pink-200'}`}
          >
            <Plus size={24} />
          </button>
        </div>

        {isAdding && (
          <form onSubmit={addTodo} className="p-4 bg-gray-50 border-b border-gray-100 animate-fade-in">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                placeholder="想一起去做什么呢？例如：去日本看樱花..."
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white"
                autoFocus
              />
              <button 
                type="submit"
                className="bg-pink-500 text-white px-6 py-2 rounded-xl font-medium hover:bg-pink-600 transition-colors"
              >
                添加
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
          {todos.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p>还没有愿望哦，快许愿吧！</p>
            </div>
          ) : (
            todos.map((todo) => (
              <div 
                key={todo.id} 
                className={`group flex items-center p-4 hover:bg-gray-50 transition-colors ${todo.completed ? 'opacity-60 bg-gray-50/50' : ''}`}
              >
                <button
                  onClick={() => onToggle(todo.id)}
                  className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mr-4 ${
                    todo.completed ? 'bg-green-400 border-green-400' : 'border-gray-300 hover:border-pink-300'
                  }`}
                >
                  {todo.completed && <Check size={14} className="text-white" />}
                </button>
                
                <div className="flex-1">
                  <p className={`text-lg transition-all ${todo.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {todo.text}
                  </p>
                  {todo.notes && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><StickyNote size={10} /> {todo.notes}</p>}
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                   <button 
                    onClick={() => onDelete(todo.id)}
                    className="p-2 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                   >
                     <Trash2 size={16} />
                   </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="mt-6 text-center text-gray-400 text-sm">
        {todos.filter(t => t.completed).length} 已完成 • 共 {todos.length} 项
      </div>
    </div>
  );
};
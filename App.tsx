import React, { useState, useRef, useEffect } from 'react';
import { Timer } from './components/Timer';
import { Gallery } from './components/Gallery';
import { TodoList } from './components/TodoList';
import { ViewState, Memory, TodoItem } from './types';
import { Heart, Image as ImageIcon, ListTodo, Home, Camera, Loader2, Settings, Download, Upload, AlertCircle, Cloud, CloudOff } from 'lucide-react';
import * as db from './utils/db';
import { isFirebaseReady } from './utils/firebase';

const START_DATE = new Date('2025-10-25T00:00:00');

const DEFAULT_AVATAR_JERRY = '/Jerry.png';
const DEFAULT_AVATAR_CLAIRE = '/Claire.png';

// Helper to convert file to base64 for persistence
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

function App() {
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // State
  const [memories, setMemories] = useState<Memory[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [jerryImage, setJerryImage] = useState(DEFAULT_AVATAR_JERRY);
  const [claireImage, setClaireImage] = useState(DEFAULT_AVATAR_CLAIRE);

  // File Input Refs
  const jerryInputRef = useRef<HTMLInputElement>(null);
  const claireInputRef = useRef<HTMLInputElement>(null);

  // Initialize Firebase and load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Initialize Firebase (will return false if config not provided, but won't error)
        const firebaseInitialized = await db.initializeFirebase();
        setIsSyncing(firebaseInitialized);
        
        if (firebaseInitialized) {
          console.log('✅ Firebase initialized successfully');
        } else {
          console.warn('⚠️ Firebase not initialized - check .env.local file');
        }

        // Load Memories (will try Firebase first, fallback to IndexedDB)
        const savedMemories = await db.getAllMemories();
        setMemories(savedMemories.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

        // Load Todos (will try Firebase first, fallback to IndexedDB)
        const savedTodos = await db.getAllTodos();
        setTodos(savedTodos);

        // Load Avatars
        const savedJerry = await db.getSetting('avatar_jerry');
        if (savedJerry) setJerryImage(savedJerry.value);
        
        const savedClaire = await db.getSetting('avatar_claire');
        if (savedClaire) setClaireImage(savedClaire.value);

        // Set up real-time sync if Firebase is ready
        if (firebaseInitialized && isFirebaseReady()) {
          const unsubscribe = db.setupRealtimeSync(
            (newMemories) => {
              setMemories(newMemories.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            },
            (newTodos) => {
              setTodos(newTodos);
            }
          );

          // Cleanup on unmount
          return () => {
            unsubscribe();
          };
        }
      } catch (error) {
        console.error("Failed to load data from DB:", error);
        setIsSyncing(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      
      const newMemoriesPromises = files.map(async (file) => {
        const base64Url = await fileToBase64(file);
        const newMemory: Memory = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          type: file.type.startsWith('video') ? 'video' : 'image',
          url: base64Url,
          date: new Date().toISOString(),
          caption: '嘿嘿'
        };
        // Save directly to DB (will sync to Firebase)
        await db.saveMemory(newMemory);
        return newMemory;
      });

      const newMemories = await Promise.all(newMemoriesPromises);
      
      // Update state immediately for instant feedback
      // The real-time listener will also update, but we deduplicate by ID
      setMemories(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const uniqueNew = newMemories.filter(m => !existingIds.has(m.id));
        return [...uniqueNew, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });
    }
  };

  const handleDeleteMemory = async (id: string) => {
    await db.deleteMemory(id);
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const handleUpdateMemory = async (id: string, updates: { caption: string; date: string }) => {
    const memory = memories.find(m => m.id === id);
    if (memory) {
      const updatedMemory = { ...memory, ...updates };
      await db.saveMemory(updatedMemory);
      setMemories(prev => prev.map(m => m.id === id ? updatedMemory : m));
    }
  };

  // Avatar Handlers
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>, person: 'jerry' | 'claire') => {
    if (e.target.files && e.target.files[0]) {
      const base64Url = await fileToBase64(e.target.files[0]);
      const key = `avatar_${person}`;
      await db.saveSetting(key, base64Url);
      
      if (person === 'jerry') setJerryImage(base64Url);
      else setClaireImage(base64Url);
    }
  };

  // Todo Handlers - Wrapper to sync with DB
  const updateTodos = async (newTodos: TodoItem[] | ((prev: TodoItem[]) => TodoItem[])) => {
    // This is a bit tricky with async DB calls inside a set state wrapper. 
    // To simplify, we will intercept the standard React setState pattern.
    
    let resolvedTodos: TodoItem[];
    if (typeof newTodos === 'function') {
      resolvedTodos = newTodos(todos);
    } else {
      resolvedTodos = newTodos;
    }

    // Determine what changed (simple heuristic: find diffs)
    // For simplicity in this app, we just re-save the modified items or delete missing ones.
    // But since we want to be efficient, let's just save the specific operations in the Child component?
    // Actually, passing a "save" callback to TodoList is cleaner, but to keep the architecture simple:
    // We will save ALL current todos to DB whenever this is called. 
    // Optimization: In a real app we'd only save the changed one.
    
    // For now, let's just update local state here, and use specific handlers for DB actions
    setTodos(resolvedTodos);
  };

  // Specific Todo DB Actions
  const handleAddTodo = async (todo: TodoItem) => {
    await db.saveTodo(todo);
    // Update state immediately for instant feedback
    // The real-time listener will also update, but we deduplicate by ID
    setTodos(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      if (existingIds.has(todo.id)) {
        return prev; // Already exists, don't add duplicate
      }
      return [todo, ...prev];
    });
  };

  const handleToggleTodo = async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (todo) {
      const updated = { ...todo, completed: !todo.completed };
      await db.saveTodo(updated);
      // Update state immediately
      setTodos(prev => prev.map(t => t.id === id ? updated : t));
    }
  };

  const handleDeleteTodo = async (id: string) => {
    await db.deleteTodo(id);
    // Update state immediately
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  // Backup & Restore Functions
  const handleExportData = async () => {
    try {
      const allMemories = await db.getAllMemories();
      const allTodos = await db.getAllTodos();
      const jerryAvatar = await db.getSetting('avatar_jerry');
      const claireAvatar = await db.getSetting('avatar_claire');

      const backupData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        memories: allMemories,
        todos: allTodos,
        settings: {
          avatar_jerry: jerryAvatar?.value || null,
          avatar_claire: claireAvatar?.value || null,
        }
      };

      const dataStr = JSON.stringify(backupData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `love-story-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert('✅ 备份成功！数据已下载到您的电脑。');
    } catch (error) {
      console.error('Export failed:', error);
      alert('❌ 备份失败，请重试。');
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    const text = await file.text();
    
    try {
      const backupData = JSON.parse(text);
      
      if (!backupData.memories || !backupData.todos) {
        throw new Error('Invalid backup file format');
      }

      // Confirm before importing
      const confirmed = window.confirm(
        `⚠️ 警告：导入数据将替换当前所有数据！\n\n` +
        `备份包含：\n` +
        `- ${backupData.memories.length} 个回忆\n` +
        `- ${backupData.todos.length} 个待办事项\n\n` +
        `确定要继续吗？`
      );

      if (!confirmed) {
        e.target.value = ''; // Reset input
        return;
      }

      // Clear existing data
      const allMemories = await db.getAllMemories();
      const allTodos = await db.getAllTodos();
      
      await Promise.all([
        ...allMemories.map(m => db.deleteMemory(m.id)),
        ...allTodos.map(t => db.deleteTodo(t.id))
      ]);

      // Import new data
      await Promise.all([
        ...backupData.memories.map((m: Memory) => db.saveMemory(m)),
        ...backupData.todos.map((t: TodoItem) => db.saveTodo(t))
      ]);

      // Restore avatars
      if (backupData.settings?.avatar_jerry) {
        await db.saveSetting('avatar_jerry', backupData.settings.avatar_jerry);
        setJerryImage(backupData.settings.avatar_jerry);
      }
      if (backupData.settings?.avatar_claire) {
        await db.saveSetting('avatar_claire', backupData.settings.avatar_claire);
        setClaireImage(backupData.settings.avatar_claire);
      }

      // Reload state
      setMemories(backupData.memories.sort((a: Memory, b: Memory) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
      setTodos(backupData.todos);

      alert('✅ 恢复成功！您的数据已恢复。');
      e.target.value = ''; // Reset input
    } catch (error) {
      console.error('Import failed:', error);
      alert('❌ 恢复失败：文件格式不正确或已损坏。');
      e.target.value = ''; // Reset input
    }
  };


  const NavButton = ({ target, icon: Icon, label }: { target: ViewState; icon: any; label: string }) => (
    <button
      onClick={() => setView(target)}
      className={`relative px-6 py-3 rounded-2xl flex items-center gap-2 transition-all duration-300 ${
        view === target 
          ? 'bg-white text-pink-500 shadow-md transform scale-105 font-bold' 
          : 'bg-white/50 text-gray-500 hover:bg-white/80 hover:text-pink-400'
      }`}
    >
      <Icon size={20} />
      <span className="hidden md:inline">{label}</span>
      {view === target && (
        <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-pink-500 rounded-full" />
      )}
    </button>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-pink-400 animate-spin" />
          <p className="text-pink-400 font-serif animate-pulse">正在加载爱的回忆...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg relative overflow-x-hidden pb-20">
      {/* Decorative Header Background */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-pink-100/40 to-transparent -z-10 pointer-events-none" />

      {/* Hero Section */}
      <div className="relative pt-12 pb-8 px-4 text-center">
        <div className="flex justify-center items-center gap-8 md:gap-16 mb-8 animate-fade-in-down">
          {/* Avatar 1: Jerry */}
          <div className="relative group cursor-pointer" onClick={() => jerryInputRef.current?.click()}>
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-white shadow-xl transform transition-transform group-hover:scale-105 relative">
              <img 
                src={jerryImage} 
                alt="Jerry" 
                className="w-full h-full object-cover object-center object-top bg-amber-50" 
                style={{ objectPosition: 'center top' }}
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="text-white w-8 h-8" />
              </div>
            </div>
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-sm text-xs font-bold text-gray-600">
              Jerry
            </div>
            <input 
              type="file" 
              ref={jerryInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={(e) => handleAvatarUpload(e, 'jerry')} 
            />
          </div>

          {/* Heart Animation */}
          <div className="relative">
             <Heart className="w-10 h-10 text-pink-500 fill-pink-500 animate-pulse drop-shadow-lg" />
             <div className="absolute top-0 left-0 w-full h-full animate-ping opacity-20">
               <Heart className="w-10 h-10 text-pink-500 fill-pink-500" />
             </div>
          </div>

          {/* Avatar 2: Claire */}
          <div className="relative group cursor-pointer" onClick={() => claireInputRef.current?.click()}>
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-white shadow-xl transform transition-transform group-hover:scale-105 relative">
              <img 
                src={claireImage} 
                alt="Claire" 
                className="w-full h-full object-cover object-center object-top bg-pink-50" 
                style={{ objectPosition: 'center top' }}
              />
               <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="text-white w-8 h-8" />
              </div>
            </div>
             <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-sm text-xs font-bold text-gray-600">
              Claire
            </div>
            <input 
              type="file" 
              ref={claireInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={(e) => handleAvatarUpload(e, 'claire')} 
            />
          </div>
        </div>

        <h1 className="text-2xl md:text-4xl font-bold text-gray-800 serif mb-2 tracking-wide">
          火爆粽子和寒冰坚果的爱情
        </h1>
        
        {/* Sync Status Indicator */}
        <div className="flex items-center justify-center gap-2 mt-2">
          {isSyncing ? (
            <>
              <Cloud className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-600">云端同步已开启</span>
            </>
          ) : (
            <>
              <CloudOff className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">仅本地存储</span>
            </>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4">
        
        {/* Navigation */}
        <div className="flex justify-center gap-4 mb-12 sticky top-4 z-50">
          <div className="p-1.5 bg-gray-100/80 backdrop-blur-md rounded-3xl flex gap-2 shadow-sm border border-white/50">
            <NavButton target={ViewState.HOME} icon={Home} label="首页" />
            <NavButton target={ViewState.GALLERY} icon={ImageIcon} label="相册" />
            <NavButton target={ViewState.TODO} icon={ListTodo} label="清单" />
            <NavButton target={ViewState.SETTINGS} icon={Settings} label="设置" />
          </div>
        </div>

        {/* Dynamic Content */}
        <div className="transition-all duration-500 ease-in-out">
          {view === ViewState.HOME && (
            <div className="space-y-8 animate-slide-up">
              {/* Timer Card */}
              <div className="bg-white rounded-[2.5rem] shadow-xl border border-white/60 p-2 md:p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-300" />
                <Timer startDate={START_DATE} />
              </div>

              {/* Dashboard Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div 
                  onClick={() => setView(ViewState.GALLERY)}
                  className="group bg-white p-8 rounded-3xl shadow-lg border border-gray-100 cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all"
                >
                  <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                    <ImageIcon className="text-blue-500" size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">爆甜瞬间</h3>
                  <p className="text-gray-500 text-sm">
                    已经有 {memories.length} 个和宝贝记录的瞬间啦
                  </p>
                </div>

                <div 
                  onClick={() => setView(ViewState.TODO)}
                  className="group bg-white p-8 rounded-3xl shadow-lg border border-gray-100 cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all"
                >
                  <div className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-pink-100 transition-colors">
                     <ListTodo className="text-pink-500" size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">愿望清单</h3>
                  <p className="text-gray-500 text-sm">
                    还有 {todos.filter(t => !t.completed).length} 想和宝贝一起做的事情
                  </p>
                </div>
              </div>
            </div>
          )}

          {view === ViewState.GALLERY && (
            <Gallery 
              memories={memories} 
              onUpload={handleFileUpload} 
              onDelete={handleDeleteMemory}
              onUpdate={handleUpdateMemory}
            />
          )}

          {view === ViewState.TODO && (
            <TodoList 
              todos={todos} 
              setTodos={(newVal) => {
                // Determine if it's an add, toggle, or delete op based on state diff 
                // Or easier: TodoList component should just use onAdd, onToggle, onDelete props.
                // But since I didn't change TodoList interface, I must infer or refactor TodoList.
                // REFACTORING TodoList to accept handlers is cleaner, but to stick to prompt "keep updates minimal",
                // I will modify TodoList to accept actions, or update it here.
                // Let's modify TodoList.tsx next to be safer.
                updateTodos(newVal);
              }} 
              // Passing extra props even if TodoList doesn't explicitly define them in interface yet
              // We will update TodoList interface in the next step.
              onAdd={handleAddTodo}
              onToggle={handleToggleTodo}
              onDelete={handleDeleteTodo}
            />
          )}

          {view === ViewState.SETTINGS && (
            <div className="max-w-3xl mx-auto w-full animate-slide-up">
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                <div className="p-8 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-100">
                  <h2 className="text-2xl font-bold text-gray-800 serif">数据备份与恢复</h2>
                  <p className="text-gray-500 text-sm mt-1">可千万别丢了</p>
                </div>

                <div className="p-8 space-y-6">
                  {/* Warning Box */}
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                    <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold mb-1">重要提示</p>
                      <p>所有数据（照片、视频、待办事项）都保存在浏览器本地。如果清除浏览器数据或更换设备，数据可能会丢失。建议定期备份！</p>
                    </div>
                  </div>

                  {/* Export Section */}
                  <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                      <Download className="text-blue-500" size={20} />
                      备份数据
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">
                      将所有回忆、待办事项和设置导出为 JSON 文件，保存到电脑。
                    </p>
                    <button
                      onClick={handleExportData}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Download size={18} />
                      下载备份文件
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      当前有 {memories.length} 个和宝贝记录的回忆，{todos.length} 个想和宝贝一起做的事情
                    </p>
                  </div>

                  {/* Import Section */}
                  <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                      <Upload className="text-green-500" size={20} />
                      恢复数据
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">
                      从之前导出的备份文件恢复所有数据。⚠️ 这将替换当前所有数据！
                    </p>
                    <label className="block">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportData}
                        className="hidden"
                      />
                      <div className="w-full bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer">
                        <Upload size={18} />
                        选择备份文件并恢复
                      </div>
                    </label>
                  </div>

                  {/* Storage Info */}
                  <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-3">存储位置</h3>
                    <div className="space-y-2 text-sm text-gray-700">
                      <p><strong>数据库名称：</strong> LoveStoryDB</p>
                      <p><strong>存储类型：</strong> IndexedDB (浏览器本地数据库)</p>
                      <p><strong>存储位置：</strong> 仅保存在当前浏览器和设备上</p>
                      <p className="text-xs text-gray-500 mt-3">
                        💡 提示：数据不会上传到任何服务器，完全私密。但请记得定期备份哦亲爱的宝子！
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-20 text-center text-gray-400 text-sm pb-8">
        <p>© 向往 我会一直喜欢你的 ~ 瑞瑞</p>
      </footer>
      
      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.6s ease-out forwards; }
        .animate-fade-in-down { animation: fade-in-down 0.8s ease-out forwards; }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
}

export default App;
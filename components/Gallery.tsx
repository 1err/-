import React, { useRef, useState } from 'react';
import { Plus, Image as ImageIcon, Film, Trash2, Edit2, Check, X } from 'lucide-react';
import { Memory } from '../types';

interface GalleryProps {
  memories: Memory[];
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { caption: string; date: string }) => void;
}

interface MemoryCardProps {
  memory: Memory;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { caption: string; date: string }) => void;
}

const MemoryCard: React.FC<MemoryCardProps> = ({ 
  memory, 
  onDelete, 
  onUpdate 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [caption, setCaption] = useState(memory.caption || '');
  const [date, setDate] = useState(() => {
    try {
      return new Date(memory.date).toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  });

  const handleSave = () => {
    const newDate = new Date(date);
    onUpdate(memory.id, { caption, date: newDate.toISOString() });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setCaption(memory.caption || '');
    setDate(new Date(memory.date).toISOString().split('T')[0]);
    setIsEditing(false);
  };

  return (
    <div className="break-inside-avoid bg-white p-3 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 group relative mb-6">
      <div className="relative overflow-hidden rounded-xl">
        {memory.type === 'image' ? (
          <img
            src={memory.url}
            alt="Memory"
            className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <video
            src={memory.url}
            controls
            className="w-full h-auto object-cover"
          />
        )}
        
        {/* Action Overlay */}
        {!isEditing && (
          <>
            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button 
                onClick={(e) => { e.preventDefault(); setIsEditing(true); }}
                className="bg-white/90 p-1.5 rounded-full text-gray-700 hover:text-blue-500 hover:bg-white shadow-sm transition-all"
                title="编辑"
              >
                <Edit2 size={14} />
              </button>
              <button 
                onClick={(e) => { e.preventDefault(); onDelete(memory.id); }}
                className="bg-white/90 p-1.5 rounded-full text-gray-700 hover:text-red-500 hover:bg-white shadow-sm transition-all"
                title="删除"
              >
                <Trash2 size={14} />
              </button>
            </div>
            
            <div className="absolute top-2 left-2 bg-white/80 backdrop-blur-sm p-1.5 rounded-full text-gray-600 pointer-events-none">
              {memory.type === 'image' ? <ImageIcon size={14} /> : <Film size={14} />}
            </div>
          </>
        )}
      </div>

      {isEditing ? (
        <div className="mt-3 space-y-3 animate-fade-in">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full text-sm border-b border-gray-300 focus:border-pink-500 outline-none py-1 bg-transparent placeholder-gray-400"
            placeholder="写点什么..."
            autoFocus
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 text-xs text-gray-500 border-b border-gray-300 focus:border-pink-500 outline-none py-1 bg-transparent"
            />
            <div className="flex gap-1">
              <button 
                onClick={handleSave} 
                className="text-green-600 hover:bg-green-50 p-1.5 rounded-md transition-colors"
              >
                <Check size={16} />
              </button>
              <button 
                onClick={handleCancel} 
                className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {memory.caption && (
            <p className="mt-3 text-gray-600 text-sm font-medium px-1 leading-snug">{memory.caption}</p>
          )}
          <p className="mt-1 text-gray-400 text-xs px-1 font-mono">
            {new Date(memory.date).toLocaleDateString()}
          </p>
        </>
      )}
    </div>
  );
};

export const Gallery: React.FC<GalleryProps> = ({ memories, onUpload, onDelete, onUpdate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 animate-slide-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 serif">甜蜜瞬间</h2>
          <p className="text-gray-500 text-sm mt-1">记录我们的点点滴滴</p>
        </div>
        <button
          onClick={handleTriggerUpload}
          className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white px-5 py-2.5 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95"
        >
          <Plus size={18} />
          <span className="font-medium">添加回忆</span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*,video/*"
          multiple
          onChange={onUpload}
        />
      </div>

      <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
        {memories.map((memory) => (
          <MemoryCard 
            key={memory.id} 
            memory={memory} 
            onDelete={onDelete} 
            onUpdate={onUpdate} 
          />
        ))}
      </div>

      {memories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 border-2 border-dashed border-gray-200 rounded-3xl bg-white/50">
          <ImageIcon size={48} className="mb-4 opacity-50" />
          <p>还没上传照片呢，快来填满我们的回忆！</p>
        </div>
      )}
    </div>
  );
};
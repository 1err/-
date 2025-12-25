export interface Memory {
  id: string;
  type: 'image' | 'video';
  url: string;
  caption?: string;
  date: string;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  notes?: string;
  category?: 'travel' | 'food' | 'activity' | 'life';
}

export enum ViewState {
  HOME = 'HOME',
  GALLERY = 'GALLERY',
  TODO = 'TODO',
  SETTINGS = 'SETTINGS',
}

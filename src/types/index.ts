export interface Category {
  id?: number;
  name: string;
  icon: string;       // lucide icon name, e.g. "folder", "globe"
  sortOrder: number;
  deletedAt?: Date;
}

export interface Project {
  id?: number;
  categoryId: number;
  name: string;
  description: string;
  createdAt: Date;
  deletedAt?: Date;
}

export interface Idea {
  id?: number;
  projectId: number;
  title: string;
  prompt: string;          // 可含变量占位符
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isFavorite?: boolean;
  deletedAt?: Date;
}

export interface Snapshot {
  id?: number;
  createdAt: Date;
  data: string;
}

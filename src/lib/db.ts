import Dexie from 'dexie';
import { Category, Project, Idea } from '../types';

export const db = new Dexie('SparkVault') as Dexie & {
  categories: Dexie.Table<Category, number>;
  projects: Dexie.Table<Project, number>;
  ideas: Dexie.Table<Idea, number>;
};

db.version(1).stores({
  categories: '++id, name, sortOrder',
  projects: '++id, categoryId, name, createdAt',
  ideas: '++id, projectId, title, createdAt, updatedAt, *tags',
});

import Dexie from 'dexie';
import { Category, Project, Idea, Snapshot, DailyState, EnergyAccount, Achievement, PkMatch } from '../types';

export const db = new Dexie('SparkVault') as Dexie & {
  categories: Dexie.Table<Category, number>;
  projects: Dexie.Table<Project, number>;
  ideas: Dexie.Table<Idea, number>;
  snapshots: Dexie.Table<Snapshot, number>;
  dailyState: Dexie.Table<DailyState, string>;
  energyAccount: Dexie.Table<EnergyAccount, number>;
  achievements: Dexie.Table<Achievement, string>;
  pkMatches: Dexie.Table<PkMatch, number>;
};

db.version(1).stores({
  categories: '++id, name, sortOrder',
  projects: '++id, categoryId, name, createdAt',
  ideas: '++id, projectId, title, createdAt, updatedAt, *tags',
});

db.version(2).stores({
  categories: '++id, name, sortOrder, deletedAt',
  projects: '++id, categoryId, name, createdAt, deletedAt',
  ideas: '++id, projectId, title, createdAt, updatedAt, *tags, isFavorite, deletedAt',
  snapshots: '++id, createdAt',
}).upgrade(async (trans) => {
  await trans.table('ideas').toCollection().modify((idea: any) => {
    if (idea.isFavorite === undefined) idea.isFavorite = false;
    if (idea.deletedAt === undefined) idea.deletedAt = undefined;
  });
  await trans.table('projects').toCollection().modify((project: any) => {
    if (project.deletedAt === undefined) project.deletedAt = undefined;
  });
  await trans.table('categories').toCollection().modify((category: any) => {
    if (category.deletedAt === undefined) category.deletedAt = undefined;
  });
});

db.version(3).stores({
  categories: '++id, name, sortOrder, deletedAt',
  projects: '++id, categoryId, name, createdAt, deletedAt',
  ideas: '++id, projectId, title, createdAt, updatedAt, *tags, isFavorite, deletedAt',
  snapshots: '++id, createdAt',
  dailyState: 'date',
  energyAccount: 'id',
  achievements: 'id',
  pkMatches: '++id, ideaAId, ideaBId, createdAt',
}).upgrade(async (trans) => {
  // 为既有灵感补全养成/PK 字段默认值（不覆盖已有值）
  await trans.table('ideas').toCollection().modify((idea: any) => {
    const createdAt = idea.createdAt instanceof Date ? idea.createdAt : new Date();
    if (idea.growthPoints === undefined) idea.growthPoints = 20;
    if (idea.growthLevel === undefined) idea.growthLevel = 2; // 20 分 → 嫩芽
    if (idea.growthUpdatedAt === undefined) idea.growthUpdatedAt = createdAt;
    if (idea.editCount === undefined) idea.editCount = 0;
    if (idea.copyCount === undefined) idea.copyCount = 0;
    if (idea.eloRating === undefined) idea.eloRating = 1000;
    if (idea.pkWins === undefined) idea.pkWins = 0;
    if (idea.pkLosses === undefined) idea.pkLosses = 0;
    if (idea.pkMatches === undefined) idea.pkMatches = 0;
  });
});

export const CURRENT_SCHEMA_VERSION = 3;

// 应用启动时清理超过 30 天的已删数据
async function cleanupTrash() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const cats = await db.categories.toArray();
    const expiredCats = cats.filter(c => c.deletedAt && new Date(c.deletedAt) <= thirtyDaysAgo);
    for (const cat of expiredCats) {
      const projects = await db.projects.where('categoryId').equals(cat.id!).toArray();
      const projectIds = projects.map(p => p.id!);
      if (projectIds.length > 0) {
        await db.ideas.where('projectId').anyOf(projectIds).delete();
      }
      await db.projects.where('categoryId').equals(cat.id!).delete();
    }
    await db.categories.bulkDelete(expiredCats.map(c => c.id!));

    const projs = await db.projects.toArray();
    const expiredProjs = projs.filter(p => p.deletedAt && new Date(p.deletedAt) <= thirtyDaysAgo);
    for (const proj of expiredProjs) {
      await db.ideas.where('projectId').equals(proj.id!).delete();
    }
    await db.projects.bulkDelete(expiredProjs.map(p => p.id!));

    const ideas = await db.ideas.toArray();
    const expiredIdeas = ideas.filter(i => i.deletedAt && new Date(i.deletedAt) <= thirtyDaysAgo);
    await db.ideas.bulkDelete(expiredIdeas.map(i => i.id!));
  } catch (e) {
    console.warn('[SparkVault] 回收站自动清理失败:', e);
  }
}
// 请求持久化存储，降低浏览器自动清理 IndexedDB 的风险
if (navigator.storage?.persist) {
  navigator.storage.persist().then(persisted => {
    if (persisted) {
      console.log('[SparkVault] 持久化存储已启用');
    } else {
      console.warn('[SparkVault] 持久化存储未获批准，数据可能被浏览器自动清理');
    }
  });
}

// 将收尾工作推迟到主线程空闲时执行，避免与首次启动的数据查询争抢 IndexedDB 连接、
// 拖慢首屏渲染。cleanupTrash 与 storage.persist 均非首屏必需。
function whenIdle(fn: () => void): void {
  const run = () => fn();
  if (typeof (window as any).requestIdleCallback === 'function') {
    (window as any).requestIdleCallback(run, { timeout: 3000 });
  } else {
    // requestIdleCallback 不可用时退化为 setTimeout 延后
    setTimeout(run, 1000);
  }
}

// 应用启动时清理超过 30 天的已删数据（延迟到空闲执行）
whenIdle(() => { cleanupTrash(); });

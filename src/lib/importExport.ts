import { db, CURRENT_SCHEMA_VERSION } from '@/lib/db';
import { Category, Project, Idea } from '@/types';
import { toast } from 'sonner';

interface BackupData {
  categories: Category[];
  projects: Project[];
  ideas: Idea[];
  exportedAt: string;
  schemaVersion?: number;
}

/** 快照保留上限 */
const MAX_SNAPSHOTS = 3;

/**
 * 导出全库为 JSON
 */
export async function exportAllData() {
  const data: BackupData = {
    categories: await db.categories.toArray(),
    projects: await db.projects.toArray(),
    ideas: await db.ideas.toArray(),
    exportedAt: new Date().toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spark-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  // 更新上次备份时间戳，供备份提醒功能使用
  try {
    localStorage.setItem('spark-vault-last-backup', String(Date.now()));
  } catch {
    // ignore
  }

  toast.success('数据已导出');
}

/**
 * 还原 Date 字段（JSON.parse 后 Date 变为 string）并补全缺失的默认值
 */
function restoreDataTypes(data: { categories: Category[]; projects: Project[]; ideas: Idea[] }) {
  for (const idea of data.ideas) {
    idea.createdAt = new Date(idea.createdAt as unknown as string);
    idea.updatedAt = new Date(idea.updatedAt as unknown as string);
    if (idea.isFavorite === undefined) idea.isFavorite = false;
  }
  for (const project of data.projects) {
    project.createdAt = new Date(project.createdAt as unknown as string);
  }
}

/**
 * 将当前全库数据序列化为 JSON 字符串
 */
async function serializeCurrentData(): Promise<string> {
  const data = {
    categories: await db.categories.toArray(),
    projects: await db.projects.toArray(),
    ideas: await db.ideas.toArray(),
  };
  return JSON.stringify(data);
}

/**
 * 创建一份快照并存入 _snapshots 表，同时清理超出上限的旧快照
 */
async function createSnapshot(): Promise<void> {
  const json = await serializeCurrentData();
  await db.snapshots.add({
    createdAt: new Date(),
    data: json,
  });
  // 保留最新的 MAX_SNAPSHOTS 份，删除多余的旧快照（FIFO）
  const all = await db.snapshots.orderBy('createdAt').reverse().toArray();
  if (all.length > MAX_SNAPSHOTS) {
    const toDelete = all.slice(MAX_SNAPSHOTS);
    await db.snapshots.bulkDelete(toDelete.map((s) => s.id!));
  }

  // 快照创建意味着数据已备份/恢复，更新备份时间戳
  try {
    localStorage.setItem('spark-vault-last-backup', String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * 获取所有快照（按时间倒序）
 */
export async function getSnapshots() {
  return db.snapshots.reverse().sortBy('createdAt');
}

/**
 * 从快照回滚：将当前数据恢复为快照内容
 */
export async function rollbackFromSnapshot(snapshotId: number) {
  try {
    const snapshot = await db.snapshots.get(snapshotId);
    if (!snapshot) {
      toast.error('快照不存在');
      return;
    }

    const data = JSON.parse(snapshot.data) as {
      categories: Category[];
      projects: Project[];
      ideas: Idea[];
    };

    restoreDataTypes(data);

    // 回滚前也创建一份当前数据的快照（防止回滚本身导致数据丢失）
    // 使用 flag 避免与 importAllData 中的快照逻辑冲突
    await createSnapshot();

    await db.transaction('rw', db.categories, db.projects, db.ideas, async () => {
      await db.categories.clear();
      await db.projects.clear();
      await db.ideas.clear();

      if (data.categories.length > 0) {
        await db.categories.bulkAdd(data.categories);
      }
      if (data.projects.length > 0) {
        await db.projects.bulkAdd(data.projects);
      }
      if (data.ideas.length > 0) {
        await db.ideas.bulkAdd(data.ideas);
      }
    });

    toast.success('已从快照回滚数据');
  } catch (error) {
    const message = error instanceof Error ? error.message : '回滚失败';
    toast.error(message);
  }
}

/**
 * 导入 JSON（校验 schema 后覆盖写入）
 * 导入前自动创建快照，以便回滚
 */
export async function importAllData(file: File) {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as BackupData;

    // 校验基本结构
    if (!data.categories || !data.projects || !data.ideas) {
      throw new Error('无效的备份文件格式');
    }

    // 导入前创建快照
    await createSnapshot();

    // 还原 Date 类型 + 补全默认值
    restoreDataTypes(data);

    // 版本迁移
    const backupVersion = data.schemaVersion ?? 1;
    if (backupVersion < CURRENT_SCHEMA_VERSION) {
      migrateBackupData(data, backupVersion);
    }

    // 清除现有数据并导入
    await db.transaction('rw', db.categories, db.projects, db.ideas, async () => {
      await db.categories.clear();
      await db.projects.clear();
      await db.ideas.clear();

      if (data.categories.length > 0) {
        await db.categories.bulkAdd(data.categories);
      }
      if (data.projects.length > 0) {
        await db.projects.bulkAdd(data.projects);
      }
      if (data.ideas.length > 0) {
        await db.ideas.bulkAdd(data.ideas);
      }
    });

    toast.success('数据导入成功，已创建快照，如有问题可在侧栏一键回滚');
  } catch (error) {
    const message = error instanceof Error ? error.message : '导入失败';
    toast.error(message);
  }
}

/**
 * 备份数据版本迁移
 */
function migrateBackupData(data: BackupData, fromVersion: number): void {
  // v1 → v2：补充 isFavorite、deletedAt 字段
  if (fromVersion < 2) {
    for (const idea of data.ideas) {
      if (idea.isFavorite === undefined) idea.isFavorite = false;
      if (idea.deletedAt === undefined) idea.deletedAt = undefined;
    }
    for (const project of data.projects) {
      if (project.deletedAt === undefined) project.deletedAt = undefined;
    }
    for (const category of data.categories) {
      if (category.deletedAt === undefined) category.deletedAt = undefined;
    }
  }
  // 未来 v2 → v3 迁移在此追加...
}

/**
 * 导出单项目为 Markdown
 */
export async function exportProjectMarkdown(projectId: number) {
  const project = await db.projects.get(projectId);
  if (!project) {
    toast.error('项目不存在');
    return;
  }

  const ideas = await db.ideas.where('projectId').equals(projectId).reverse().sortBy('createdAt');

  let md = `# ${project.name}\n\n`;
  md += `${project.description}\n\n`;
  md += `---\n\n`;

  for (const idea of ideas) {
    md += `## ${idea.title}\n\n`;
    md += `\`\`\`
${idea.prompt}
\`\`\`

`;
    if (idea.tags.length > 0) {
      md += `标签: ${idea.tags.map(t => `\`${t}\``).join(' ')}\n\n`;
    }
    md += `创建时间: ${new Date(idea.createdAt).toLocaleString()}\n\n`;
    md += `---\n\n`;
  }

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.md`;
  a.click();
  URL.revokeObjectURL(url);

  try {
    localStorage.setItem('spark-vault-last-backup', String(Date.now()));
  } catch {
    // ignore
  }

  toast.success('Markdown 已导出');
}

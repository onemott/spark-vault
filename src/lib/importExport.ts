import { db } from '@/lib/db';
import { Category, Project, Idea } from '@/types';
import { toast } from 'sonner';

interface BackupData {
  categories: Category[];
  projects: Project[];
  ideas: Idea[];
  exportedAt: string;
}

/**
 * 导出全库为 JSON
 */
export async function exportAllData() {
  const data: BackupData = {
    categories: await db.categories.toArray(),
    projects: await db.projects.toArray(),
    ideas: await db.ideas.toArray(),
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spark-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('数据已导出');
}

/**
 * 导入 JSON（校验 schema 后覆盖写入）
 */
export async function importAllData(file: File) {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as BackupData;

    // 校验基本结构
    if (!data.categories || !data.projects || !data.ideas) {
      throw new Error('无效的备份文件格式');
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

    toast.success('数据导入成功');
  } catch (error) {
    const message = error instanceof Error ? error.message : '导入失败';
    toast.error(message);
  }
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
  toast.success('Markdown 已导出');
}

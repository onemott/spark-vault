/**
 * 数据安全冒烟测试（Node + fake-indexeddb）
 * 验证：v2 备份迁移到 v3、导入/快照/回滚兼容新游戏表。
 * 运行：npx tsx scripts/migration-smoke.ts
 */
import './setup-env';
import { db, CURRENT_SCHEMA_VERSION } from '../src/lib/db';
import { importAllData, getSnapshots, rollbackFromSnapshot } from '../src/lib/importExport';

let pass = 0;
let fail = 0;
function assert(cond: unknown, msg: string) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${msg}`);
  } else {
    fail++;
    console.error(`  ❌ ${msg}`);
  }
}

function mockFile(json: unknown): File {
  return { text: async () => JSON.stringify(json) } as unknown as File;
}

async function reset() {
  await db.ideas.clear();
  await db.dailyState.clear();
  await db.energyAccount.clear();
  await db.achievements.clear();
  await db.pkMatches.clear();
  await db.categories.clear();
  await db.projects.clear();
  await db.snapshots.clear();
}

const v2Backup = {
  categories: [{ id: 1, name: '写作', icon: 'pen', sortOrder: 1 }],
  projects: [{ id: 1, categoryId: 1, name: '小红书', description: '', createdAt: new Date().toISOString() }],
  ideas: [
    {
      id: 1,
      projectId: 1,
      title: '旧灵感',
      prompt: '普通提示词',
      tags: ['a'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  exportedAt: new Date().toISOString(),
  schemaVersion: 2,
};

async function main() {
  console.log('== 数据安全冒烟测试 ==\n');

  assert(CURRENT_SCHEMA_VERSION === 3, 'CURRENT_SCHEMA_VERSION = 3');

  console.log('1) 导入 v2 备份 → 自动迁移到 v3');
  await reset();
  await importAllData(mockFile(v2Backup));
  const idea = await db.ideas.get(1);
  assert(idea?.growthPoints === 20 && idea?.growthLevel === 2, 'v2 灵感迁移后补全成长默认值（20/嫩芽）');
  assert(idea?.eloRating === 1000 && idea?.copyCount === 0, 'v2 灵感迁移后补全 PK/计数默认值');
  assert(typeof (await db.dailyState.count()) === 'number', 'dailyState 表可访问');
  assert(typeof (await db.pkMatches.count()) === 'number', 'pkMatches 表可访问');
  assert(typeof (await db.achievements.count()) === 'number', 'achievements 表可访问');
  assert((await db.energyAccount.count()) === 0, 'energyAccount 空数组导入正常');

  console.log('2) v3 备份（含游戏数据）导入 → 游戏数据完整还原');
  const v3Idea = {
    id: 1,
    projectId: 1,
    title: '旧灵感',
    prompt: '普通提示词',
    tags: ['a'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isFavorite: false,
    growthPoints: 20,
    growthLevel: 2,
    growthUpdatedAt: new Date().toISOString(),
    editCount: 0,
    copyCount: 0,
    eloRating: 1000,
    pkWins: 0,
    pkLosses: 0,
    pkMatches: 0,
  };
  const v3Backup = {
    categories: v2Backup.categories,
    projects: v2Backup.projects,
    ideas: [v3Idea],
    schemaVersion: 3,
    dailyState: [{ date: '2026-08-13', signedIn: true, consecutiveDays: 7, drawsUsed: 2, ideasCreated: 3, ideasEdited: 1, tagsAdded: 2, varsAdded: 1, ideasCopied: 1, pkVotes: 5, claimedRewards: ['create'] }],
    energyAccount: [{ id: 1, balance: 66, totalEarned: 100, totalSpent: 34 }],
    achievements: [{ id: 'growth_seed', unlockedAt: new Date().toISOString(), progress: 1 }],
    pkMatches: [{ ideaAId: 1, ideaBId: 2, winnerId: 1, aRatingBefore: 1000, bRatingBefore: 1000, aChange: 16, bChange: -16, createdAt: new Date().toISOString() }],
  };
  await reset();
  await importAllData(mockFile(v3Backup));
  const energy = await db.energyAccount.get(1);
  assert(energy?.balance === 66 && energy?.totalSpent === 34, '能量账户还原');
  const daily = await db.dailyState.get('2026-08-13');
  assert(daily?.consecutiveDays === 7 && daily?.pkVotes === 5, '每日状态还原');
  const ach = await db.achievements.get('growth_seed');
  assert(!!ach?.unlockedAt && ach.progress === 1, '成就还原（含 Date）');
  const pk = await db.pkMatches.toArray();
  assert(pk.length === 1 && pk[0].aChange === 16 && pk[0].createdAt instanceof Date, 'PK 对局还原（含 Date）');

  console.log('3) 快照回滚（含游戏数据）');
  // 当前 DB = B1（1 条灵感 + energy 66 + dailyState/ach/pk 已还原）
  // 再导入一份不同的 B2：B2 导入前会自动对「当前 B1 状态」建快照
  const b2 = {
    ...v3Backup,
    ideas: [
      {
        id: 1, projectId: 1, title: 'B2灵感', prompt: 'x', tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        growthPoints: 40, growthLevel: 2, growthUpdatedAt: new Date().toISOString(), editCount: 0, copyCount: 0,
        eloRating: 1000, pkWins: 0, pkLosses: 0, pkMatches: 0,
      },
    ],
    energyAccount: [{ id: 1, balance: 999, totalEarned: 999, totalSpent: 0 }],
  };
  await importAllData(mockFile(b2));
  const ideaAfterB2 = await db.ideas.get(1);
  assert(ideaAfterB2?.growthPoints === 40, '导入 B2 后成长值 40');
  const energyAfterB2 = await db.energyAccount.get(1);
  assert(energyAfterB2?.balance === 999, '导入 B2 后能量 999');

  // 回滚到「B1 状态」的快照（即 B2 导入前自动创建的最新快照）
  const snaps2 = await getSnapshots();
  assert(snaps2.length === 2, '两次导入共 2 份快照');
  const target = snaps2[0];
  assert(!!target, '存在可回滚的最新快照');
  await rollbackFromSnapshot(target.id!);
  const ideasRollback = await db.ideas.toArray();
  assert(ideasRollback.length === 1 && ideasRollback[0].growthPoints === 20, '回滚恢复 B1 的灵感（成长 20）');
  const energyRollback = await db.energyAccount.get(1);
  assert(energyRollback?.balance === 66, '回滚恢复 B1 的能量 66');
  const dailyRollback = await db.dailyState.get('2026-08-13');
  assert(dailyRollback?.signedIn === true && dailyRollback?.consecutiveDays === 7, '回滚恢复 B1 的每日状态');
  const achRollback = await db.achievements.get('growth_seed');
  assert(!!achRollback?.unlockedAt, '回滚恢复 B1 的成就');
  const pkRollback = await db.pkMatches.toArray();
  assert(pkRollback.length === 1, '回滚恢复 B1 的 PK 对局');

  console.log(`\n== 结果：通过 ${pass} 项，失败 ${fail} 项 ==`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('测试执行异常:', e);
  process.exit(1);
});

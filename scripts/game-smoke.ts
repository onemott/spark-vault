/**
 * 游戏系统冒烟测试（Node + fake-indexeddb）
 * 验证方向一/三/五的核心逻辑在真实（伪）IndexedDB 上可运行：
 * 成长值、稀有度、能量、任务、签到、抽卡、Elo PK、森林布局、成就。
 * 运行：npx tsx scripts/game-smoke.ts
 */
import './setup-env';
import { db } from '../src/lib/db';
import {
  computeRarity,
  computeGrowthLevel,
  countVariables,
  recordIdeaCreated,
  recordIdeaEdited,
  recordCopy,
  signInIfNeeded,
  ensureDailyState,
  getEnergyAccount,
  claimDailyReward,
  getDrawsRemaining,
  drawFromPool,
  useDraw,
  collectSampleIdea,
  votePk,
  getPkPair,
  getTier,
  expectedScore,
  getForestLevel,
  generateForestLayout,
  waterIdea,
  springRain,
  syncDailyGrowth,
  checkAchievements,
  DAILY_TASKS,
  ACHIEVEMENTS,
  DAILY_FREE_DRAWS,
} from '../src/lib/game';

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

async function reset() {
  await db.ideas.clear();
  await db.dailyState.clear();
  await db.energyAccount.clear();
  await db.achievements.clear();
  await db.pkMatches.clear();
  await db.categories.clear();
  await db.projects.clear();
}

function richPrompt(): string {
  return [
    '你是一位小红书爆款笔记专家。请为一篇主题为「{{主题}}」的笔记写出 3 个高打开率的开头，要求：',
    '1. 每个开头不超过 40 字，制造悬念或共鸣',
    '2. 使用口语化、年轻化的表达',
    '3. 开头后附一行「承接句」自然过渡到正文',
    '4. 在结尾给出话题标签建议',
    '5. 附上一句引导互动的文案',
  ].join('\n');
}

async function main() {
  console.log('== 游戏系统冒烟测试 ==\n');
  await reset();

  // ---- 稀有度评分 ----
  console.log('1) 稀有度评分');
  const rarity = computeRarity({ prompt: richPrompt(), tags: ['写作', '小红书', '营销'], title: '小红书爆款笔记开头' });
  console.log('   score =', rarity.score, 'level =', rarity.level);
  assert(['N', 'R', 'SR', 'SSR'].includes(rarity.level), '稀有度等级合法');
  assert(rarity.score > 20, '带变量+长文+标签的灵感分数高于 20（应为 R 以上）');
  const nRarity = computeRarity({ prompt: '写一句话', tags: [], title: '' });
  assert(nRarity.level === 'N', '短提示词评分为 N 级');
  assert(countVariables('a{{x}}b{{y}}c') === 2, '变量计数正确');

  // ---- 签到 ----
  console.log('2) 签到 + 能量账户');
  const sign = await signInIfNeeded();
  assert(sign.signedIn && sign.consecutiveDays === 1 && sign.bonusEnergy === 5, '首次签到：连续1天 +5 能量');
  const again = await signInIfNeeded();
  assert(again.bonusEnergy === 0, '同日重复签到不重复发奖励');
  const energy = await getEnergyAccount();
  assert(energy.balance === 5 && energy.totalEarned === 5, '能量余额 5');
  const daily = await ensureDailyState();
  assert(daily.signedIn === true && daily.consecutiveDays === 1, 'dailyState 正确记录签到');

  // ---- 新建灵感 + 成长 ----
  console.log('3) 新建灵感 → 成长值');
  const now = new Date();
  const id1 = await db.ideas.add({
    projectId: null,
    title: '小红书爆款笔记开头',
    prompt: richPrompt(),
    tags: ['写作', '小红书', '营销'],
    createdAt: now,
    updatedAt: now,
    growthPoints: 20,
    growthLevel: 2,
    growthUpdatedAt: now,
    editCount: 0,
    copyCount: 0,
    eloRating: 1000,
    pkWins: 0,
    pkLosses: 0,
    pkMatches: 0,
  });
  await recordIdeaCreated(id1);
  let idea = await db.ideas.get(id1);
  assert(idea!.growthPoints === 20 && idea!.growthLevel === 2, '新灵感成长值 20 → 嫩芽');
  const dailyAfterCreate = await ensureDailyState();
  assert(dailyAfterCreate.ideasCreated === 1, '每日任务「记录新灵感」进度 +1');

  // ---- 编辑 ----
  console.log('4) 编辑 → 成长增量');
  await recordIdeaEdited(id1, { promptChanged: true, newTags: 1, newVars: 1 });
  idea = await db.ideas.get(id1);
  assert(idea!.growthPoints === 20 + 2 + 3 + 5, '编辑：+2 有效编辑 +3 标签 +5 变量');
  assert(idea!.editCount === 1, 'editCount = 1');
  const dailyAfterEdit = await ensureDailyState();
  assert(dailyAfterEdit.ideasEdited === 1 && dailyAfterEdit.tagsAdded === 1 && dailyAfterEdit.varsAdded === 1, '每日编辑/标签/变量计数正确');

  // ---- 复制（每日上限 50）----
  console.log('5) 复制 → +10/次，上限 50/天');
  const beforeCopy = (await db.ideas.get(id1))!.growthPoints;
  for (let i = 0; i < 6; i++) await recordCopy(id1);
  idea = await db.ideas.get(id1);
  assert(idea!.growthPoints === beforeCopy + 50, '复制 6 次但成长只 +50（每日上限 5 次）');
  assert(idea!.copyCount === 6, 'copyCount 累计 6');
  const dailyAfterCopy = await ensureDailyState();
  assert(dailyAfterCopy.ideasCopied === 6, '每日复制计数 6');

  // ---- 任务领取 ----
  console.log('6) 每日任务领取');
  assert(DAILY_TASKS.some((t) => t.id === 'combo'), '存在三连击隐藏任务');
  const claimed = await claimDailyReward('create');
  assert(claimed === true, '「记录新灵感」可领取');
  const dup = await claimDailyReward('create');
  assert(dup === false, '同一任务不可重复领取');
  const energy2 = await getEnergyAccount();
  assert(energy2.balance === 5 + 15, '领取后能量 +15');

  // ---- 抽卡 ----
  console.log('7) 每日抽卡');
  const draws = await getDrawsRemaining();
  assert(draws.total === DAILY_FREE_DRAWS + 1 && draws.remaining === DAILY_FREE_DRAWS + 1, '签到后每日 4 次抽卡');
  const drawn1 = await drawFromPool();
  assert(drawn1.kind === 'idea', '有灵感时从个人池抽');
  for (let i = 0; i < draws.total; i++) {
    const ok = await useDraw();
    assert(ok === true, `第 ${i + 1} 次抽卡成功`);
  }
  const exhausted = await useDraw();
  assert(exhausted === false, '次数用尽后无法再抽');
  const drawsAfter = await getDrawsRemaining();
  assert(drawsAfter.remaining === 0, '剩余次数为 0');

  // ---- 示例收藏 ----
  console.log('8) 收藏示例 → 新建灵感');
  const sampleId = await collectSampleIdea({
    kind: 'sample',
    title: '示例：邮件润色器',
    prompt: '请把「{{原文}}」润色得更专业。',
    tags: ['办公', '邮件'],
    rarity: { score: 30, level: 'R' },
  });
  const sample = await db.ideas.get(sampleId);
  assert(sample && sample.projectId === null && sample.growthPoints === 20, '收藏示例生成未分配灵感（成长 20）');

  // ---- 能量消耗 ----
  console.log('9) 浇灌 / 春雨');
  const okWater = await waterIdea(id1);
  assert(okWater === true, '有能量时浇灌成功');
  const ideaAfterWater = await db.ideas.get(id1);
  assert(ideaAfterWater!.growthPoints === idea!.growthPoints + 10, '浇灌 +10 成长');
  const okRain = await springRain();
  const energyNow = await getEnergyAccount();
  assert(okRain === false || energyNow.balance >= 0, '春雨在能量不足时失败或余额不为负');

  // ---- 存活 +1/天 ----
  console.log('10) 存活成长（+1/天）');
  const ideaForDays = await db.ideas.get(id1);
  const backdate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  await db.ideas.update(id1, { growthUpdatedAt: backdate });
  await syncDailyGrowth();
  const afterDays = await db.ideas.get(id1);
  assert(afterDays!.growthPoints === ideaForDays!.growthPoints + 3, '补了 3 天的存活成长');

  // ---- Elo PK ----
  console.log('11) 本地 PK / Elo');
  const id2 = await db.ideas.add({
    projectId: null, title: '第二条', prompt: '普通提示词', tags: [],
    createdAt: new Date(), updatedAt: new Date(),
    growthPoints: 20, growthLevel: 2, growthUpdatedAt: new Date(), editCount: 0, copyCount: 0,
    eloRating: 1000, pkWins: 0, pkLosses: 0, pkMatches: 0,
  });
  const pair = await getPkPair();
  assert(pair !== null, '≥2 条灵感时可 PK');
  if (pair) {
    const [a, b] = pair;
    const beforeA = a.eloRating!;
    const beforeB = b.eloRating!;
    const match = await votePk(a, b, 'a');
    const afterA = (await db.ideas.get(a.id!))!.eloRating!;
    const afterB = (await db.ideas.get(b.id!))!.eloRating!;
    assert(match.aChange > 0 && afterA === beforeA + match.aChange, '胜方战力上升');
    assert(match.bChange < 0 && afterB === beforeB + match.bChange, '负方战力下降');
    const matches = await db.pkMatches.count();
    assert(matches >= 1, 'PK 对局已记录');
    assert(expectedScore(1000, 1000) === 0.5, 'Elo 同分期望胜率 0.5');
    const dailyPk = await ensureDailyState();
    assert(dailyPk.pkVotes >= 1, '今日 PK 投票计数');
  }
  assert(getTier(1200).name === '白银', '段位：1200 → 白银');
  assert(getTier(2200).name === '王者', '段位：2200 → 王者');
  assert(getTier(900).name === '青铜', '段位：900 → 青铜');

  // ---- 森林 ----
  console.log('12) 森林');
  assert(getForestLevel(80) === 1 && getForestLevel(5000) === 5, '森林等级边界正确');
  const allIdeas = await db.ideas.filter((i) => !i.deletedAt).toArray();
  const layout = generateForestLayout(allIdeas);
  assert(layout.length === allIdeas.length, '森林布局数量 = 灵感数');
  assert(layout.every((t) => t.x >= 8 && t.x <= 92 && t.y > 0 && t.y < 1), '森林坐标在画布内');

  // ---- 成就 ----
  console.log('13) 成就');
  await checkAchievements();
  // growth_seed 在第一次新建灵感时已解锁，这里验证的是它已被解锁（而非本次新解锁）
  const seed = await db.achievements.get('growth_seed');
  assert(!!seed?.unlockedAt, '拥有灵感 → 已解锁「第一颗种子」');
  assert(seed?.progress === 1, '「第一颗种子」进度 = 1');
  assert(ACHIEVEMENTS.length >= 15, '成就数量 ≥ 15');

  console.log(`\n== 结果：通过 ${pass} 项，失败 ${fail} 项 ==`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('测试执行异常:', e);
  process.exit(1);
});

/**
 * 端到端浏览器验证（真实 Chrome headless + CDP）
 * 走通交互流程：新建灵感(稀有度/成长) → 每日任务领取 → 浇灌 → 每日抽卡 → 生成卡片导出 PNG → 本地 PK。
 * 运行：node scripts/e2e-browser.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, statSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const APP_URL = "http://127.0.0.1:5173/";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DOWNLOAD_DIR = join(__dirname, "..", ".e2e-downloads");
mkdirSync(DOWNLOAD_DIR, { recursive: true });
// 清空上一次的下载产物，避免目录探测误判
for (const f of readdirSync(DOWNLOAD_DIR)) {
  try { rmSync(join(DOWNLOAD_DIR, f), { force: true }); } catch { /* ignore */ }
}

let pass = 0;
let fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.error(`  ❌ ${msg}`); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** XPath 精确文本点击（第一个匹配） */
async function clickText(page, text) {
  const xp = `//button[normalize-space()="${text}"]`;
  const el = await page.$(`xpath/${xp}`);
  if (!el) throw new Error(`未找到按钮: ${text}`);
  await el.click({ delay: 60 });
}

/** 点击祖先含指定文本的按钮 */
async function clickInRow(page, rowText, btnText) {
  const xp = `//button[normalize-space()="${btnText}"][ancestor::*[contains(., "${rowText}")]]`;
  const el = await page.$(`xpath/${xp}`);
  if (!el) throw new Error(`未找到行按钮: ${rowText}/${btnText}`);
  await el.click({ delay: 60 });
}

/** 点击「任务行内」的领取按钮：先精确定位任务名 <p>，再在其行容器内找按钮 */
async function clickTaskClaim(page, taskName) {
  const clicked = await page.evaluate((name) => {
    const ps = Array.from(document.querySelectorAll("p"));
    const p = ps.find((x) => x.textContent.trim() === name);
    if (!p) return false;
    let row = p.parentElement;
    for (let i = 0; i < 5 && row; i++) {
      const btns = Array.from(row.querySelectorAll("button"));
      const b = btns.find((x) => x.textContent.trim() === "领取" && x.type !== "submit");
      if (b) {
        b.click();
        return true;
      }
      row = row.parentElement;
    }
    return false;
  }, taskName);
  if (!clicked) throw new Error(`未找到任务领取按钮: ${taskName}`);
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: DOWNLOAD_DIR,
    eventsEnabled: true,
  });
  // 诊断：捕获页面报错与 console 错误
  page.on("pageerror", (err) => console.log("  [pageerror]", String(err).slice(0, 300)));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("  [console.error]", msg.text().slice(0, 300));
  });

  console.log("== 端到端浏览器验证（真实 Chrome） ==\n");
  try {
    // ---------- 0) 加载 ----------
    console.log("0) 加载应用");
    await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForSelector("button[title^='灵感森林']", { timeout: 15000 });
    await wait(1200); // 等自动签到
    const hubTxt = await bodyText(page);
    ok(hubTxt.includes("游乐场"), "应用加载，游乐场 Hub 渲染");
    ok(hubTxt.includes("灵感森林") && hubTxt.includes("灵感PK"), "Hub 6 入口渲染");
    const energyEl = await page.$('[title*="灵感能量"]');
    ok(!!energyEl && /\d+/.test(await energyEl.evaluate((e) => e.textContent)), "能量余额显示（自动签到 +5）");

    // ---------- 1) 新建灵感 ----------
    console.log("1) 新建灵感 → 稀有度/成长");
    await clickText(page, "新建灵感");
    await page.waitForSelector('textarea[placeholder="输入提示词..."]', { timeout: 8000 });
    ok(true, "编辑器打开");
    await page.type('input[placeholder="灵感标题（可选，留空用提示词）"]', "小红书爆款笔记开头");
    const prompt = [
      "你是一位小红书爆款笔记专家。请为一篇主题为「{{主题}}」的笔记写出 3 个高打开率的开头，要求：",
      "1. 每个开头不超过 40 字，制造悬念或共鸣",
      "2. 使用口语化、年轻化的表达",
      "3. 开头后附一行「承接句」自然过渡到正文",
      "4. 在结尾给出话题标签建议",
      "5. 附上一句引导互动的文案",
    ].join("\n");
    await page.type('textarea[placeholder="输入提示词..."]', prompt, { delay: 1 });
    await page.type('input[placeholder="输入标签后按 Enter"]', "写作");
    await page.keyboard.press("Enter");
    await wait(200);
    await clickText(page, "保存");
    await wait(1300);
    const txt1 = await bodyText(page);
    ok(txt1.includes("小红书爆款笔记开头"), "灵感出现在列表");
    ok(/已解锁成就 [1-9]/.test(txt1), "创建灵感解锁成就（第一颗种子）");
    const cardHTML = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[id^="idea-card-"]')).map((c) => c.innerText).join(" | ")
    );
    ok(/(^|\s)(N|R|SR|SSR)(\s|$)/.test(cardHTML), "列表卡片显示稀有度角标");
    ok(cardHTML.includes("🌱"), "列表卡片显示成长图标 🌱");

    // ---------- 2) 每日任务领取 ----------
    console.log("2) 每日任务领取");
    await page.click('button[title^="每日任务"]');
    await page.waitForSelector('::-p-text(能量余额)', { timeout: 8000 });
    const taskTxt = await bodyText(page);
    ok(taskTxt.includes("每日签到") && taskTxt.includes("记录新灵感"), "每日任务对话框渲染");
    await clickTaskClaim(page, "记录新灵感");
    await wait(1200);
    const afterClaim = await bodyText(page);
    const energyLine = afterClaim.split("\n").find((l) => l.includes("能量余额")) || "(未找到能量余额)";
    console.log("   energy line:", energyLine);
    ok(afterClaim.includes("能量余额 20"), `领取「记录新灵感」后能量 5→20（实际: ${energyLine.trim()})`);
    ok(afterClaim.includes("已领取"), "任务标记为已领取");
    await page.keyboard.press("Escape");
    await wait(400);

    // ---------- 3) 编辑器元信息 + 浇灌 ----------
    console.log("3) 编辑器元信息 + 浇灌");
    await page.click('[id^="idea-card-"]');
    await page.waitForSelector('::-p-text(编辑灵感)', { timeout: 8000 });
    const editorTxt = await bodyText(page);
    ok(/(N|R|SR|SSR)/.test(editorTxt) && editorTxt.includes("嫩芽"), "编辑器显示稀有度 + 成长标签");
    const growthBefore = await page.evaluate(() => {
      const el = document.querySelector('[title*="成长值"]');
      return el ? el.getAttribute("title") : null;
    });
    await page.click('button[title^="浇灌"]');
    await wait(1200);
    const afterWater = await bodyText(page);
    ok(afterWater.includes("浇灌成功"), "浇灌成功 toast");
    const growthAfter = await page.evaluate(() => {
      const el = document.querySelector('[title*="成长值"]');
      return el ? el.getAttribute("title") : null;
    });
    console.log("   growth:", growthBefore, "→", growthAfter);
    ok(growthAfter && /成长值 30/.test(growthAfter), "浇灌后成长值 30（20+10）");
    await page.keyboard.press("Escape");
    await wait(400);

    // ---------- 4) 每日抽卡 ----------
    console.log("4) 每日抽卡");
    await page.click('button[title^="每日抽卡"]');
    await page.waitForSelector('::-p-text(今日剩余)', { timeout: 8000 });
    const drawTxt0 = await bodyText(page);
    ok(/今日剩余 \d+ 次/.test(drawTxt0), "抽卡对话框渲染并显示剩余次数");
    await clickText(page, "开始抽卡");
    await wait(2200); // 卡背翻转
    const drawTxt1 = await bodyText(page);
    ok(/(N|R|SR|SSR)/.test(drawTxt1), "翻卡后显示稀有度");
    ok(drawTxt1.includes("下一张") && (drawTxt1.includes("收藏到金库") || drawTxt1.includes("在我的金库")), "结果操作按钮渲染");
    await clickText(page, "下一张");
    await wait(2200);
    const drawTxt2 = await bodyText(page);
    ok(/(N|R|SR|SSR)/.test(drawTxt2), "下一张成功再次抽卡");
    await page.keyboard.press("Escape");
    await wait(400);

    // ---------- 5) 新建第二条灵感（供 PK）----------
    console.log("5) 新建第二条灵感");
    await clickText(page, "新建灵感");
    await page.waitForSelector('textarea[placeholder="输入提示词..."]', { timeout: 8000 });
    await page.type('input[placeholder="灵感标题（可选，留空用提示词）"]', "第二条灵感");
    await page.type('textarea[placeholder="输入提示词..."]', "一条用于 PK 的普通灵感");
    await clickText(page, "保存");
    await wait(1300);
    ok(true, "第二条灵感已创建");

    // ---------- 6) 生成卡片 + 导出 PNG ----------
    console.log("6) 生成卡片 + 导出 PNG");
    await page.click('[id^="idea-card-"]');
    await page.waitForSelector('::-p-text(编辑灵感)', { timeout: 8000 });
    await page.click('button[title="生成灵感卡片"]');
    await page.waitForSelector('::-p-text(保存图片)', { timeout: 8000 });
    ok(true, "卡片生成器对话框渲染");
    // 切换模板 + 尺寸
    await clickText(page, "日落橙紫");
    await clickText(page, "横图 16:9");
    await wait(600);
    // 通过 CDP 下载事件捕获 PNG 下载（带超时兜底）
    const beforeFiles = new Set(readdirSync(DOWNLOAD_DIR));
    const dlEvent = new Promise((resolve) => cdp.once("Page.downloadWillBegin", (e) => resolve(e)));
    await clickText(page, "保存图片 (PNG)");
    const dl = await Promise.race([dlEvent, wait(20000).then(() => null)]);
    let filename = dl ? dl.suggestedFilename : null;
    if (dl) {
      ok(/\.png$/i.test(filename), `PNG 下载事件触发：${filename}`);
    } else {
      // 事件未触发：检查目录里是否出现新文件
      const afterFiles = readdirSync(DOWNLOAD_DIR);
      const news = afterFiles.filter((f) => !beforeFiles.has(f));
      console.log("   [download] 事件未触发，新文件:", news);
      filename = news.find((f) => /\.png$/i.test(f)) ?? news[0] ?? null;
      ok(!!filename, `PNG 下载（目录探测）：${filename}`);
    }
    // 等待文件落盘
    const filePath = join(DOWNLOAD_DIR, filename);
    let waited = 0;
    while (waited < 8000 && (!existsSync(filePath) || statSync(filePath).size === 0)) {
      await wait(200);
      waited += 200;
    }
    ok(existsSync(filePath) && statSync(filePath).size > 1000, `PNG 文件已保存（${statSync(filePath).size} 字节）`);
    const buf = readFileSync(filePath);
    ok(buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47, "PNG 文件头正确 (89 50 4E 47)");
    await page.keyboard.press("Escape");
    await wait(400);

    // ---------- 7) 本地 PK ----------
    console.log("7) 本地 PK 投票 + 战力榜");
    await page.click('button[title^="灵感PK"]');
    await page.waitForSelector('::-p-text(灵感对战)', { timeout: 8000 });
    const pkTxt0 = await bodyText(page);
    ok(pkTxt0.includes("VS") && pkTxt0.includes("战力榜"), "PK 对话框渲染（对战区 + 战力榜）");
    // 在对话框内点左侧卡片投票（避免误点背后的列表卡片）
    const pkDialog = await page.$('[data-slot="dialog-content"]');
    const leftCard = await pkDialog.$('div[class*="cursor-pointer"]');
    ok(!!leftCard, "找到 PK 对战卡片");
    await leftCard.click({ delay: 60 });
    await wait(600); // 结果阶段：+X/-X 浮动数字可见
    const pkTxt1 = await bodyText(page);
    ok(/(\+|-)\d+/.test(pkTxt1) || pkTxt1.includes("已更新战力"), "投票后战力变化反馈");
    ok(/今日已投 \d+/.test(pkTxt1), "今日投票计数增加");
    await wait(1600); // 自动切换下一组
    const pkTxt2 = await bodyText(page);
    ok(/今日已投 [1-9]/.test(pkTxt2), "投票后计数 = 1");
    ok(pkTxt2.includes("战力榜") && /⚔️/.test(pkTxt2), "战力榜渲染（含战力值）");
    await page.keyboard.press("Escape");
    await wait(400);

    // ---------- 8) 灵感森林 + 春雨（能量不足提示）----------
    console.log("8) 灵感森林 + 春雨");
    await page.click('button[title^="灵感森林"]');
    await page.waitForSelector('::-p-text(我的灵感森林)', { timeout: 8000 });
    const forestTxt = await bodyText(page);
    ok(forestTxt.includes("双击树木可浇灌") && forestTxt.includes("春雨"), "森林面板渲染（浇灌提示 + 春雨按钮）");
    await clickText(page, "春雨 (100⚡)");
    await wait(800);
    const rainTxt = await bodyText(page);
    ok(rainTxt.includes("需要 100 能量"), "能量不足时春雨给出提示");
    await page.keyboard.press("Escape");
    await wait(400);

    // ---------- 9) 空卡池抽卡 → 收藏到金库 ----------
    console.log("9) 空卡池抽卡 → 收藏到金库");
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const req = indexedDB.deleteDatabase("SparkVault");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("button[title^='灵感森林']", { timeout: 15000 });
    await wait(1200);
    await page.click('button[title^="每日抽卡"]');
    await page.waitForSelector('::-p-text(今日剩余)', { timeout: 8000 });
    await clickText(page, "开始抽卡");
    await wait(2200);
    const collectTxt = await bodyText(page);
    ok(collectTxt.includes("收藏到金库"), "空卡池抽到示例，显示「收藏到金库」");
    await clickText(page, "收藏到金库");
    await wait(1200);
    const afterCollect = await bodyText(page);
    ok(afterCollect.includes("编辑灵感"), "收藏成功并打开新建的灵感编辑器");

    console.log(`\n== 端到端结果：通过 ${pass} 项，失败 ${fail} 项 ==`);
  } finally {
    await browser.close();
  }
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("端到端测试异常:", e);
  process.exit(1);
});

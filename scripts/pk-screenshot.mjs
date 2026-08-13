/** 快速截图：打开灵感PK并截图，用于检查渲染出界 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const APP_URL = "http://localhost:5173/";
const CHROME = require("node:path").join("C:", "Program Files", "Google", "Chrome", "Application", "chrome.exe");
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", ".e2e-downloads");
mkdirSync(OUT_DIR, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,800"],
    defaultViewport: { width: 1280, height: 800 },
  });
  const page = await browser.newPage();
  page.on("pageerror", (err) => console.log("[pageerror]", String(err).slice(0, 300)));

  await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForSelector("button[title^='灵感森林']", { timeout: 15000 });
  await wait(1200);

  // 关掉备份提醒（如果有）
  try {
    const dismissBtn = await page.$('::-p-text(稍后提醒)');
    if (dismissBtn) { await dismissBtn.click(); await wait(400); }
  } catch {}

  // 造两条灵感以便 PK 有内容
  async function createIdea(title, prompt) {
    const newBtn = await page.$('::-p-text(新建灵感)');
    if (newBtn) { await newBtn.click(); }
    await page.waitForSelector('textarea[placeholder="输入提示词..."]', { timeout: 8000 });
    await page.type('input[placeholder="灵感标题（可选，留空用提示词）"]', title);
    await page.type('textarea[placeholder="输入提示词..."]', prompt, { delay: 1 });
    // 点击保存按钮
    const saveBtns = await page.$$('::-p-text(保存)');
    for (const b of saveBtns) {
      const t = await b.evaluate(e => e.textContent.trim());
      if (t === "保存") { await b.click(); break; }
    }
    await wait(1200);
  }

  await createIdea(
    "这是一个比较长的灵感标题用来测试截断是否正常工作会不会出界",
    "这是一段很长的提示词内容。" + "重复内容".repeat(30) + "\n换行测试\n再来一行"
  );
  await createIdea(
    "短标题",
    "另一条灵感的提示词，也用于 PK 测试。包含一些长长的句子用来验证 line-clamp 是否真的起作用，不会把卡片撑得太高。"
  );

  // 打开灵感PK
  await page.click('button[title^="灵感PK"]');
  await page.waitForSelector('::-p-text(灵感对战)', { timeout: 8000 });
  await wait(800);

  // 截取 PK 对话框
  const dialog = await page.$('[data-slot="dialog-content"]');
  if (dialog) {
    const box = await dialog.boundingBox();
    console.log("Dialog bounding box:", box);
    const screenshot = await dialog.screenshot({ type: "png" });
    const outPath = join(OUT_DIR, "pk-dialog.png");
    writeFileSync(outPath, screenshot);
    console.log("PK 对话框截图已保存到:", outPath);

    // 也检查各元素的宽度是否超出对话框
    const overflowInfo = await page.evaluate(() => {
      const dialogEl = document.querySelector('[data-slot="dialog-content"]');
      if (!dialogEl) return null;
      const dialogRect = dialogEl.getBoundingClientRect();
      const overflow = [];
      const all = dialogEl.querySelectorAll('*');
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.right > dialogRect.right + 0.5 || r.left < dialogRect.left - 0.5) {
          overflow.push({
            tag: el.tagName,
            cls: el.className.slice(0, 80),
            left: Math.round(r.left - dialogRect.left),
            right: Math.round(r.right - dialogRect.left),
            width: Math.round(r.width),
            overshoot: Math.max(0, r.right - dialogRect.right, dialogRect.left - r.left).toFixed(1),
          });
        }
      }
      return { dialogWidth: dialogRect.width, overflowCount: overflow.length, samples: overflow.slice(0, 10) };
    });
    console.log("\n溢出检测:", JSON.stringify(overflowInfo, null, 2));
  } else {
    console.log("未找到 dialog-content");
  }

  // 再测一次窄屏（400px 宽，模拟手机）
  await page.setViewport({ width: 400, height: 800 });
  await wait(300);
  const dialog2 = await page.$('[data-slot="dialog-content"]');
  if (dialog2) {
    const screenshot2 = await dialog2.screenshot({ type: "png" });
    const outPath2 = join(OUT_DIR, "pk-dialog-narrow.png");
    writeFileSync(outPath2, screenshot2);
    console.log("\n窄屏截图已保存到:", outPath2);

    const overflowNarrow = await page.evaluate(() => {
      const dialogEl = document.querySelector('[data-slot="dialog-content"]');
      if (!dialogEl) return null;
      const dialogRect = dialogEl.getBoundingClientRect();
      const overflow = [];
      const all = dialogEl.querySelectorAll('*');
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.right > dialogRect.right + 0.5 || r.left < dialogRect.left - 0.5) {
          overflow.push({
            tag: el.tagName,
            cls: el.className.slice(0, 60),
            rightOverflow: (r.right - dialogRect.right).toFixed(1),
            leftOverflow: (dialogRect.left - r.left).toFixed(1),
          });
        }
      }
      return { dialogWidth: dialogRect.width, overflowCount: overflow.length, samples: overflow.slice(0, 15) };
    });
    console.log("窄屏溢出检测:", JSON.stringify(overflowNarrow, null, 2));
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });

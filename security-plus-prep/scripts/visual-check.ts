// Real-browser visual check for the redesign. Screenshots every route at
// two viewports, and reports the things a route-200 check can't catch:
// scroll where there shouldn't be any, clipped text, console errors,
// failed requests, and (home page only) the objective-tile count/labels.
//
// Usage:
//   npx dotenv-cli -c -- npx tsx scripts/visual-check.ts            # against production
//   npx dotenv-cli -c -- npx tsx scripts/visual-check.ts --local    # against http://localhost:3000
//   npx dotenv-cli -c -- npx tsx scripts/visual-check.ts --base=https://foo.vercel.app

import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const ROUTES = ['/', '/learn', '/practice', '/profile', '/study', '/topics/2.4', '/library'] as const;

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '390x844', width: 390, height: 844 },
] as const;

const VALID_OBJECTIVES = new Set([
  '1.1', '1.2', '1.3', '1.4',
  '2.1', '2.2', '2.3', '2.4', '2.5',
  '3.1', '3.2', '3.3', '3.4',
  '4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8', '4.9',
  '5.1', '5.2', '5.3', '5.4', '5.5', '5.6',
]);

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots');

function routeSlug(route: string): string {
  return route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-');
}

interface ClippedElement {
  selector: string;
  text: string;
}

interface RouteReport {
  route: string;
  viewport: string;
  screenshotPath: string;
  consoleErrors: string[];
  failedRequests: string[];
  verticalScroll: boolean;
  horizontalScroll: boolean;
  clippedElements: ClippedElement[];
  tileCount?: number;
  tileLabels?: string[];
  invalidTiles?: string[];
}

async function measurePage(page: Page): Promise<{
  verticalScroll: boolean;
  horizontalScroll: boolean;
  clippedElements: ClippedElement[];
  tileCount?: number;
  tileLabels?: string[];
}> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const verticalScroll = doc.scrollHeight > window.innerHeight + 1; // +1 to tolerate subpixel rounding
    const horizontalScroll = doc.scrollWidth > window.innerWidth + 1;

    const clippedElements: { selector: string; text: string }[] = [];
    const all = document.querySelectorAll<HTMLElement>('*');
    for (const el of Array.from(all)) {
      const style = getComputedStyle(el);
      const overflowsHidden = style.overflow === 'hidden' || style.overflowX === 'hidden';
      if (overflowsHidden && el.scrollWidth > el.clientWidth + 1 && el.textContent && el.textContent.trim().length > 0) {
        const cls = el.className && typeof el.className === 'string' ? `.${el.className.split(' ').filter(Boolean).join('.')}` : '';
        const selector = `${el.tagName.toLowerCase()}${cls}`;
        clippedElements.push({ selector, text: el.textContent.trim().slice(0, 60) });
      }
    }

    const tiles = document.querySelectorAll<HTMLElement>('.tile');
    const tileCount = tiles.length > 0 ? tiles.length : undefined;
    const tileLabels = tiles.length > 0 ? Array.from(tiles).map((t) => t.textContent?.trim() ?? '') : undefined;

    return { verticalScroll, horizontalScroll, clippedElements: clippedElements.slice(0, 20), tileCount, tileLabels };
  });
}

async function main() {
  const args = process.argv.slice(2);
  const localFlag = args.includes('--local');
  const baseArg = args.find((a) => a.startsWith('--base='));
  const baseUrl = baseArg ? baseArg.slice('--base='.length) : localFlag ? 'http://localhost:3000' : 'https://security-certification.vercel.app';

  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  console.log(`Visual check against ${baseUrl}\n`);

  const browser = await chromium.launch();
  const reports: RouteReport[] = [];

  for (const route of ROUTES) {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();

      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
      page.on('requestfailed', (req) => {
        failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText ?? 'unknown'}`);
      });

      const url = `${baseUrl}${route}`;
      console.log(`Checking ${route} @ ${viewport.name} (${url})...`);

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      } catch (err) {
        console.log(`  NAVIGATION FAILED: ${(err as Error).message}`);
        await context.close();
        continue;
      }

      await page.waitForTimeout(300); // let any client-side hydration settle

      const measurements = await measurePage(page);

      const screenshotFile = `${routeSlug(route)}-${viewport.name}.png`;
      const screenshotPath = path.join(SCREENSHOT_DIR, screenshotFile);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      let invalidTiles: string[] | undefined;
      if (route === '/' && measurements.tileLabels) {
        invalidTiles = measurements.tileLabels.filter((label) => !VALID_OBJECTIVES.has(label));
      }

      reports.push({
        route,
        viewport: viewport.name,
        screenshotPath,
        consoleErrors,
        failedRequests,
        verticalScroll: measurements.verticalScroll,
        horizontalScroll: measurements.horizontalScroll,
        clippedElements: measurements.clippedElements,
        tileCount: measurements.tileCount,
        tileLabels: measurements.tileLabels,
        invalidTiles,
      });

      await context.close();
    }
  }

  await browser.close();

  console.log('\n\n========== REPORT ==========\n');
  for (const r of reports) {
    console.log(`--- ${r.route} @ ${r.viewport} ---`);
    console.log(`  Screenshot: ${r.screenshotPath}`);
    console.log(`  Vertical scroll: ${r.verticalScroll}${r.route === '/' && r.verticalScroll ? '  <-- SHOULD BE FALSE ON HOME' : ''}`);
    console.log(`  Horizontal scroll: ${r.horizontalScroll}${r.horizontalScroll ? '  <-- SHOULD ALWAYS BE FALSE' : ''}`);
    console.log(`  Console errors: ${r.consoleErrors.length}`);
    r.consoleErrors.forEach((e) => console.log(`    - ${e}`));
    console.log(`  Failed requests: ${r.failedRequests.length}`);
    r.failedRequests.forEach((f) => console.log(`    - ${f}`));
    console.log(`  Clipped elements: ${r.clippedElements.length}`);
    r.clippedElements.forEach((c) => console.log(`    - ${c.selector}: "${c.text}"`));
    if (r.tileCount !== undefined) {
      console.log(`  Objective tiles: ${r.tileCount}${r.tileCount !== 28 ? '  <-- SHOULD BE EXACTLY 28' : ''}`);
      if (r.invalidTiles && r.invalidTiles.length > 0) {
        console.log(`  INVALID tile labels (outside official 28): ${r.invalidTiles.join(', ')}`);
      }
    }
    console.log('');
  }

  const anyHomeScroll = reports.some((r) => r.route === '/' && r.verticalScroll);
  const anyHScroll = reports.some((r) => r.horizontalScroll);
  const anyBadTileCount = reports.some((r) => r.tileCount !== undefined && r.tileCount !== 28);
  const anyErrors = reports.some((r) => r.consoleErrors.length > 0 || r.failedRequests.length > 0);
  const anyClipped = reports.some((r) => r.clippedElements.length > 0);

  console.log('========== SUMMARY ==========');
  console.log(`Home vertical scroll present: ${anyHomeScroll}`);
  console.log(`Any horizontal scroll present: ${anyHScroll}`);
  console.log(`Any tile count != 28: ${anyBadTileCount}`);
  console.log(`Any console errors / failed requests: ${anyErrors}`);
  console.log(`Any clipped elements detected: ${anyClipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

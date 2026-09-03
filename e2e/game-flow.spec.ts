import { expect, test, type Page, type TestInfo } from '@playwright/test';

const PLAYER_FIXTURE = 'public/assets/images/characters/player/default_player.png';
const ENEMY_FIXTURES = [
  'public/assets/images/backgrounds/opening_mirror_supertile.png',
  'public/assets/images/backgrounds/gameplay_mirror_supertile.png',
];

function collectSeriousErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

function collectMediaRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (/\.(?:ogg|mp3)(?:$|\?)/.test(request.url())) requests.push(request.url());
  });
  return requests;
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}

async function expectPortraitFrame(page: Page): Promise<void> {
  const frame = await page.locator('.portrait-frame').boundingBox();
  expect(frame).not.toBeNull();
  if (frame) expect(Math.abs(frame.width / frame.height - 9 / 16)).toBeLessThan(0.002);
}

async function reachQuestionTwo(page: Page): Promise<void> {
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('question-1')).toBeVisible();
  await page.getByTestId('q1-yes').click();
  await expect(page.getByTestId('question-2')).toBeVisible();
}

async function reachSecretCode(page: Page): Promise<void> {
  await reachQuestionTwo(page);
  await page.getByTestId('q2-yes').click();
  await expect(page.getByTestId('secret-code-screen')).toBeVisible();
}

async function authorize(page: Page): Promise<void> {
  await reachSecretCode(page);
  await page.getByTestId('secret-code-input').fill(' basic ');
  await page.getByTestId('secret-code-submit').click();
  await expect(page.getByTestId('customization-screen')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('opening-screen')).toBeVisible();
  await expectPortraitFrame(page);
});

test('opening and rejected path never initialize gameplay', async ({ page }, testInfo) => {
  const errors = collectSeriousErrors(page);
  await capture(page, testInfo, '01-opening');
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('question-1')).toBeVisible();
  await capture(page, testInfo, '02-question-one');
  await page.getByTestId('q1-yes').click();
  await expect(page.getByTestId('question-2')).toBeVisible();
  await capture(page, testInfo, '02-question-two');
  await page.getByTestId('q2-no').click();
  await expect(page.getByTestId('rejected-screen')).toBeVisible();
  await expect(page.getByTestId('game-canvas')).toHaveCount(0);
  await capture(page, testInfo, '03-rejected');
  await page.getByTestId('rejected-return').click();
  await expect(page.getByTestId('opening-screen')).toBeVisible();
  expect(errors).toEqual([]);
});

test('authorized default flow validates code, runs, pauses, ends, retries, and returns home', async ({ page }, testInfo) => {
  test.slow();
  const errors = collectSeriousErrors(page);
  const mediaRequests = collectMediaRequests(page);
  await reachSecretCode(page);
  await expect.poll(() => mediaRequests.some((url) => url.includes('start_voice_leon'))).toBe(true);
  await expect.poll(() => mediaRequests.some((url) => url.includes('opening_music'))).toBe(true);

  await page.getByTestId('secret-code-input').fill('Basic');
  await page.getByTestId('secret-code-submit').click();
  await expect(page.getByRole('alert')).toContainText('Incorrect code');
  await expect(page.getByTestId('secret-code-screen')).toBeVisible();
  await capture(page, testInfo, '04-secret-code-failure');

  await page.getByTestId('secret-code-input').fill('basic');
  await page.getByTestId('secret-code-submit').click();
  await expect(page.getByTestId('customization-screen')).toBeVisible();
  await capture(page, testInfo, '05-customization-default');

  await page.getByTestId('enter-arena').click();
  await expect(page.getByTestId('game-canvas')).toBeVisible({ timeout: 15_000 });
  const [frameBox, canvasBoxAtStart] = await Promise.all([
    page.locator('.portrait-frame').boundingBox(),
    page.getByTestId('game-canvas').boundingBox(),
  ]);
  expect(frameBox).not.toBeNull();
  expect(canvasBoxAtStart).not.toBeNull();
  if (frameBox && canvasBoxAtStart) {
    // Desktop frames have a one-pixel border on each edge; the rendered
    // canvas must otherwise occupy the full 9:16 content box.
    expect(Math.abs(canvasBoxAtStart.width - frameBox.width)).toBeLessThan(2.5);
    expect(Math.abs(canvasBoxAtStart.height - frameBox.height)).toBeLessThan(2.5);
  }
  await expect(page.getByTestId('game-hud')).toContainText('HP 100');
  await expect.poll(() => mediaRequests.some((url) => url.includes('gameplay_music'))).toBe(true);
  await capture(page, testInfo, '06-default-gameplay');

  const canvasBox = await page.getByTestId('game-canvas').boundingBox();
  expect(canvasBox).not.toBeNull();
  if (canvasBox) {
    const fireX = canvasBox.x + canvasBox.width * 0.72;
    const fireY = canvasBox.y + canvasBox.height * 0.18;
    if (testInfo.project.name.startsWith('mobile-')) {
      await page.touchscreen.tap(fireX, fireY);
      await page.waitForTimeout(250);
    } else {
      await page.mouse.move(fireX, fireY);
      await page.mouse.down();
      await page.waitForTimeout(550);
      await page.mouse.up();
    }
    await capture(page, testInfo, '06-shooting');
  }
  await expect.poll(() => mediaRequests.some((url) => url.includes('/shoot.'))).toBe(true);

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('pause-overlay')).toHaveCount(0);

  await page.getByTestId('pause-game').click();
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  await capture(page, testInfo, '06-pause');
  await page.getByTestId('resume-game').click();
  await expect(page.getByTestId('pause-overlay')).toHaveCount(0);

  await expect(page.getByTestId('game-hud')).not.toContainText('HP 100', { timeout: 25_000 });
  await capture(page, testInfo, '07-damaged-player');
  await expect(page.getByTestId('game-over-screen')).toBeVisible({ timeout: 35_000 });
  await expect.poll(() => mediaRequests.some((url) => /player_voice_(?:jimmy|zac)/.test(url))).toBe(true);
  await expect(page.getByText('Defeated', { exact: true })).toBeVisible();
  await expect(page.getByText('Survived', { exact: true })).toBeVisible();
  await capture(page, testInfo, '08-game-over');

  if (testInfo.project.name === 'chromium-desktop') {
    await page.getByTestId('change-characters').click();
    await expect(page.getByTestId('customization-screen')).toBeVisible();
    await expect(page.getByTestId('game-canvas')).toHaveCount(0);
    await page.getByTestId('enter-arena').click();
    await expect(page.getByTestId('game-over-screen')).toBeVisible({ timeout: 35_000 });
    await page.getByTestId('retry-game').click();
    await expect(page.getByTestId('game-over-screen')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId('game-hud')).toContainText('HP 100');
    await expect(page.getByTestId('game-canvas')).toHaveCount(1);
    await capture(page, testInfo, '09-retry');
    await page.getByTestId('pause-game').click();
    await page.getByRole('button', { name: 'Main menu' }).click();
  } else {
    await page.getByTestId('gameover-main-menu').click();
  }
  await expect(page.getByTestId('opening-screen')).toBeVisible();
  await expect(page.getByTestId('game-canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('custom player and multiple enemies persist across reload and render in the arena', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Persistence journey runs once; responsive projects cover the default flow.');
  const errors = collectSeriousErrors(page);
  await authorize(page);

  await page.getByTestId('upload-player').setInputFiles(PLAYER_FIXTURE);
  await expect(page.getByTestId('crop-editor')).toBeVisible();
  await page.getByTestId('save-upload').click();
  await expect(page.locator('.preview-row img')).toHaveCount(2);

  await page.getByTestId('upload-enemy').setInputFiles(ENEMY_FIXTURES);
  await page.getByTestId('save-upload').click();
  await expect(page.getByTestId('save-upload')).toBeEnabled();
  await page.getByTestId('save-upload').click();
  await expect(page.locator('.enemy-roster input:checked')).toHaveCount(2);
  await capture(page, testInfo, '09-custom-roster');

  await page.reload();
  await expect(page.getByTestId('opening-screen')).toBeVisible();
  await authorize(page);
  await expect(page.locator('.preview-row img')).toHaveCount(2);
  await expect(page.locator('.enemy-roster input:checked')).toHaveCount(2);

  await page.getByTestId('enter-arena').click();
  await expect(page.getByTestId('game-canvas')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1_600);
  await capture(page, testInfo, '10-custom-gameplay');
  expect(errors).toEqual([]);
});

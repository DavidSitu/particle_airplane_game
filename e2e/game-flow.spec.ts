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

async function openGame(page: Page): Promise<void> {
  // Stabilize only the Date.now call immediately following the app's session
  // UUID creation. Phaser still receives a live clock and production code gets
  // no test hook.
  await page.addInitScript(() => {
    const nativeNow = Date.now.bind(Date);
    const nativeUuid = crypto.randomUUID.bind(crypto);
    let nextNowIsRunSeed = false;
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: (): `${string}-${string}-${string}-${string}-${string}` => {
        nextNowIsRunSeed = true;
        return nativeUuid();
      },
    });
    Date.now = () => {
      if (!nextNowIsRunSeed) return nativeNow();
      nextNowIsRunSeed = false;
      return 1_700_000_000_000;
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('opening-screen')).toBeVisible();
  await expect(page.getByTestId('start-game')).toHaveText('Start Shooting!');
  await expect(page.getByText('BGM: David So HandSome', { exact: true })).toBeVisible();
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

async function canvasNumber(page: Page, key: string): Promise<number> {
  return page.getByTestId('game-canvas').evaluate((canvas, datasetKey) => {
    const value = (canvas as HTMLCanvasElement).dataset[datasetKey];
    return Number(value ?? Number.NaN);
  }, key);
}

async function dragTouch(
  page: Page,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): Promise<void> {
  const client = await page.context().newCDPSession(page);
  const touch = (point: { readonly x: number; readonly y: number }) => ({
    x: point.x,
    y: point.y,
    radiusX: 3,
    radiusY: 3,
    force: 1,
    id: 1,
  });
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(from)] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(to)] });
  await page.waitForTimeout(260);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
}

async function exercisePlaneControls(page: Page, testInfo: TestInfo): Promise<void> {
  const canvas = page.getByTestId('game-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const initialX = await canvasNumber(page, 'playerX');
  const initialY = await canvasNumber(page, 'playerY');
  expect(initialX).toBeCloseTo(0, 1);
  expect(initialY).toBeCloseTo(-3, 1);
  const shotsBefore = await canvasNumber(page, 'projectileSpawnedTotal');

  if (testInfo.project.name.startsWith('mobile-')) {
    await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height * 0.85);
    await expect.poll(() => canvasNumber(page, 'projectileSpawnedTotal')).toBe(shotsBefore + 1);

    const joystick = { x: box.x + box.width * 0.2, y: box.y + box.height * 0.85 };
    await dragTouch(page, joystick, { x: joystick.x + box.width * 0.1, y: joystick.y });
    const movedRight = await canvasNumber(page, 'playerX');
    expect(movedRight).toBeGreaterThan(initialX);
    await dragTouch(page, joystick, { x: joystick.x - box.width * 0.1, y: joystick.y });
  } else {
    // Pointer activity is presentation-only and cannot create a projectile.
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.2);
    await page.waitForTimeout(120);
    expect(await canvasNumber(page, 'projectileSpawnedTotal')).toBe(shotsBefore);

    // One key-down creates one shot even while Space remains held.
    await page.keyboard.down('Space');
    await page.waitForTimeout(420);
    await page.keyboard.up('Space');
    expect(await canvasNumber(page, 'projectileSpawnedTotal')).toBe(shotsBefore + 1);

    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(220);
    await page.keyboard.up('ArrowRight');
    const movedRight = await canvasNumber(page, 'playerX');
    expect(movedRight).toBeGreaterThan(initialX);

    await page.keyboard.down('a');
    await page.waitForTimeout(220);
    await page.keyboard.up('a');
    expect(await canvasNumber(page, 'playerX')).toBeLessThan(movedRight);

    await page.keyboard.down('w');
    await page.waitForTimeout(180);
    await page.keyboard.up('w');
    const movedUp = await canvasNumber(page, 'playerY');
    expect(movedUp).toBeGreaterThan(initialY);
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(180);
    await page.keyboard.up('ArrowDown');
    expect(await canvasNumber(page, 'playerY')).toBeLessThan(movedUp);
  }
}

test('opening and rejected path never initialize gameplay', async ({ page }, testInfo) => {
  const errors = collectSeriousErrors(page);
  await openGame(page);
  await capture(page, testInfo, '01-opening');
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('question-1')).toBeVisible();
  await capture(page, testInfo, '02-question-one');
  await page.getByTestId('q1-yes').click();
  await expect(page.getByTestId('question-2')).toBeVisible();
  await capture(page, testInfo, '03-question-two');
  await page.getByTestId('q2-no').click();
  await expect(page.getByTestId('rejected-screen')).toBeVisible();
  await expect(page.getByTestId('game-canvas')).toHaveCount(0);
  await capture(page, testInfo, '04-rejected');
  await page.getByTestId('rejected-return').click();
  await expect(page.getByTestId('opening-screen')).toBeVisible();
  expect(errors).toEqual([]);
});

test('authorized plane-shooter flow validates parity controls, scrolling, damage, game over, and navigation', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = collectSeriousErrors(page);
  const mediaRequests = collectMediaRequests(page);
  await openGame(page);
  await reachSecretCode(page);
  await expect.poll(() => mediaRequests.some((url) => url.includes('start_voice_leon'))).toBe(true);
  await expect.poll(() => mediaRequests.some((url) => url.includes('opening_music'))).toBe(true);

  await page.getByTestId('secret-code-input').fill('Basic');
  await page.getByTestId('secret-code-submit').click();
  await expect(page.getByRole('alert')).toContainText('Incorrect code');
  await capture(page, testInfo, '05-secret-code-failure');

  await page.getByTestId('secret-code-input').fill('basic');
  await page.getByTestId('secret-code-submit').click();
  await expect(page.getByTestId('customization-screen')).toBeVisible();
  await capture(page, testInfo, '06-customization-default');

  await page.getByTestId('enter-arena').click();
  await expect(page.getByTestId('game-canvas')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('game-hud')).toContainText('HP 3');
  await expect(page.getByTestId('game-hud')).not.toContainText('Wave');
  await expect.poll(() => mediaRequests.some((url) => url.includes('gameplay_music'))).toBe(true);

  const [frameBox, canvasBox] = await Promise.all([
    page.locator('.portrait-frame').boundingBox(),
    page.getByTestId('game-canvas').boundingBox(),
  ]);
  expect(frameBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  if (frameBox && canvasBox) {
    expect(Math.abs(canvasBox.width - frameBox.width)).toBeLessThan(2.5);
    expect(Math.abs(canvasBox.height - frameBox.height)).toBeLessThan(2.5);
  }

  await page.getByTestId('pause-game').evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  const pausedOffset = await canvasNumber(page, 'backgroundOffsetSlow');
  await page.waitForTimeout(200);
  expect(await canvasNumber(page, 'backgroundOffsetSlow')).toBe(pausedOffset);
  await capture(page, testInfo, '07-pause');
  await page.getByTestId('resume-game').click();
  await expect(page.getByTestId('pause-overlay')).toHaveCount(0);

  const slowOffset = await canvasNumber(page, 'backgroundOffsetSlow');
  const fastOffset = await canvasNumber(page, 'backgroundOffsetFast');
  await page.waitForTimeout(650);
  expect(await canvasNumber(page, 'backgroundOffsetSlow')).not.toBe(slowOffset);
  expect(await canvasNumber(page, 'backgroundOffsetFast')).not.toBe(fastOffset);
  await expect.poll(() => canvasNumber(page, 'enemyCount')).toBeGreaterThan(0);
  await exercisePlaneControls(page, testInfo);
  await expect.poll(() => mediaRequests.some((url) => url.includes('/shoot.'))).toBe(true);
  await capture(page, testInfo, '08-plane-shooter');

  await expect.poll(
    () => page.getByTestId('game-hud').getAttribute('data-health'),
    { timeout: 35_000 },
  ).not.toBe('3');
  await capture(page, testInfo, '09-damaged-player');
  await expect(page.getByTestId('game-over-screen')).toBeVisible({ timeout: 55_000 });
  await expect(page.getByText('Final Score', { exact: true })).toBeVisible();
  await expect(page.getByTestId('retry-game')).toHaveText('Shooting Again!');
  await expect.poll(() => mediaRequests.some((url) => /player_voice_(?:jimmy|zac)/.test(url))).toBe(true);
  await capture(page, testInfo, '10-game-over');

  if (testInfo.project.name === 'mobile-390x844') {
    await page.getByTestId('change-characters').click();
    await expect(page.getByTestId('customization-screen')).toBeVisible();
    await expect(page.getByTestId('game-canvas')).toHaveCount(0);
    await page.getByTestId('enter-arena').click();
    await expect(page.getByTestId('game-canvas')).toBeVisible({ timeout: 15_000 });
  } else if (testInfo.project.name !== 'chromium-wide') {
    await page.getByTestId('retry-game').click();
    await expect(page.getByTestId('game-over-screen')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId('game-hud')).toHaveAttribute('data-health', '3');
    await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-projectile-spawned-total', '0');
  } else {
    await page.getByTestId('gameover-main-menu').click();
    await expect(page.getByTestId('opening-screen')).toBeVisible();
    expect(errors).toEqual([]);
    return;
  }

  await page.getByTestId('pause-game').click();
  await page.getByRole('button', { name: 'Main menu' }).click();
  await expect(page.getByTestId('opening-screen')).toBeVisible();
  await expect(page.getByTestId('game-canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('custom player and multiple enemies persist across reload and render as appearance-only roster', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Persistence journey runs once; responsive projects cover the default flow.');
  const errors = collectSeriousErrors(page);
  await openGame(page);
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
  await capture(page, testInfo, '11-custom-roster');

  await page.reload();
  await expect(page.getByTestId('opening-screen')).toBeVisible();
  await authorize(page);
  await expect(page.locator('.preview-row img')).toHaveCount(2);
  await expect(page.locator('.enemy-roster input:checked')).toHaveCount(2);

  await page.getByTestId('enter-arena').click();
  await expect(page.getByTestId('game-canvas')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1_600);
  await expect.poll(() => canvasNumber(page, 'enemyCount')).toBeGreaterThan(0);
  await capture(page, testInfo, '12-custom-gameplay');
  await page.getByTestId('pause-game').click();
  await page.getByRole('button', { name: 'Main menu' }).click();
  expect(errors).toEqual([]);
});

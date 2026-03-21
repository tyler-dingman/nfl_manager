import { test, expect, type Page } from '@playwright/test';

const dismissOnboardingIfPresent = async (page: Page) => {
  const onboardingDialog = page.getByRole('dialog', { name: /Five Wide onboarding/i });
  if (await onboardingDialog.isVisible().catch(() => false)) {
    await onboardingDialog.getByRole('button', { name: /^Skip$/ }).click();
    await expect(onboardingDialog).toBeHidden();
  }
};

const selectTeamAndContinue = async (page: Page, modeName: RegExp) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Philadelphia Eagles/i }).click();
  await expect(page).toHaveURL(/\/experience/);
  await page.getByRole('button', { name: modeName }).click();
  await page.getByRole('main').getByRole('button', { name: /^Continue$/ }).click();
};

test('full experience continues into manage team roster flow', async ({ page }) => {
  await selectTeamAndContinue(page, /Full Experience/i);

  await expect(page).toHaveURL(/\/roster/);
  await expect(page.getByText(/Expiring Contracts/i).first()).toBeVisible();
  await expect(page.getByText(/Roster/i).first()).toBeVisible();
});

test('trade hub opens from manage team flow', async ({ page }) => {
  await selectTeamAndContinue(page, /Full Experience/i);

  await expect(page).toHaveURL(/\/roster/);
  await dismissOnboardingIfPresent(page);
  await page.getByRole('button', { name: /Trade Block/i }).click();
  await page.getByRole('button', { name: /Propose Trade/i }).click();

  await expect(page).toHaveURL(/\/manage\/trades/);
  await expect(page.getByRole('button', { name: /Select team|Cardinals|Falcons|Bills/i }).first()).toBeVisible();
});

test('draft can be started and shows live controls', async ({ page }) => {
  await selectTeamAndContinue(page, /Draft/i);

  await expect(page).toHaveURL(/\/draft\/room/);
  await expect(page.getByRole('button', { name: /^Start Draft$/ })).toBeVisible();
  await page.getByRole('button', { name: /^Start Draft$/ }).click();

  await expect(page.getByRole('button', { name: /^Pause Draft$/ })).toBeVisible();
  await expect(page.getByText(/Pick In Progress|You Are On The Clock/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Skip To Next Pick|Skip To End Of Draft/i })).toBeVisible();
});

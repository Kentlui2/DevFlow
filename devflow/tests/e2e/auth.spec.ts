import { expect, test } from "@playwright/test";

test("protected project pages send signed-out visitors to sign in", async ({
  page,
}) => {
  await page.goto("/projects");

  await expect(page).toHaveURL(/\/login\?next=%2Fprojects$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" })
  ).toBeVisible();
});

test("sign-in page exposes the expected fields and account links", async ({
  page,
}) => {
  await page.goto("/login");

  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Forgot password?" })
  ).toHaveAttribute("href", "/forgot-password");
});

test("sign-in displays a helpful message when credentials are rejected", async ({
  page,
}) => {
  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        code: "invalid_credentials",
        message: "Invalid login credentials",
      }),
    });
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill("devflow@example.test");
  await page
    .getByRole("textbox", { name: "Password" })
    .fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(
    page.getByText("Email or password is incorrect. Please try again.", {
      exact: true,
    })
  ).toBeVisible();
});

test("registration rejects mismatched passwords before contacting Supabase", async ({
  page,
}) => {
  let authRequestCount = 0;
  await page.route("**/auth/v1/**", async (route) => {
    authRequestCount += 1;
    await route.abort();
  });

  await page.goto("/register");
  await page.getByLabel("Full name").fill("DevFlow Tester");
  await page.getByLabel("Email").fill("devflow@example.test");
  await page.getByLabel("Password", { exact: true }).fill("password-one");
  await page.getByLabel("Confirm password").fill("password-two");
  await expect(page.getByLabel("Full name")).toHaveValue("DevFlow Tester");
  await expect(page.getByLabel("Email")).toHaveValue("devflow@example.test");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(
    page.getByText("Those passwords don’t match.", { exact: true })
  ).toBeVisible();
  expect(authRequestCount).toBe(0);
});

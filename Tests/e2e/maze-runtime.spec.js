const { test, expect } = require("@playwright/test");

async function waitForReadyState(page) {
    await expect(page.locator("#status-text")).toHaveText("Ready");
    await expect(page.locator("#difficulty-select")).toBeEnabled();
    await expect(page.locator("#generate-button")).toBeEnabled();
    await expect(page.locator("#explore-button")).toBeEnabled();
}

test.describe("Maze runtime smoke", () => {
    test("loads without page errors and reaches ready state", async ({ page }) => {
        const pageErrors = [];
        const consoleErrors = [];

        page.on("pageerror", (error) => {
            pageErrors.push(error.message);
        });

        page.on("console", (message) => {
            if (message.type() === "error") {
                consoleErrors.push(message.text());
            }
        });

        await page.goto("/");
        await waitForReadyState(page);

        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    });

    test("generate request completes without runtime errors", async ({ page }) => {
        const pageErrors = [];
        const consoleErrors = [];

        page.on("pageerror", (error) => {
            pageErrors.push(error.message);
        });

        page.on("console", (message) => {
            if (message.type() === "error") {
                consoleErrors.push(message.text());
            }
        });

        await page.goto("/");
        await waitForReadyState(page);

        await page.getByRole("button", { name: "Generate Maze" }).click();
        await waitForReadyState(page);

        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    });

    test("solve request progresses and completes", async ({ page }) => {
        const pageErrors = [];
        const consoleErrors = [];

        page.on("pageerror", (error) => {
            pageErrors.push(error.message);
        });

        page.on("console", (message) => {
            if (message.type() === "error") {
                consoleErrors.push(message.text());
            }
        });

        await page.goto("/");
        await waitForReadyState(page);

        await page.getByRole("button", { name: "Start Exploration" }).click();
        await expect(page.locator("#status-text")).toHaveText("Exploring...");

        await expect
            .poll(async () => {
                const value = await page.locator("#visited-count-text").textContent();
                return Number(value || "0");
            })
            .toBeGreaterThan(0);

        await expect(page.locator("#status-text")).toHaveText("Path Highlighted");
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    });
});
const { test, expect } = require("@playwright/test");

async function waitForReadyState(page) {
    await expect(page.locator("#status-text")).toHaveText("Ready");
    await expect(page.locator("#difficulty-select")).toBeEnabled();
    await expect(page.locator("#generate-button")).toBeEnabled();
    await expect(page.locator("#explore-button")).toBeEnabled();
}

test.describe("Maze runtime smoke", () => {
    test("loads favicon without browser resource errors", async ({ page }) => {
        await page.goto("/");
        const faviconHref = await page.locator('link[rel="icon"]').getAttribute("href");
        const faviconResponse = await page.evaluate(async (href) => {
            const response = await fetch(href);
            return {
                ok: response.ok,
                status: response.status,
                url: response.url,
            };
        }, faviconHref);

        expect(faviconResponse.ok).toBeTruthy();
        expect(faviconResponse.status).toBe(200);
        await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "favicon.svg");
    });

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

    test("degrades gracefully when Worker is unavailable", async ({ page }) => {
        const pageErrors = [];
        const consoleErrors = [];

        await page.addInitScript(() => {
            Object.defineProperty(window, "Worker", {
                configurable: true,
                writable: true,
                value: undefined,
            });
        });

        page.on("pageerror", (error) => {
            pageErrors.push(error.message);
        });

        page.on("console", (message) => {
            if (message.type() === "error") {
                consoleErrors.push(message.text());
            }
        });

        await page.goto("/");

        await expect(page.locator("#status-text")).toHaveText("Ready");
        await expect(page.locator("#generate-button")).toBeEnabled();
        await expect(page.locator("#explore-button")).toBeDisabled();

        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toContain("Maze worker task failed Web Worker is not supported in this browser.");
    });
});
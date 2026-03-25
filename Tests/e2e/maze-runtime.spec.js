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

    test("cancels stale generate requests during rapid difficulty changes", async ({ page }) => {
        const pageErrors = [];
        const consoleErrors = [];

        await page.addInitScript(() => {
            const NativeWorker = window.Worker;
            const outboundMessages = [];

            window.__mazeWorkerOutboundMessages = outboundMessages;

            class TrackingWorker extends NativeWorker {
                postMessage(message, ...rest) {
                    outboundMessages.push({
                        requestId: message?.requestId ?? null,
                        size: message?.size ?? null,
                        type: message?.type ?? null,
                    });
                    return super.postMessage(message, ...rest);
                }
            }

            Object.defineProperty(window, "Worker", {
                configurable: true,
                writable: true,
                value: TrackingWorker,
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
        await waitForReadyState(page);

        await page.evaluate(() => {
            const select = document.getElementById("difficulty-select");
            for (const value of ["normal", "hard", "superhard"]) {
                select.value = value;
                select.dispatchEvent(new Event("change", { bubbles: true }));
            }
        });

        await waitForReadyState(page);
        await expect(page.locator("#difficulty-text")).toHaveText("Super Hard");
        await expect(page.locator("#grid-size-text")).toHaveText("201 x 201");

        const outboundMessages = await page.evaluate(() => window.__mazeWorkerOutboundMessages);
        const cancelMessages = outboundMessages.filter((message) => message.type === "cancel");
        const generateMessages = outboundMessages.filter((message) => message.type === "generate");
        const lastMessage = outboundMessages[outboundMessages.length - 1];

        expect(cancelMessages.length).toBeGreaterThan(0);
        expect(generateMessages.length).toBeGreaterThanOrEqual(4);
        expect(lastMessage).toEqual({ requestId: expect.any(Number), size: 201, type: "generate" });
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
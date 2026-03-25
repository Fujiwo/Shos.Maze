const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
    testDir: "./Tests/e2e",
    fullyParallel: false,
    timeout: 30_000,
    expect: {
        timeout: 10_000,
    },
    retries: 0,
    use: {
        baseURL: "http://127.0.0.1:4173",
        trace: "retain-on-failure",
    },
    webServer: {
        command: "npx http-server ./Sources -p 4173 -c-1",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: true,
        timeout: 30_000,
    },
});
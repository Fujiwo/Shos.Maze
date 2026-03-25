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
        command: "node ./Tests/support/static-server.js",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: true,
        timeout: 30_000,
    },
});
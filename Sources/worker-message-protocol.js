// The shared message protocol keeps main-thread and Worker code aligned on the
// same message names without duplicating string literals in both environments.
(function initializeMazeWorkerMessageProtocol(rootScope) {
    const MESSAGE_TYPES = {
        cancel: "cancel",
        error: "error",
        generate: "generate",
        generated: "generated",
        progress: "progress",
        solve: "solve",
        solved: "solved",
    };

    rootScope.MazeWorkerMessageProtocol = {
        MESSAGE_TYPES,
    };
})(typeof self !== "undefined" ? self : window);
(function initializeMazeWorkerProtocol(rootScope) {
    const MESSAGE_TYPES = {
        cancel: "cancel",
        error: "error",
        generate: "generate",
        generated: "generated",
        progress: "progress",
        solve: "solve",
        solved: "solved",
    };

    rootScope.MazeWorkerProtocol = {
        MESSAGE_TYPES,
    };
})(typeof self !== "undefined" ? self : window);
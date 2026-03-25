(function initializeMazeRenderScheduler() {
    function createRenderScheduler(renderCallback) {
        let renderQueued = false;

        return {
            request() {
                if (renderQueued) {
                    return;
                }

                renderQueued = true;
                window.requestAnimationFrame(() => {
                    renderQueued = false;
                    renderCallback();
                });
            },
        };
    }

    window.MazeRenderScheduler = {
        createRenderScheduler,
    };
})();
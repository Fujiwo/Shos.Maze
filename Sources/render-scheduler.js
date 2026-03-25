// The render scheduler coalesces many state changes into at most one draw per
// animation frame, which matters when Worker progress arrives in quick bursts.
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
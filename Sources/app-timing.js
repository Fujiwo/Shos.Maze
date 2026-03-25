(function initializeMazeAppTiming() {
    function pause(duration) {
        if (duration <= 0) {
            return new Promise((resolve) => {
                window.requestAnimationFrame(() => resolve());
            });
        }

        return new Promise((resolve) => {
            window.setTimeout(resolve, duration);
        });
    }

    window.MazeAppTiming = {
        pause,
    };
})();
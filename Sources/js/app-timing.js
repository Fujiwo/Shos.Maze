// Timing helpers keep animation delays explicit and centralized so render loops
// can yield consistently without coupling the controller to timer details.
(function initializeMazeAppTiming() {
    function pause(duration) {
        if (duration <= 0) {
            // requestAnimationFrame keeps zero-delay animation steps aligned with
            // paint timing instead of spinning through synchronous microtasks.
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
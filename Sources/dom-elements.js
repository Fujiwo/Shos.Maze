(function initializeMazeDomElements() {
    function captureElements() {
        return {
            difficultySelect: document.getElementById("difficulty-select"),
            generateButton: document.getElementById("generate-button"),
            exploreButton: document.getElementById("explore-button"),
            statusText: document.getElementById("status-text"),
            difficultyText: document.getElementById("difficulty-text"),
            gridSizeText: document.getElementById("grid-size-text"),
            visitedCountText: document.getElementById("visited-count-text"),
            canvas: document.getElementById("maze-canvas"),
            stage: document.getElementById("maze-stage"),
        };
    }

    function bindEvents(elements, handlers) {
        elements.difficultySelect.addEventListener("change", (event) => {
            handlers.onDifficultyChange(event.target.value);
        });

        elements.generateButton.addEventListener("click", () => {
            handlers.onGenerate();
        });

        elements.exploreButton.addEventListener("click", async () => {
            await handlers.onExplore();
        });

        window.addEventListener("resize", () => {
            handlers.onResize();
        });
    }

    window.MazeDomElements = {
        bindEvents,
        captureElements,
    };
})();
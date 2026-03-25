(function initializeMazeUiSync() {
    const { DIFFICULTY_OPTIONS, STATUS_LABELS } = window.MazeAppConstants;

    function populateDifficultyOptions(elements, selectedDifficulty) {
        const select = elements.difficultySelect;
        select.innerHTML = "";

        for (const [value, option] of Object.entries(DIFFICULTY_OPTIONS)) {
            const element = document.createElement("option");
            element.value = value;
            element.textContent = `${option.label} (${option.size} x ${option.size})`;
            element.selected = value === selectedDifficulty;
            select.appendChild(element);
        }
    }

    function syncUi(elements, state) {
        const option = DIFFICULTY_OPTIONS[state.selectedDifficulty];
        elements.statusText.textContent = STATUS_LABELS[state.currentStatus];
        elements.difficultyText.textContent = option.label;
        elements.gridSizeText.textContent = `${option.size} x ${option.size}`;
        elements.visitedCountText.textContent = `${state.renderedVisitedCount}`;
        elements.difficultySelect.value = state.selectedDifficulty;

        const isGenerating = state.currentStatus === "generating";
        const isExploring = state.currentStatus === "exploring";
        const isHighlighting = state.currentStatus === "highlighting";
        const controlsLocked = isGenerating || isHighlighting || isExploring;

        elements.difficultySelect.disabled = controlsLocked;
        elements.generateButton.disabled = controlsLocked;
        elements.exploreButton.disabled =
            isGenerating ||
            isExploring ||
            isHighlighting ||
            !state.mazeGrid;
    }

    window.MazeUiSync = {
        populateDifficultyOptions,
        syncUi,
    };
})();
// UI sync maps the controller state into visible labels and control locking.
// It intentionally derives the whole screen from state so failed requests and
// rollbacks can restore a consistent UI with one sync pass.
(function initializeMazeUiSync() {
    const { DIFFICULTY_OPTIONS, STATUS_LABELS } = window.MazeAppConfig;

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
        // Lock controls from the state model, not from DOM history, so forced
        // events and rollback paths still converge to the intended UI rules.
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
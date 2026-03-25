(function initializeMazeAppState() {
    const { DIFFICULTY_OPTIONS, STORAGE_KEY } = window.MazeAppConstants;

    function createInitialState(selectedDifficulty) {
        return {
            mazeGrid: null,
            gridSize: 0,
            startId: -1,
            goalId: -1,
            visitedOrder: new Int32Array(1024),
            visitedCount: 0,
            shortestPath: new Int32Array(0),
            renderedVisitedCount: 0,
            renderedPathCount: 0,
            selectedDifficulty,
            currentStatus: "idle",
        };
    }

    function getStoredDifficulty() {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            return stored in DIFFICULTY_OPTIONS ? stored : "easy";
        } catch {
            return "easy";
        }
    }

    function persistDifficulty(selectedDifficulty) {
        try {
            window.localStorage.setItem(STORAGE_KEY, selectedDifficulty);
        } catch {
            return;
        }
    }

    function resetAnimationState(state) {
        state.visitedOrder = new Int32Array(1024);
        state.visitedCount = 0;
        state.shortestPath = new Int32Array(0);
        state.renderedVisitedCount = 0;
        state.renderedPathCount = 0;
    }

    function appendVisitedBatch(state, batch) {
        const requiredSize = state.visitedCount + batch.length;

        if (requiredSize > state.visitedOrder.length) {
            let nextLength = state.visitedOrder.length;
            while (nextLength < requiredSize) {
                nextLength *= 2;
            }

            const nextBuffer = new Int32Array(nextLength);
            nextBuffer.set(state.visitedOrder.subarray(0, state.visitedCount));
            state.visitedOrder = nextBuffer;
        }

        state.visitedOrder.set(batch, state.visitedCount);
        state.visitedCount = requiredSize;
    }

    function applyGeneratedResult(state, message) {
        state.mazeGrid = message.grid;
        state.gridSize = message.size;
        state.startId = message.startId;
        state.goalId = message.goalId;
        resetAnimationState(state);
    }

    function applyProgressResult(state, message) {
        appendVisitedBatch(state, message.visitedIds);
        state.renderedVisitedCount = state.visitedCount;
    }

    function applySolvedResult(state, message) {
        state.shortestPath = message.pathIds;
        state.renderedPathCount = 0;
    }

    window.MazeAppState = {
        applyGeneratedResult,
        applyProgressResult,
        applySolvedResult,
        createInitialState,
        getStoredDifficulty,
        persistDifficulty,
        resetAnimationState,
    };
})();
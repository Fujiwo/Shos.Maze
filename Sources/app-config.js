(function initializeMazeAppConstants() {
    const { MESSAGE_TYPES } = window.MazeWorkerProtocol;

    const DIFFICULTY_OPTIONS = {
        easy: { label: "Easy", size: 25 },
        normal: { label: "Normal", size: 51 },
        hard: { label: "Hard", size: 101 },
        superhard: { label: "Super Hard", size: 201 },
    };

    const STATUS_LABELS = {
        idle: "Ready",
        generating: "Generating...",
        ready: "Ready",
        exploring: "Exploring...",
        highlighting: "Highlighting Path...",
        completed: "Path Highlighted",
    };

    const ANIMATION_CONFIG = {
        easy: { workerBatchSize: 24, pathBatchSize: 2, pathDelay: 18 },
        normal: { workerBatchSize: 96, pathBatchSize: 4, pathDelay: 10 },
        hard: { workerBatchSize: 320, pathBatchSize: 12, pathDelay: 0 },
        superhard: { workerBatchSize: 1024, pathBatchSize: 32, pathDelay: 0 },
    };

    const MAZE_PALETTE = {
        wall: "#203548",
        path: "#f7f3eb",
        start: "#2d8f6f",
        goal: "#d94f3d",
        visited: "#88b6cf",
        solution: "#ffbf47",
    };

    const STORAGE_KEY = "mazeApp.selectedDifficulty";
    const WORKER_SCRIPT = "maze-worker.js";

    window.MazeAppConstants = {
        ANIMATION_CONFIG,
        DIFFICULTY_OPTIONS,
        MAZE_PALETTE,
        MESSAGE_TYPES,
        STATUS_LABELS,
        STORAGE_KEY,
        WORKER_SCRIPT,
    };
})();
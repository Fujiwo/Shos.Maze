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

const STORAGE_KEY = "mazeApp.selectedDifficulty";

class MazeRenderer {
    constructor(canvas, stageElement) {
        this.canvas = canvas;
        this.stageElement = stageElement;
        this.context = canvas.getContext("2d");
        this.palette = {
            wall: "#203548",
            path: "#f7f3eb",
            start: "#2d8f6f",
            goal: "#d94f3d",
            visited: "#88b6cf",
            solution: "#ffbf47",
        };
        this.cellSize = 0;
        this.staticCanvas = document.createElement("canvas");
        this.staticContext = this.staticCanvas.getContext("2d");
        this.staticContext.imageSmoothingEnabled = false;
        this.context.imageSmoothingEnabled = false;
        this.renderCache = {
            mazeGrid: null,
            visitedCount: 0,
            pathCount: 0,
        };
        this.coordinateCache = {
            gridSize: 0,
            dimension: 0,
            xByCellId: new Float32Array(0),
            yByCellId: new Float32Array(0),
            markerXByCellId: new Float32Array(0),
            markerYByCellId: new Float32Array(0),
            markerInset: 0,
            markerSize: 0,
        };
        this.pathSupport = typeof Path2D === "function";
    }

    resize(gridSize) {
        const bounds = this.stageElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const availableHeight = Math.max(240, viewportHeight - bounds.top - 32);
        const dimension = Math.max(240, Math.floor(Math.min(bounds.width, availableHeight)));
        const resized = this.canvas.width !== dimension || this.canvas.height !== dimension;
        const cacheStale =
            this.coordinateCache.gridSize !== gridSize ||
            this.coordinateCache.dimension !== dimension;

        if (!resized && !cacheStale) {
            return false;
        }

        if (resized) {
            this.canvas.width = dimension;
            this.canvas.height = dimension;
            this.staticCanvas.width = dimension;
            this.staticCanvas.height = dimension;
        }
        this.cellSize = dimension / gridSize;
        this.context.imageSmoothingEnabled = false;
        this.staticContext.imageSmoothingEnabled = false;
        this.ensureCoordinateCache(gridSize, dimension);
        return resized;
    }

    ensureCoordinateCache(gridSize, dimension) {
        if (
            this.coordinateCache.gridSize === gridSize &&
            this.coordinateCache.dimension === dimension
        ) {
            return;
        }

        const totalCells = gridSize * gridSize;
        const xByCellId = new Float32Array(totalCells);
        const yByCellId = new Float32Array(totalCells);
        const markerXByCellId = new Float32Array(totalCells);
        const markerYByCellId = new Float32Array(totalCells);
        const markerInset = Math.max(2, this.cellSize * 0.18);
        const markerSize = Math.max(2, this.cellSize - markerInset * 2);
        let cellId = 0;

        for (let row = 0; row < gridSize; row += 1) {
            const y = row * this.cellSize;
            for (let col = 0; col < gridSize; col += 1) {
                const x = col * this.cellSize;
                xByCellId[cellId] = x;
                yByCellId[cellId] = y;
                markerXByCellId[cellId] = x + markerInset;
                markerYByCellId[cellId] = y + markerInset;
                cellId += 1;
            }
        }

        this.coordinateCache = {
            gridSize,
            dimension,
            xByCellId,
            yByCellId,
            markerXByCellId,
            markerYByCellId,
            markerInset,
            markerSize,
        };
    }

    render(state) {
        if (!state.mazeGrid || state.gridSize === 0) {
            return;
        }

        const resized = this.resize(state.gridSize);
        const mazeChanged = this.renderCache.mazeGrid !== state.mazeGrid;
        const countsReset =
            state.renderedVisitedCount < this.renderCache.visitedCount ||
            state.renderedPathCount < this.renderCache.pathCount;
        const requiresFullRedraw = resized || mazeChanged || countsReset;

        if (resized || mazeChanged) {
            this.drawStaticLayer(state);
        }

        if (requiresFullRedraw) {
            this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.context.drawImage(this.staticCanvas, 0, 0);
            this.drawCellsByIdRange(
                state.visitedOrder,
                0,
                state.renderedVisitedCount,
                this.palette.visited,
                this.context,
            );
            this.drawCellsByIdRange(
                state.shortestPath,
                0,
                state.renderedPathCount,
                this.palette.solution,
                this.context,
            );
        } else {
            this.drawCellsByIdRange(
                state.visitedOrder,
                this.renderCache.visitedCount,
                state.renderedVisitedCount,
                this.palette.visited,
                this.context,
            );
            this.drawCellsByIdRange(
                state.shortestPath,
                this.renderCache.pathCount,
                state.renderedPathCount,
                this.palette.solution,
                this.context,
            );
        }

        this.drawMarkerById(state.startId, this.palette.start, this.context);
        this.drawMarkerById(state.goalId, this.palette.goal, this.context);

        this.renderCache = {
            mazeGrid: state.mazeGrid,
            visitedCount: state.renderedVisitedCount,
            pathCount: state.renderedPathCount,
        };
    }

    drawStaticLayer(state) {
        const context = this.staticContext;
        const grid = state.mazeGrid;
        const { xByCellId, yByCellId } = this.coordinateCache;
        const wallPath = this.pathSupport ? new Path2D() : null;
        const routePath = this.pathSupport ? new Path2D() : null;

        context.clearRect(0, 0, this.staticCanvas.width, this.staticCanvas.height);

        if (this.pathSupport) {
            for (let cellId = 0; cellId < grid.length; cellId += 1) {
                const targetPath = grid[cellId] === 0 ? wallPath : routePath;
                targetPath.rect(
                    xByCellId[cellId],
                    yByCellId[cellId],
                    this.cellSize,
                    this.cellSize,
                );
            }

            context.fillStyle = this.palette.wall;
            context.fill(wallPath);
            context.fillStyle = this.palette.path;
            context.fill(routePath);
        } else {
            for (let cellId = 0; cellId < grid.length; cellId += 1) {
                context.fillStyle = grid[cellId] === 0 ? this.palette.wall : this.palette.path;
                context.fillRect(
                    xByCellId[cellId],
                    yByCellId[cellId],
                    this.cellSize,
                    this.cellSize,
                );
            }
        }

        this.drawMarkerById(state.startId, this.palette.start, context);
        this.drawMarkerById(state.goalId, this.palette.goal, context);
    }

    drawCellsByIdRange(ids, startIndex, endIndex, color, context) {
        if (!ids || endIndex <= startIndex) {
            return;
        }

        const { xByCellId, yByCellId } = this.coordinateCache;

        if (this.pathSupport) {
            const path = new Path2D();

            for (let index = startIndex; index < endIndex; index += 1) {
                const cellId = ids[index];
                path.rect(
                    xByCellId[cellId],
                    yByCellId[cellId],
                    this.cellSize,
                    this.cellSize,
                );
            }

            context.fillStyle = color;
            context.fill(path);
            return;
        }

        context.fillStyle = color;

        for (let index = startIndex; index < endIndex; index += 1) {
            const cellId = ids[index];
            context.fillRect(
                xByCellId[cellId],
                yByCellId[cellId],
                this.cellSize,
                this.cellSize,
            );
        }
    }

    drawMarkerById(cellId, color, context) {
        if (cellId < 0) {
            return;
        }

        const { markerXByCellId, markerYByCellId, markerSize } = this.coordinateCache;

        context.fillStyle = color;
        context.fillRect(
            markerXByCellId[cellId],
            markerYByCellId[cellId],
            markerSize,
            markerSize,
        );
    }
}

class AppController {
    constructor() {
        this.elements = this.captureElements();
        this.renderer = new MazeRenderer(this.elements.canvas, this.elements.stage);
        this.worker = this.createWorker();
        this.state = {
            mazeGrid: null,
            gridSize: 0,
            startId: -1,
            goalId: -1,
            visitedOrder: new Int32Array(1024),
            visitedCount: 0,
            shortestPath: new Int32Array(0),
            renderedVisitedCount: 0,
            renderedPathCount: 0,
            selectedDifficulty: this.getStoredDifficulty(),
            currentStatus: "idle",
        };
        this.requestCounter = 0;
        this.activeRequestId = 0;
        this.renderQueued = false;
        this.animationConfig = {
            easy: { workerBatchSize: 24, pathBatchSize: 2, pathDelay: 18 },
            normal: { workerBatchSize: 96, pathBatchSize: 4, pathDelay: 10 },
            hard: { workerBatchSize: 320, pathBatchSize: 12, pathDelay: 0 },
            superhard: { workerBatchSize: 1024, pathBatchSize: 32, pathDelay: 0 },
        };
    }

    createWorker() {
        const worker = new Worker("maze-worker.js");
        worker.addEventListener("message", (event) => {
            this.handleWorkerMessage(event.data);
        });
        worker.addEventListener("error", (event) => {
            console.error("Maze worker error", event.message);
            if (this.state.currentStatus === "generating" || this.state.currentStatus === "exploring") {
                this.setStatus("ready");
                this.syncUI();
                this.requestRender();
            }
        });
        return worker;
    }

    captureElements() {
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

    init() {
        this.populateDifficultyOptions();
        this.bindEvents();
        this.generateMaze();
    }

    populateDifficultyOptions() {
        const select = this.elements.difficultySelect;
        select.innerHTML = "";

        for (const [value, option] of Object.entries(DIFFICULTY_OPTIONS)) {
            const element = document.createElement("option");
            element.value = value;
            element.textContent = `${option.label} (${option.size} x ${option.size})`;
            element.selected = value === this.state.selectedDifficulty;
            select.appendChild(element);
        }
    }

    bindEvents() {
        this.elements.difficultySelect.addEventListener("change", (event) => {
            this.handleDifficultyChange(event.target.value);
        });

        this.elements.generateButton.addEventListener("click", () => {
            this.generateMaze();
        });

        this.elements.exploreButton.addEventListener("click", async () => {
            await this.startExploration();
        });

        window.addEventListener("resize", () => {
            this.requestRender();
        });
    }

    handleDifficultyChange(value) {
        if (!(value in DIFFICULTY_OPTIONS)) {
            return;
        }

        this.state.selectedDifficulty = value;
        this.persistDifficulty();
        this.generateMaze();
    }

    handleWorkerMessage(message) {
        if (message.requestId !== this.activeRequestId) {
            return;
        }

        if (message.type === "generated") {
            this.handleGenerated(message);
            return;
        }

        if (message.type === "progress") {
            this.handleProgress(message);
            return;
        }

        if (message.type === "solved") {
            void this.handleSolved(message);
            return;
        }

        if (message.type === "error") {
            console.error("Maze worker task failed", message.error);
            this.setStatus("ready");
            this.syncUI();
            this.requestRender();
        }
    }

    handleGenerated(message) {
        this.state.mazeGrid = message.grid;
        this.state.gridSize = message.size;
        this.state.startId = message.startId;
        this.state.goalId = message.goalId;
        this.resetAnimationState();
        this.setStatus("ready");
        this.syncUI();
        this.requestRender();
    }

    handleProgress(message) {
        this.appendVisitedBatch(message.visitedIds);
        this.state.renderedVisitedCount = this.state.visitedCount;
        this.syncUI();
        this.requestRender();
    }

    async handleSolved(message) {
        this.state.shortestPath = message.pathIds;
        this.state.renderedPathCount = 0;
        this.setStatus("highlighting");
        this.syncUI();
        this.requestRender();
        await this.animatePath(message.requestId);

        if (this.activeRequestId !== message.requestId) {
            return;
        }

        this.setStatus("completed");
        this.syncUI();
        this.requestRender();
    }

    cancelActiveRequest() {
        if (this.activeRequestId !== 0) {
            this.worker.postMessage({ type: "cancel", requestId: this.activeRequestId });
        }
    }

    generateMaze() {
        this.cancelActiveRequest();
        const requestId = ++this.requestCounter;
        this.activeRequestId = requestId;
        this.resetAnimationState();
        this.setStatus("generating");
        this.syncUI();
        this.requestRender();
        this.worker.postMessage({
            type: "generate",
            requestId,
            size: this.currentGridSize(),
        });
    }

    async startExploration() {
        if (
            !this.state.mazeGrid ||
            (this.state.currentStatus !== "ready" && this.state.currentStatus !== "completed")
        ) {
            return;
        }

        this.cancelActiveRequest();
        const requestId = ++this.requestCounter;
        this.activeRequestId = requestId;
        this.resetAnimationState();
        this.setStatus("exploring");
        this.syncUI();
        this.requestRender();

        this.worker.postMessage({
            type: "solve",
            requestId,
            grid: this.state.mazeGrid,
            size: this.state.gridSize,
            startId: this.state.startId,
            goalId: this.state.goalId,
            batchSize: this.currentAnimationConfig().workerBatchSize,
        });
    }

    appendVisitedBatch(batch) {
        const requiredSize = this.state.visitedCount + batch.length;

        if (requiredSize > this.state.visitedOrder.length) {
            let nextLength = this.state.visitedOrder.length;
            while (nextLength < requiredSize) {
                nextLength *= 2;
            }

            const nextBuffer = new Int32Array(nextLength);
            nextBuffer.set(this.state.visitedOrder.subarray(0, this.state.visitedCount));
            this.state.visitedOrder = nextBuffer;
        }

        this.state.visitedOrder.set(batch, this.state.visitedCount);
        this.state.visitedCount = requiredSize;
    }

    async animatePath(requestId) {
        const config = this.currentAnimationConfig();
        const total = this.state.shortestPath.length;

        while (this.state.renderedPathCount < total) {
            if (requestId !== this.activeRequestId) {
                return;
            }

            this.state.renderedPathCount = Math.min(
                total,
                this.state.renderedPathCount + config.pathBatchSize,
            );
            this.syncUI();
            this.requestRender();
            await this.pause(config.pathDelay);
        }
    }

    resetAnimationState() {
        this.state.visitedOrder = new Int32Array(1024);
        this.state.visitedCount = 0;
        this.state.shortestPath = new Int32Array(0);
        this.state.renderedVisitedCount = 0;
        this.state.renderedPathCount = 0;
    }

    requestRender() {
        if (this.renderQueued) {
            return;
        }

        this.renderQueued = true;
        window.requestAnimationFrame(() => {
            this.renderQueued = false;
            this.renderer.render(this.state);
        });
    }

    setStatus(status) {
        this.state.currentStatus = status;
    }

    syncUI() {
        const option = DIFFICULTY_OPTIONS[this.state.selectedDifficulty];
        this.elements.statusText.textContent = STATUS_LABELS[this.state.currentStatus];
        this.elements.difficultyText.textContent = option.label;
        this.elements.gridSizeText.textContent = `${option.size} x ${option.size}`;
        this.elements.visitedCountText.textContent = `${this.state.renderedVisitedCount}`;
        this.elements.difficultySelect.value = this.state.selectedDifficulty;

        const isGenerating = this.state.currentStatus === "generating";
        const isExploring = this.state.currentStatus === "exploring";
        const isHighlighting = this.state.currentStatus === "highlighting";
        const controlsLocked = isGenerating || isHighlighting || isExploring;

        this.elements.difficultySelect.disabled = controlsLocked;
        this.elements.generateButton.disabled = controlsLocked;
        this.elements.exploreButton.disabled =
            isGenerating ||
            isExploring ||
            isHighlighting ||
            !this.state.mazeGrid;
    }

    currentGridSize() {
        return DIFFICULTY_OPTIONS[this.state.selectedDifficulty].size;
    }

    currentAnimationConfig() {
        return this.animationConfig[this.state.selectedDifficulty];
    }

    getStoredDifficulty() {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            return stored in DIFFICULTY_OPTIONS ? stored : "easy";
        } catch {
            return "easy";
        }
    }

    persistDifficulty() {
        try {
            window.localStorage.setItem(STORAGE_KEY, this.state.selectedDifficulty);
        } catch {
            return;
        }
    }

    pause(duration) {
        if (duration <= 0) {
            return new Promise((resolve) => {
                window.requestAnimationFrame(() => resolve());
            });
        }

        return new Promise((resolve) => {
            window.setTimeout(resolve, duration);
        });
    }
}

const app = new AppController();
app.init();
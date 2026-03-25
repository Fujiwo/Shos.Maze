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

class MinHeap {
    constructor() {
        this.items = [];
    }

    get size() {
        return this.items.length;
    }

    push(item) {
        this.items.push(item);
        this.bubbleUp(this.items.length - 1);
    }

    pop() {
        if (this.items.length === 0) {
            return null;
        }

        const root = this.items[0];
        const last = this.items.pop();

        if (this.items.length > 0) {
            this.items[0] = last;
            this.bubbleDown(0);
        }

        return root;
    }

    bubbleUp(index) {
        let currentIndex = index;

        while (currentIndex > 0) {
            const parentIndex = Math.floor((currentIndex - 1) / 2);
            if (this.items[parentIndex].priority <= this.items[currentIndex].priority) {
                break;
            }

            [this.items[parentIndex], this.items[currentIndex]] = [
                this.items[currentIndex],
                this.items[parentIndex],
            ];
            currentIndex = parentIndex;
        }
    }

    bubbleDown(index) {
        let currentIndex = index;
        const length = this.items.length;

        while (true) {
            const leftIndex = currentIndex * 2 + 1;
            const rightIndex = currentIndex * 2 + 2;
            let smallestIndex = currentIndex;

            if (
                leftIndex < length &&
                this.items[leftIndex].priority < this.items[smallestIndex].priority
            ) {
                smallestIndex = leftIndex;
            }

            if (
                rightIndex < length &&
                this.items[rightIndex].priority < this.items[smallestIndex].priority
            ) {
                smallestIndex = rightIndex;
            }

            if (smallestIndex === currentIndex) {
                break;
            }

            [this.items[currentIndex], this.items[smallestIndex]] = [
                this.items[smallestIndex],
                this.items[currentIndex],
            ];
            currentIndex = smallestIndex;
        }
    }
}

class MazeGenerator {
    async generate(size, yieldControl) {
        const grid = Array.from({ length: size }, () => new Uint8Array(size));
        const stack = [];
        const startCell = { row: 1, col: 1 };
        let stepsSinceYield = 0;

        grid[startCell.row][startCell.col] = 1;
        stack.push(startCell);

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = this.getUnvisitedNeighbors(grid, current, size);

            if (neighbors.length === 0) {
                stack.pop();
                continue;
            }

            const next = neighbors[Math.floor(Math.random() * neighbors.length)];
            const wallRow = current.row + (next.row - current.row) / 2;
            const wallCol = current.col + (next.col - current.col) / 2;

            grid[wallRow][wallCol] = 1;
            grid[next.row][next.col] = 1;
            stack.push(next);

            stepsSinceYield += 1;
            if (yieldControl && stepsSinceYield >= 2048) {
                stepsSinceYield = 0;
                const shouldContinue = await yieldControl();
                if (!shouldContinue) {
                    return null;
                }
            }
        }

        const startPosition = { row: 1, col: 1 };
        const goalPosition = { row: size - 2, col: size - 2 };
        grid[startPosition.row][startPosition.col] = 1;
        grid[goalPosition.row][goalPosition.col] = 1;

        return { grid, startPosition, goalPosition };
    }

    getUnvisitedNeighbors(grid, cell, size) {
        const neighbors = [];
        const { row, col } = cell;

        if (row > 1 && grid[row - 2][col] === 0) {
            neighbors.push({ row: row - 2, col });
        }
        if (row < size - 2 && grid[row + 2][col] === 0) {
            neighbors.push({ row: row + 2, col });
        }
        if (col > 1 && grid[row][col - 2] === 0) {
            neighbors.push({ row, col: col - 2 });
        }
        if (col < size - 2 && grid[row][col + 2] === 0) {
            neighbors.push({ row, col: col + 2 });
        }

        return neighbors;
    }
}

class MazeSolver {
    createSession(grid, startPosition, goalPosition) {
        const size = grid.length;
        const totalCells = size * size;
        const startId = this.cellToId(startPosition, size);
        const goalId = this.cellToId(goalPosition, size);
        const cameFrom = new Int32Array(totalCells);
        const gScore = new Float64Array(totalCells);
        const closedSet = new Uint8Array(totalCells);
        const openHeap = new MinHeap();

        cameFrom.fill(-1);
        gScore.fill(Number.POSITIVE_INFINITY);
        gScore[startId] = 0;
        openHeap.push({ id: startId, priority: this.heuristicById(startId, goalId, size) });

        return {
            grid,
            size,
            goalId,
            goalPosition,
            openHeap,
            closedSet,
            cameFrom,
            gScore,
            isComplete: false,
            shortestPath: [],
        };
    }

    step(session, iterationBudget) {
        const visitedBatch = [];
        let iterations = 0;

        while (session.openHeap.size > 0 && !session.isComplete && iterations < iterationBudget) {
            const currentEntry = session.openHeap.pop();
            if (!currentEntry) {
                break;
            }

            const currentId = currentEntry.id;

            if (session.closedSet[currentId] === 1) {
                continue;
            }

            session.closedSet[currentId] = 1;
            visitedBatch.push(this.idToCell(currentId, session.size));
            iterations += 1;

            if (currentId === session.goalId) {
                session.isComplete = true;
                session.shortestPath = this.reconstructPath(session.cameFrom, currentId, session.size);
                break;
            }

            const neighborIds = this.getNeighborIds(session.grid, currentId, session.size);
            const currentGScore = session.gScore[currentId];

            for (const neighborId of neighborIds) {
                if (session.closedSet[neighborId] === 1) {
                    continue;
                }

                const tentativeGScore = currentGScore + 1;
                const existingScore = session.gScore[neighborId];

                if (tentativeGScore >= existingScore) {
                    continue;
                }

                session.cameFrom[neighborId] = currentId;
                session.gScore[neighborId] = tentativeGScore;
                session.openHeap.push({
                    id: neighborId,
                    priority: tentativeGScore + this.heuristicById(neighborId, session.goalId, session.size),
                });
            }
        }

        const done = session.isComplete || session.openHeap.size === 0;
        return {
            visitedBatch,
            done,
            shortestPath: done ? session.shortestPath : [],
        };
    }

    getNeighborIds(grid, cellId, size) {
        const row = Math.floor(cellId / size);
        const col = cellId % size;
        const neighbors = [];

        if (row > 0 && grid[row - 1][col] === 1) {
            neighbors.push(cellId - size);
        }
        if (row < size - 1 && grid[row + 1][col] === 1) {
            neighbors.push(cellId + size);
        }
        if (col > 0 && grid[row][col - 1] === 1) {
            neighbors.push(cellId - 1);
        }
        if (col < size - 1 && grid[row][col + 1] === 1) {
            neighbors.push(cellId + 1);
        }

        return neighbors;
    }

    heuristicById(cellId, goalId, size) {
        const row = Math.floor(cellId / size);
        const col = cellId % size;
        const goalRow = Math.floor(goalId / size);
        const goalCol = goalId % size;
        return Math.abs(row - goalRow) + Math.abs(col - goalCol);
    }

    reconstructPath(cameFrom, currentId, size) {
        const path = [];
        let cursor = currentId;

        while (cursor !== -1) {
            path.push(this.idToCell(cursor, size));
            cursor = cameFrom[cursor];
        }

        return path.reverse();
    }

    cellToId(cell, size) {
        return cell.row * size + cell.col;
    }

    idToCell(cellId, size) {
        return {
            row: Math.floor(cellId / size),
            col: cellId % size,
        };
    }
}

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
            width: 0,
            height: 0,
            visitedCount: 0,
            pathCount: 0,
        };
    }

    resize(gridSize) {
        const bounds = this.stageElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const availableHeight = Math.max(240, viewportHeight - bounds.top - 32);
        const dimension = Math.max(240, Math.floor(Math.min(bounds.width, availableHeight)));
        const resized = this.canvas.width !== dimension || this.canvas.height !== dimension;

        if (!resized) {
            return false;
        }

        this.canvas.width = dimension;
        this.canvas.height = dimension;
        this.staticCanvas.width = dimension;
        this.staticCanvas.height = dimension;
        this.cellSize = dimension / gridSize;
        this.context.imageSmoothingEnabled = false;
        this.staticContext.imageSmoothingEnabled = false;
        return true;
    }

    render(state) {
        if (!state.mazeGrid) {
            return;
        }

        const resized = this.resize(state.mazeGrid.length);
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
            this.drawCells(
                state.visitedOrder.slice(0, state.renderedVisitedCount),
                this.palette.visited,
                this.context,
            );
            this.drawCells(
                state.shortestPath.slice(0, state.renderedPathCount),
                this.palette.solution,
                this.context,
            );
        } else {
            this.drawCells(
                state.visitedOrder.slice(this.renderCache.visitedCount, state.renderedVisitedCount),
                this.palette.visited,
                this.context,
            );
            this.drawCells(
                state.shortestPath.slice(this.renderCache.pathCount, state.renderedPathCount),
                this.palette.solution,
                this.context,
            );
        }

        this.drawMarker(state.startPosition, this.palette.start, this.context);
        this.drawMarker(state.goalPosition, this.palette.goal, this.context);

        this.renderCache = {
            mazeGrid: state.mazeGrid,
            width: this.canvas.width,
            height: this.canvas.height,
            visitedCount: state.renderedVisitedCount,
            pathCount: state.renderedPathCount,
        };
    }

    drawStaticLayer(state) {
        const context = this.staticContext;
        const grid = state.mazeGrid;
        const size = grid.length;

        context.clearRect(0, 0, this.staticCanvas.width, this.staticCanvas.height);

        for (let row = 0; row < size; row += 1) {
            for (let col = 0; col < size; col += 1) {
                context.fillStyle = grid[row][col] === 0 ? this.palette.wall : this.palette.path;
                context.fillRect(col * this.cellSize, row * this.cellSize, this.cellSize, this.cellSize);
            }
        }

        this.drawMarker(state.startPosition, this.palette.start, context);
        this.drawMarker(state.goalPosition, this.palette.goal, context);
    }

    drawCells(cells, color, context) {
        context.fillStyle = color;

        for (const cell of cells) {
            context.fillRect(
                cell.col * this.cellSize,
                cell.row * this.cellSize,
                this.cellSize,
                this.cellSize,
            );
        }
    }

    drawMarker(cell, color, context) {
        if (!cell) {
            return;
        }

        const inset = Math.max(2, this.cellSize * 0.18);
        context.fillStyle = color;
        context.fillRect(
            cell.col * this.cellSize + inset,
            cell.row * this.cellSize + inset,
            Math.max(2, this.cellSize - inset * 2),
            Math.max(2, this.cellSize - inset * 2),
        );
    }
}

class AppController {
    constructor() {
        this.generator = new MazeGenerator();
        this.solver = new MazeSolver();
        this.elements = this.captureElements();
        this.renderer = new MazeRenderer(this.elements.canvas, this.elements.stage);
        this.state = {
            mazeGrid: null,
            startPosition: null,
            goalPosition: null,
            visitedOrder: [],
            shortestPath: [],
            renderedVisitedCount: 0,
            renderedPathCount: 0,
            selectedDifficulty: this.getStoredDifficulty(),
            currentStatus: "idle",
        };
        this.runToken = 0;
        this.animationConfig = {
            easy: { exploreBatchSize: 4, exploreDelay: 18, pathDelay: 28 },
            normal: { exploreBatchSize: 10, exploreDelay: 10, pathDelay: 18 },
            hard: { exploreBatchSize: 64, exploreDelay: 2, pathDelay: 4 },
            superhard: { exploreBatchSize: 320, exploreDelay: 0, pathDelay: 0 },
        };
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
            this.renderer.render(this.state);
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

    async generateMaze() {
        const token = ++this.runToken;
        this.setStatus("generating");
        this.resetAnimationState();
        this.syncUI();
        this.renderer.render(this.state);
        await this.yieldToBrowser();

        if (token !== this.runToken) {
            return;
        }

        const size = this.currentGridSize();
        const generated = await this.generator.generate(size, async () => {
            await this.yieldToBrowser();
            return token === this.runToken;
        });

        if (!generated || token !== this.runToken) {
            return;
        }

        this.state.mazeGrid = generated.grid;
        this.state.startPosition = generated.startPosition;
        this.state.goalPosition = generated.goalPosition;

        this.setStatus("ready");
        this.syncUI();
        this.renderer.render(this.state);
    }

    async startExploration() {
        if (!this.state.mazeGrid || this.state.currentStatus !== "ready" && this.state.currentStatus !== "completed") {
            return;
        }

        const token = ++this.runToken;
        this.resetAnimationState();
        this.setStatus("exploring");
        this.syncUI();
        this.renderer.render(this.state);

        const session = this.solver.createSession(
            this.state.mazeGrid,
            this.state.startPosition,
            this.state.goalPosition,
        );

        const shortestPath = await this.animateVisited(token, session);
        if (token !== this.runToken) {
            return;
        }

        this.state.shortestPath = shortestPath;
        this.setStatus("highlighting");
        this.syncUI();
        await this.animatePath(token);
        if (token !== this.runToken) {
            return;
        }

        this.setStatus("completed");
        this.syncUI();
        this.renderer.render(this.state);
    }

    async animateVisited(token, session) {
        const config = this.currentAnimationConfig();

        while (true) {
            if (token !== this.runToken) {
                return [];
            }

            const result = this.solver.step(session, config.exploreBatchSize);
            this.state.visitedOrder.push(...result.visitedBatch);
            this.state.renderedVisitedCount = this.state.visitedOrder.length;
            this.syncUI();
            this.renderer.render(this.state);

            if (result.done) {
                return result.shortestPath;
            }

            await this.pause(config.exploreDelay);
        }
    }

    async animatePath(token) {
        const config = this.currentAnimationConfig();
        const total = this.state.shortestPath.length;

        while (this.state.renderedPathCount < total) {
            if (token !== this.runToken) {
                return;
            }

            this.state.renderedPathCount += 1;
            this.syncUI();
            this.renderer.render(this.state);
            await this.pause(config.pathDelay);
        }
    }

    resetAnimationState() {
        this.state.visitedOrder = [];
        this.state.shortestPath = [];
        this.state.renderedVisitedCount = 0;
        this.state.renderedPathCount = 0;
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
        const controlsLocked = isGenerating || isHighlighting;

        this.elements.difficultySelect.disabled = controlsLocked || isExploring;
        this.elements.generateButton.disabled = controlsLocked || isExploring;
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
            return this.yieldToBrowser();
        }

        return new Promise((resolve) => {
            window.setTimeout(resolve, duration);
        });
    }

    yieldToBrowser() {
        return new Promise((resolve) => {
            window.requestAnimationFrame(() => resolve());
        });
    }
}

const app = new AppController();
app.init();
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

class MazeGenerator {
    generate(size) {
        const grid = Array.from({ length: size }, () => Array(size).fill(0));
        const stack = [];
        const startCell = { row: 1, col: 1 };

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
        }

        const startPosition = { row: 1, col: 1 };
        const goalPosition = { row: size - 2, col: size - 2 };
        grid[startPosition.row][startPosition.col] = 1;
        grid[goalPosition.row][goalPosition.col] = 1;

        return { grid, startPosition, goalPosition };
    }

    getUnvisitedNeighbors(grid, cell, size) {
        const directions = [
            { row: -2, col: 0 },
            { row: 2, col: 0 },
            { row: 0, col: -2 },
            { row: 0, col: 2 },
        ];

        return directions
            .map((direction) => ({
                row: cell.row + direction.row,
                col: cell.col + direction.col,
            }))
            .filter((candidate) => this.isInside(candidate, size) && grid[candidate.row][candidate.col] === 0);
    }

    isInside(cell, size) {
        return cell.row > 0 && cell.row < size - 1 && cell.col > 0 && cell.col < size - 1;
    }
}

class MazeSolver {
    createSession(grid, startPosition, goalPosition) {
        return {
            grid,
            goalPosition,
            openSet: [startPosition],
            openLookup: new Set([this.keyOf(startPosition)]),
            closedSet: new Set(),
            cameFrom: new Map(),
            gScore: new Map([[this.keyOf(startPosition), 0]]),
            fScore: new Map([[this.keyOf(startPosition), this.heuristic(startPosition, goalPosition)]]),
            isComplete: false,
            shortestPath: [],
        };
    }

    step(session, iterationBudget) {
        const visitedBatch = [];
        let iterations = 0;

        while (session.openSet.length > 0 && !session.isComplete && iterations < iterationBudget) {
            const currentIndex = this.findLowestFScoreIndex(session.openSet, session.fScore);
            const current = session.openSet.splice(currentIndex, 1)[0];
            const currentKey = this.keyOf(current);
            session.openLookup.delete(currentKey);

            if (session.closedSet.has(currentKey)) {
                continue;
            }

            session.closedSet.add(currentKey);
            visitedBatch.push(current);
            iterations += 1;

            if (current.row === session.goalPosition.row && current.col === session.goalPosition.col) {
                session.isComplete = true;
                session.shortestPath = this.reconstructPath(session.cameFrom, current);
                break;
            }

            for (const neighbor of this.getNeighbors(session.grid, current)) {
                const neighborKey = this.keyOf(neighbor);

                if (session.closedSet.has(neighborKey)) {
                    continue;
                }

                const tentativeGScore = (session.gScore.get(currentKey) ?? Infinity) + 1;
                const existingScore = session.gScore.get(neighborKey) ?? Infinity;

                if (tentativeGScore >= existingScore) {
                    continue;
                }

                session.cameFrom.set(neighborKey, current);
                session.gScore.set(neighborKey, tentativeGScore);
                session.fScore.set(
                    neighborKey,
                    tentativeGScore + this.heuristic(neighbor, session.goalPosition),
                );

                if (!session.openLookup.has(neighborKey)) {
                    session.openSet.push(neighbor);
                    session.openLookup.add(neighborKey);
                }
            }
        }

        const done = session.isComplete || session.openSet.length === 0;
        return {
            visitedBatch,
            done,
            shortestPath: done ? session.shortestPath : [],
        };
    }

    getNeighbors(grid, cell) {
        const neighbors = [];
        const directions = [
            { row: -1, col: 0 },
            { row: 1, col: 0 },
            { row: 0, col: -1 },
            { row: 0, col: 1 },
        ];

        for (const direction of directions) {
            const nextRow = cell.row + direction.row;
            const nextCol = cell.col + direction.col;

            if (nextRow < 0 || nextCol < 0 || nextRow >= grid.length || nextCol >= grid.length) {
                continue;
            }

            if (grid[nextRow][nextCol] === 0) {
                continue;
            }

            neighbors.push({ row: nextRow, col: nextCol });
        }

        return neighbors;
    }

    heuristic(cell, goal) {
        return Math.abs(cell.row - goal.row) + Math.abs(cell.col - goal.col);
    }

    findLowestFScoreIndex(openSet, fScore) {
        let bestIndex = 0;
        let bestScore = Infinity;

        for (let index = 0; index < openSet.length; index += 1) {
            const score = fScore.get(this.keyOf(openSet[index])) ?? Infinity;
            if (score < bestScore) {
                bestScore = score;
                bestIndex = index;
            }
        }

        return bestIndex;
    }

    reconstructPath(cameFrom, current) {
        const path = [current];
        let cursor = current;

        while (cameFrom.has(this.keyOf(cursor))) {
            cursor = cameFrom.get(this.keyOf(cursor));
            path.push(cursor);
        }

        return path.reverse();
    }

    keyOf(cell) {
        return `${cell.row},${cell.col}`;
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
    }

    resize(gridSize) {
        const bounds = this.stageElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const availableHeight = Math.max(240, viewportHeight - bounds.top - 32);
        const dimension = Math.max(240, Math.floor(Math.min(bounds.width, availableHeight)));

        this.canvas.width = dimension;
        this.canvas.height = dimension;
        this.cellSize = dimension / gridSize;
    }

    render(state) {
        if (!state.mazeGrid) {
            return;
        }

        this.resize(state.mazeGrid.length);
        const context = this.context;
        const grid = state.mazeGrid;
        const size = grid.length;

        context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let row = 0; row < size; row += 1) {
            for (let col = 0; col < size; col += 1) {
                context.fillStyle = grid[row][col] === 0 ? this.palette.wall : this.palette.path;
                context.fillRect(col * this.cellSize, row * this.cellSize, this.cellSize, this.cellSize);
            }
        }

        this.drawCells(state.visitedOrder.slice(0, state.renderedVisitedCount), this.palette.visited);
        this.drawCells(state.shortestPath.slice(0, state.renderedPathCount), this.palette.solution);
        this.drawMarker(state.startPosition, this.palette.start);
        this.drawMarker(state.goalPosition, this.palette.goal);
    }

    drawCells(cells, color) {
        const context = this.context;
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

    drawMarker(cell, color) {
        if (!cell) {
            return;
        }

        const inset = Math.max(2, this.cellSize * 0.18);
        this.context.fillStyle = color;
        this.context.fillRect(
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
            hard: { exploreBatchSize: 36, exploreDelay: 4, pathDelay: 8 },
            superhard: { exploreBatchSize: 120, exploreDelay: 0, pathDelay: 2 },
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
        const generated = this.generator.generate(size);
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
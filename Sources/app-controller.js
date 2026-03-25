(function initializeMazeAppController() {
    const {
        ANIMATION_CONFIG,
        DIFFICULTY_OPTIONS,
    } = window.MazeAppConstants;
    const {
        applyGeneratedResult,
        applyProgressResult,
        applySolvedResult,
        createInitialState,
        getStoredDifficulty,
        persistDifficulty,
        resetAnimationState,
    } = window.MazeAppState;
    const { bindEvents, captureElements } = window.MazeDomElements;
    const { createRenderScheduler } = window.MazeRenderScheduler;
    const MazeRenderer = window.MazeRenderer;
    const { pause } = window.MazeTiming;
    const { populateDifficultyOptions, syncUi } = window.MazeUiSync;
    const MazeWorkerClient = window.MazeWorkerClient;

    class AppController {
        constructor() {
            this.elements = captureElements();
            this.renderer = new MazeRenderer(this.elements.canvas, this.elements.stage);
            this.state = createInitialState(getStoredDifficulty());
            this.renderScheduler = createRenderScheduler(() => {
                this.renderer.render(this.state);
            });
            this.workerClient = this.createWorkerClient();
        }

        createWorkerClient() {
            return new MazeWorkerClient({
                onGenerated: (message) => {
                    this.handleGenerated(message);
                },
                onProgress: (message) => {
                    this.handleProgress(message);
                },
                onSolved: (message) => {
                    void this.handleSolved(message);
                },
                onFailure: (errorInfo) => {
                    this.handleWorkerFailure(errorInfo);
                },
            });
        }

        init() {
            populateDifficultyOptions(this.elements, this.state.selectedDifficulty);
            this.bindEvents();
            this.generateMaze();
        }

        bindEvents() {
            bindEvents(this.elements, {
                onDifficultyChange: (value) => {
                    this.handleDifficultyChange(value);
                },
                onGenerate: () => {
                    this.generateMaze();
                },
                onExplore: async () => {
                    await this.startExploration();
                },
                onResize: () => {
                    this.requestRender();
                },
            });
        }

        handleDifficultyChange(value) {
            if (!(value in DIFFICULTY_OPTIONS)) {
                return;
            }

            this.state.selectedDifficulty = value;
            persistDifficulty(this.state.selectedDifficulty);
            this.generateMaze();
        }

        handleGenerated(message) {
            applyGeneratedResult(this.state, message);
            this.setStatus("ready");
            this.syncUI();
            this.requestRender();
        }

        handleProgress(message) {
            applyProgressResult(this.state, message);
            this.syncUI();
            this.requestRender();
        }

        async handleSolved(message) {
            applySolvedResult(this.state, message);
            this.setStatus("highlighting");
            this.syncUI();
            this.requestRender();
            await this.animatePath(message.requestId);

            if (!this.workerClient.isActiveRequest(message.requestId)) {
                return;
            }

            this.setStatus("completed");
            this.syncUI();
            this.requestRender();
        }

        handleWorkerFailure(errorInfo) {
            const label = errorInfo.kind === "worker" ? "Maze worker error" : "Maze worker task failed";
            console.error(label, errorInfo.message);

            if (
                this.state.currentStatus !== "generating" &&
                this.state.currentStatus !== "exploring"
            ) {
                return;
            }

            this.setStatus("ready");
            this.syncUI();
            this.requestRender();
        }

        generateMaze() {
            resetAnimationState(this.state);
            this.setStatus("generating");
            this.syncUI();
            this.requestRender();
            this.workerClient.startGenerate(this.currentGridSize());
        }

        async startExploration() {
            if (
                !this.state.mazeGrid ||
                (this.state.currentStatus !== "ready" && this.state.currentStatus !== "completed")
            ) {
                return;
            }

            resetAnimationState(this.state);
            this.setStatus("exploring");
            this.syncUI();
            this.requestRender();

            this.workerClient.startSolve({
                grid: this.state.mazeGrid,
                size: this.state.gridSize,
                startId: this.state.startId,
                goalId: this.state.goalId,
                batchSize: this.currentAnimationConfig().workerBatchSize,
            });
        }

        async animatePath(requestId) {
            const config = this.currentAnimationConfig();
            const total = this.state.shortestPath.length;

            while (this.state.renderedPathCount < total) {
                if (!this.workerClient.isActiveRequest(requestId)) {
                    return;
                }

                this.state.renderedPathCount = Math.min(
                    total,
                    this.state.renderedPathCount + config.pathBatchSize,
                );
                this.syncUI();
                this.requestRender();
                await pause(config.pathDelay);
            }
        }

        requestRender() {
            this.renderScheduler.request();
        }

        setStatus(status) {
            this.state.currentStatus = status;
        }

        syncUI() {
            syncUi(this.elements, this.state);
        }

        currentGridSize() {
            return DIFFICULTY_OPTIONS[this.state.selectedDifficulty].size;
        }

        currentAnimationConfig() {
            return ANIMATION_CONFIG[this.state.selectedDifficulty];
        }
    }

    window.MazeAppController = AppController;
})();
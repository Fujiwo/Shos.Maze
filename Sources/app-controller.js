(function initializeMazeAppController() {
    const {
        ANIMATION_CONFIG,
        DIFFICULTY_OPTIONS,
    } = window.MazeAppConfig;
    const {
        applyGenerateRequestResult,
        applySolveProgressResult,
        applySolveRequestResult,
        createInitialState,
        getStoredDifficulty,
        persistDifficulty,
        resetAnimationState,
    } = window.MazeAppState;
    const { bindEvents, captureElements } = window.MazeUiDom;
    const { createRenderScheduler } = window.MazeRenderScheduler;
    const MazeRenderCanvas = window.MazeRenderCanvas;
    const { pause } = window.MazeAppTiming;
    const { populateDifficultyOptions, syncUi } = window.MazeUiSync;
    const MazeWorkerRequestClient = window.MazeWorkerRequestClient;

    class AppController {
        constructor() {
            this.elements = captureElements();
            this.renderer = new MazeRenderCanvas(this.elements.canvas, this.elements.stage);
            this.state = createInitialState(getStoredDifficulty());
            this.renderScheduler = createRenderScheduler(() => {
                this.renderer.render(this.state);
            });
            this.workerRequestClient = this.createWorkerRequestClient();
        }

        createWorkerRequestClient() {
            return new MazeWorkerRequestClient({
                onGenerated: (message) => {
                    this.handleGenerateRequestCompleted(message);
                },
                onProgress: (message) => {
                    this.handleSolveRequestProgress(message);
                },
                onSolved: (message) => {
                    void this.handleSolveRequestCompleted(message);
                },
                onFailure: (errorInfo) => {
                    this.handleRequestFailed(errorInfo);
                },
            });
        }

        init() {
            populateDifficultyOptions(this.elements, this.state.selectedDifficulty);
            this.bindEvents();
            this.startGenerateRequest();
        }

        bindEvents() {
            bindEvents(this.elements, {
                onDifficultyChange: (value) => {
                    this.handleDifficultyChange(value);
                },
                onGenerate: () => {
                    this.startGenerateRequest();
                },
                onExplore: async () => {
                    await this.startSolveRequest();
                },
                onResize: () => {
                    this.requestRender();
                },
            });
        }

        handleDifficultyChange(value) {
            if (
                this.state.currentStatus === "generating" ||
                this.state.currentStatus === "exploring" ||
                this.state.currentStatus === "highlighting"
            ) {
                this.syncUI();
                return;
            }

            if (!(value in DIFFICULTY_OPTIONS)) {
                this.syncUI();
                return;
            }

            this.state.selectedDifficulty = value;
            persistDifficulty(this.state.selectedDifficulty);
            this.startGenerateRequest();
        }

        handleGenerateRequestCompleted(message) {
            applyGenerateRequestResult(this.state, message);
            this.setStatus("ready");
            this.syncUI();
            this.requestRender();
        }

        handleSolveRequestProgress(message) {
            applySolveProgressResult(this.state, message);
            this.syncUI();
            this.requestRender();
        }

        async handleSolveRequestCompleted(message) {
            applySolveRequestResult(this.state, message);
            this.setStatus("highlighting");
            this.syncUI();
            this.requestRender();
            await this.animatePath(message.requestId);

            if (!this.workerRequestClient.isActiveRequest(message.requestId)) {
                return;
            }

            this.setStatus("completed");
            this.syncUI();
            this.requestRender();
        }

        handleRequestFailed(errorInfo) {
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

        startGenerateRequest() {
            resetAnimationState(this.state);
            this.setStatus("generating");
            this.syncUI();
            this.requestRender();
            this.workerRequestClient.startGenerateRequest(this.currentGenerateRequestGridSize());
        }

        async startSolveRequest() {
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

            this.workerRequestClient.startSolveRequest({
                grid: this.state.mazeGrid,
                size: this.state.gridSize,
                startId: this.state.startId,
                goalId: this.state.goalId,
                batchSize: this.currentSolveRequestAnimationConfig().workerBatchSize,
            });
        }

        async animatePath(requestId) {
            const config = this.currentSolveRequestAnimationConfig();
            const total = this.state.shortestPath.length;

            while (this.state.renderedPathCount < total) {
                if (!this.workerRequestClient.isActiveRequest(requestId)) {
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

        currentGenerateRequestGridSize() {
            return DIFFICULTY_OPTIONS[this.state.selectedDifficulty].size;
        }

        currentSolveRequestAnimationConfig() {
            return ANIMATION_CONFIG[this.state.selectedDifficulty];
        }
    }

    window.MazeAppController = AppController;
})();
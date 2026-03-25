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
            this.requestSnapshot = null;
            this.requestSnapshotKind = null;
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

            const previousSnapshot = this.captureRequestSnapshot();
            this.state.selectedDifficulty = value;
            persistDifficulty(this.state.selectedDifficulty);
            this.startGenerateRequest(previousSnapshot);
        }

        handleGenerateRequestCompleted(message) {
            applyGenerateRequestResult(this.state, message);
            this.clearRequestSnapshot();
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
            this.clearRequestSnapshot();
            this.syncUI();
            this.requestRender();
        }

        handleRequestFailed(errorInfo) {
            const label = errorInfo.kind === "worker" ? "Maze worker error" : "Maze worker task failed";
            console.error(label, errorInfo.message);

            if (
                this.requestSnapshotKind !== "generate" &&
                this.requestSnapshotKind !== "solve" &&
                this.state.currentStatus !== "generating" &&
                this.state.currentStatus !== "exploring"
            ) {
                return;
            }

            if (!this.restoreRequestSnapshot()) {
                this.setStatus(this.state.mazeGrid ? "ready" : "idle");
            }

            this.clearRequestSnapshot();
            this.syncUI();
            this.requestRender();
        }

        startGenerateRequest(snapshotOverride = null) {
            if (this.isInteractionLocked()) {
                this.syncUI();
                this.requestRender();
                return 0;
            }

            this.rememberRequestSnapshot("generate", snapshotOverride);
            resetAnimationState(this.state);
            this.setStatus("generating");
            this.syncUI();
            this.requestRender();
            return this.workerRequestClient.startGenerateRequest(this.currentGenerateRequestGridSize());
        }

        async startSolveRequest() {
            if (
                !this.state.mazeGrid ||
                (this.state.currentStatus !== "ready" && this.state.currentStatus !== "completed")
            ) {
                return;
            }

            this.rememberRequestSnapshot("solve");
            resetAnimationState(this.state);
            this.setStatus("exploring");
            this.syncUI();
            this.requestRender();

            return this.workerRequestClient.startSolveRequest({
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

        isInteractionLocked() {
            return (
                this.state.currentStatus === "generating" ||
                this.state.currentStatus === "exploring" ||
                this.state.currentStatus === "highlighting"
            );
        }

        captureRequestSnapshot() {
            return {
                currentStatus: this.state.currentStatus,
                goalId: this.state.goalId,
                gridSize: this.state.gridSize,
                mazeGrid: this.state.mazeGrid,
                renderedPathCount: this.state.renderedPathCount,
                renderedVisitedCount: this.state.renderedVisitedCount,
                selectedDifficulty: this.state.selectedDifficulty,
                shortestPath: this.state.shortestPath,
                startId: this.state.startId,
                visitedCount: this.state.visitedCount,
                visitedOrder: this.state.visitedOrder,
            };
        }

        rememberRequestSnapshot(kind, snapshotOverride = null) {
            this.requestSnapshotKind = kind;
            this.requestSnapshot = snapshotOverride || this.captureRequestSnapshot();
        }

        restoreRequestSnapshot() {
            if (!this.requestSnapshot) {
                return false;
            }

            this.state.currentStatus = this.requestSnapshot.currentStatus;
            this.state.goalId = this.requestSnapshot.goalId;
            this.state.gridSize = this.requestSnapshot.gridSize;
            this.state.mazeGrid = this.requestSnapshot.mazeGrid;
            this.state.renderedPathCount = this.requestSnapshot.renderedPathCount;
            this.state.renderedVisitedCount = this.requestSnapshot.renderedVisitedCount;
            this.state.selectedDifficulty = this.requestSnapshot.selectedDifficulty;
            this.state.shortestPath = this.requestSnapshot.shortestPath;
            this.state.startId = this.requestSnapshot.startId;
            this.state.visitedCount = this.requestSnapshot.visitedCount;
            this.state.visitedOrder = this.requestSnapshot.visitedOrder;
            persistDifficulty(this.state.selectedDifficulty);
            return true;
        }

        clearRequestSnapshot() {
            this.requestSnapshot = null;
            this.requestSnapshotKind = null;
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
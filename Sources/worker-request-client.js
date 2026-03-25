// MazeWorkerRequestClient is the main-thread bridge to the Worker. It serializes
// request lifecycles, cancels stale work, and filters responses so only the most
// recent generate or solve request can update the UI.
(function initializeMazeWorkerRequestClient() {
    const { MESSAGE_TYPES, WORKER_SCRIPT } = window.MazeAppConfig;
    const MESSAGE_HANDLER_NAMES = {
        [MESSAGE_TYPES.generated]: "onGenerated",
        [MESSAGE_TYPES.progress]: "onProgress",
        [MESSAGE_TYPES.solved]: "onSolved",
    };

    class MazeWorkerRequestClient {
        constructor(handlers = {}) {
            this.handlers = handlers;
            this.requestCounter = 0;
            this.activeRequestId = 0;
            this.initializationError = null;
            this.worker = null;

            if (typeof Worker !== "function") {
                this.initializationError = "Web Worker is not supported in this browser.";
                return;
            }

            this.worker = new Worker(WORKER_SCRIPT);
            this.worker.addEventListener("message", (event) => {
                this.handleWorkerMessage(event.data);
            });
            this.worker.addEventListener("error", (event) => {
                this.emitFailure({
                    kind: "worker",
                    message: event.message || "Unknown worker error",
                    detail: event,
                });
            });
        }

        handleWorkerMessage(message) {
            // Late responses from canceled or superseded requests must be ignored
            // to keep the screen aligned with the latest selected difficulty.
            if (message.requestId !== this.activeRequestId) {
                return;
            }

            if (message.type === MESSAGE_TYPES.error) {
                this.emitFailure({
                    kind: "task",
                    message: message.error,
                    detail: message,
                });
                return;
            }

            const handlerName = MESSAGE_HANDLER_NAMES[message.type];
            if (!handlerName || typeof this.handlers[handlerName] !== "function") {
                return;
            }

            this.handlers[handlerName](message);
        }

        emitFailure(errorInfo) {
            if (typeof this.handlers.onFailure === "function") {
                this.handlers.onFailure(errorInfo);
            }
        }

        cancelActiveRequest() {
            if (this.activeRequestId === 0) {
                return;
            }

            this.worker.postMessage({
                type: MESSAGE_TYPES.cancel,
                requestId: this.activeRequestId,
            });
        }

        startGenerateRequest(size) {
            if (!this.worker) {
                this.emitFailure({
                    kind: "task",
                    message: this.initializationError || "Maze worker is unavailable.",
                });
                return 0;
            }

            // Every new request supersedes the previous one so stale progress
            // cannot race the current UI state.
            this.cancelActiveRequest();
            const requestId = ++this.requestCounter;
            this.activeRequestId = requestId;
            this.worker.postMessage({
                type: MESSAGE_TYPES.generate,
                requestId,
                size,
            });
            return requestId;
        }

        startSolveRequest(payload) {
            if (!this.worker) {
                this.emitFailure({
                    kind: "task",
                    message: this.initializationError || "Maze worker is unavailable.",
                });
                return 0;
            }

            this.cancelActiveRequest();
            const requestId = ++this.requestCounter;
            this.activeRequestId = requestId;
            this.worker.postMessage({
                type: MESSAGE_TYPES.solve,
                requestId,
                grid: payload.grid,
                size: payload.size,
                startId: payload.startId,
                goalId: payload.goalId,
                batchSize: payload.batchSize,
            });
            return requestId;
        }

        isActiveRequest(requestId) {
            return requestId === this.activeRequestId;
        }
    }

    window.MazeWorkerRequestClient = MazeWorkerRequestClient;
})();
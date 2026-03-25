(function initializeMazeWorkerMessages(workerScope) {
    const { MESSAGE_TYPES } = workerScope.MazeWorkerProtocol;

    function postGenerated(requestId, size, result) {
        workerScope.postMessage(
            {
                type: MESSAGE_TYPES.generated,
                requestId,
                size,
                grid: result.grid,
                startId: result.startId,
                goalId: result.goalId,
            },
            [result.grid.buffer],
        );
    }

    function postSolved(requestId, pathIds) {
        workerScope.postMessage(
            {
                type: MESSAGE_TYPES.solved,
                requestId,
                pathIds,
            },
            [pathIds.buffer],
        );
    }

    function postVisitedBatch(requestId, source, length) {
        const payload = new Int32Array(length);
        payload.set(source.subarray(0, length));
        workerScope.postMessage(
            {
                type: MESSAGE_TYPES.progress,
                requestId,
                visitedIds: payload,
            },
            [payload.buffer],
        );
    }

    function postError(requestId, error, clearCanceled) {
        workerScope.postMessage({
            type: MESSAGE_TYPES.error,
            requestId,
            error: error instanceof Error ? error.message : String(error),
        });
        clearCanceled(requestId);
    }

    function pauseWorker() {
        return new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    }

    workerScope.MazeWorkerMessages = {
        MESSAGE_TYPES,
        pauseWorker,
        postError,
        postGenerated,
        postSolved,
        postVisitedBatch,
    };
})(self);
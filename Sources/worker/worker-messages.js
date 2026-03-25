// Worker message helpers centralize the transfer format so generation and solve
// code can focus on algorithms instead of postMessage payload details.
(function initializeMazeWorkerMessages(workerScope) {
    const { MESSAGE_TYPES } = workerScope.MazeWorkerMessageProtocol;

    function postGenerateRequestResult(requestId, size, result) {
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

    function postSolveRequestResult(requestId, pathIds) {
        workerScope.postMessage(
            {
                type: MESSAGE_TYPES.solved,
                requestId,
                pathIds,
            },
            [pathIds.buffer],
        );
    }

    function postSolveRequestProgress(requestId, source, length) {
        // Copy only the visited prefix so ownership can be transferred without
        // exposing the mutable batch buffer that the Worker keeps reusing.
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

    function postRequestFailure(requestId, error, clearCanceled) {
        workerScope.postMessage({
            type: MESSAGE_TYPES.error,
            requestId,
            error: error instanceof Error ? error.message : String(error),
        });
        clearCanceled(requestId);
    }

    function pauseWorker() {
        return new Promise((resolve) => {
            // A zero-timeout yield is enough here because the Worker does not
            // need paint alignment, only a chance to process cancellation.
            setTimeout(resolve, 0);
        });
    }

    workerScope.MazeWorkerMessages = {
        MESSAGE_TYPES,
        pauseWorker,
        postGenerateRequestResult,
        postRequestFailure,
        postSolveRequestProgress,
        postSolveRequestResult,
    };
})(self);
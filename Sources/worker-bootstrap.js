importScripts("worker-message-protocol.js", "worker/worker-heap.js", "worker/worker-messages.js", "worker/worker-algorithms.js");

const { runGenerateRequest, runSolveRequest } = self.MazeWorkerAlgorithms;
const {
    MESSAGE_TYPES,
    pauseWorker,
    postGenerateRequestResult,
    postRequestFailure,
    postSolveRequestProgress,
    postSolveRequestResult,
} = self.MazeWorkerMessages;

const canceledRequests = new Set();

self.addEventListener("message", (event) => {
    const message = event.data;

    if (message.type === MESSAGE_TYPES.cancel) {
        canceledRequests.add(message.requestId);
        return;
    }

    if (message.type === MESSAGE_TYPES.generate) {
        void handleGenerateRequest(message);
        return;
    }

    if (message.type === MESSAGE_TYPES.solve) {
        void handleSolveRequest(message);
    }
});

async function handleGenerateRequest(message) {
    try {
        const result = await runGenerateRequest(message.size, message.requestId, {
            isCanceled,
            pauseWorker,
        });
        if (!result || isCanceled(message.requestId)) {
            clearCanceled(message.requestId);
            return;
        }

        postGenerateRequestResult(message.requestId, message.size, result);
        clearCanceled(message.requestId);
    } catch (error) {
        postRequestFailure(message.requestId, error, clearCanceled);
    }
}

async function handleSolveRequest(message) {
    try {
        const pathIds = await runSolveRequest(
            message.grid,
            message.size,
            message.startId,
            message.goalId,
            message.batchSize,
            message.requestId,
            {
                isCanceled,
                pauseWorker,
                postSolveRequestProgress,
            },
        );

        if (!pathIds || isCanceled(message.requestId)) {
            clearCanceled(message.requestId);
            return;
        }

        postSolveRequestResult(message.requestId, pathIds);
        clearCanceled(message.requestId);
    } catch (error) {
        postRequestFailure(message.requestId, error, clearCanceled);
    }
}

function isCanceled(requestId) {
    return canceledRequests.has(requestId);
}

function clearCanceled(requestId) {
    canceledRequests.delete(requestId);
}

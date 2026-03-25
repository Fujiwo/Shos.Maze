importScripts("worker-protocol.js", "worker/min-heap.js", "worker/messages.js", "worker/algorithms.js");

const { generateMaze, solveMaze } = self.MazeWorkerAlgorithms;
const {
    MESSAGE_TYPES,
    pauseWorker,
    postError,
    postGenerated,
    postSolved,
    postVisitedBatch,
} = self.MazeWorkerMessages;

const canceledRequests = new Set();

self.addEventListener("message", (event) => {
    const message = event.data;

    if (message.type === MESSAGE_TYPES.cancel) {
        canceledRequests.add(message.requestId);
        return;
    }

    if (message.type === MESSAGE_TYPES.generate) {
        void handleGenerate(message);
        return;
    }

    if (message.type === MESSAGE_TYPES.solve) {
        void handleSolve(message);
    }
});

async function handleGenerate(message) {
    try {
        const result = await generateMaze(message.size, message.requestId, {
            isCanceled,
            pauseWorker,
        });
        if (!result || isCanceled(message.requestId)) {
            clearCanceled(message.requestId);
            return;
        }

        postGenerated(message.requestId, message.size, result);
        clearCanceled(message.requestId);
    } catch (error) {
        postError(message.requestId, error, clearCanceled);
    }
}

async function handleSolve(message) {
    try {
        const pathIds = await solveMaze(
            message.grid,
            message.size,
            message.startId,
            message.goalId,
            message.batchSize,
            message.requestId,
            {
                isCanceled,
                pauseWorker,
                postVisitedBatch,
            },
        );

        if (!pathIds || isCanceled(message.requestId)) {
            clearCanceled(message.requestId);
            return;
        }

        postSolved(message.requestId, pathIds);
        clearCanceled(message.requestId);
    } catch (error) {
        postError(message.requestId, error, clearCanceled);
    }
}

function isCanceled(requestId) {
    return canceledRequests.has(requestId);
}

function clearCanceled(requestId) {
    canceledRequests.delete(requestId);
}

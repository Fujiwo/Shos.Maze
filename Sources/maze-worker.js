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

const canceledRequests = new Set();

self.addEventListener("message", (event) => {
    const message = event.data;

    if (message.type === "cancel") {
        canceledRequests.add(message.requestId);
        return;
    }

    if (message.type === "generate") {
        void handleGenerate(message);
        return;
    }

    if (message.type === "solve") {
        void handleSolve(message);
    }
});

async function handleGenerate(message) {
    try {
        const result = await generateMaze(message.size, message.requestId);
        if (!result || isCanceled(message.requestId)) {
            clearCanceled(message.requestId);
            return;
        }

        self.postMessage(
            {
                type: "generated",
                requestId: message.requestId,
                size: message.size,
                grid: result.grid,
                startId: result.startId,
                goalId: result.goalId,
            },
            [result.grid.buffer],
        );
        clearCanceled(message.requestId);
    } catch (error) {
        postError(message.requestId, error);
    }
}

async function handleSolve(message) {
    try {
        const grid = message.grid;
        const pathIds = await solveMaze(
            grid,
            message.size,
            message.startId,
            message.goalId,
            message.batchSize,
            message.requestId,
        );

        if (!pathIds || isCanceled(message.requestId)) {
            clearCanceled(message.requestId);
            return;
        }

        self.postMessage(
            {
                type: "solved",
                requestId: message.requestId,
                pathIds,
            },
            [pathIds.buffer],
        );
        clearCanceled(message.requestId);
    } catch (error) {
        postError(message.requestId, error);
    }
}

async function generateMaze(size, requestId) {
    const grid = new Uint8Array(size * size);
    const stack = [];
    const startId = size + 1;
    const goalId = (size - 2) * size + (size - 2);
    let stepsSinceYield = 0;

    grid[startId] = 1;
    stack.push(startId);

    while (stack.length > 0) {
        if (isCanceled(requestId)) {
            return null;
        }

        const currentId = stack[stack.length - 1];
        const nextId = pickRandomUnvisitedNeighborId(grid, currentId, size);

        if (nextId === -1) {
            stack.pop();
        } else {
            const wallId = currentId + (nextId - currentId) / 2;
            grid[wallId] = 1;
            grid[nextId] = 1;
            stack.push(nextId);
        }

        stepsSinceYield += 1;
        if (stepsSinceYield >= 2048) {
            stepsSinceYield = 0;
            await pauseWorker();
        }
    }

    grid[startId] = 1;
    grid[goalId] = 1;

    return { grid, startId, goalId };
}

function pickRandomUnvisitedNeighborId(grid, cellId, size) {
    const row = Math.floor(cellId / size);
    const col = cellId % size;
    let count = 0;
    let candidate0 = -1;
    let candidate1 = -1;
    let candidate2 = -1;
    let candidate3 = -1;

    if (row > 1) {
        const nextId = cellId - size * 2;
        if (grid[nextId] === 0) {
            candidate0 = nextId;
            count += 1;
        }
    }

    if (row < size - 2) {
        const nextId = cellId + size * 2;
        if (grid[nextId] === 0) {
            if (count === 0) {
                candidate0 = nextId;
            } else if (count === 1) {
                candidate1 = nextId;
            } else if (count === 2) {
                candidate2 = nextId;
            } else {
                candidate3 = nextId;
            }
            count += 1;
        }
    }

    if (col > 1) {
        const nextId = cellId - 2;
        if (grid[nextId] === 0) {
            if (count === 0) {
                candidate0 = nextId;
            } else if (count === 1) {
                candidate1 = nextId;
            } else if (count === 2) {
                candidate2 = nextId;
            } else {
                candidate3 = nextId;
            }
            count += 1;
        }
    }

    if (col < size - 2) {
        const nextId = cellId + 2;
        if (grid[nextId] === 0) {
            if (count === 0) {
                candidate0 = nextId;
            } else if (count === 1) {
                candidate1 = nextId;
            } else if (count === 2) {
                candidate2 = nextId;
            } else {
                candidate3 = nextId;
            }
            count += 1;
        }
    }

    if (count === 0) {
        return -1;
    }

    const choice = Math.floor(Math.random() * count);
    if (choice === 0) {
        return candidate0;
    }
    if (choice === 1) {
        return candidate1;
    }
    if (choice === 2) {
        return candidate2;
    }
    return candidate3;
}

async function solveMaze(grid, size, startId, goalId, batchSize, requestId) {
    const totalCells = size * size;
    const cameFrom = new Int32Array(totalCells);
    const gScore = new Float64Array(totalCells);
    const closedSet = new Uint8Array(totalCells);
    const openHeap = new MinHeap();
    let currentBatch = new Int32Array(batchSize);
    let currentBatchCount = 0;
    let iterationsSinceYield = 0;

    cameFrom.fill(-1);
    gScore.fill(Number.POSITIVE_INFINITY);
    gScore[startId] = 0;
    openHeap.push({ id: startId, priority: heuristicById(startId, goalId, size) });

    while (openHeap.size > 0) {
        if (isCanceled(requestId)) {
            return null;
        }

        const current = openHeap.pop();
        if (!current) {
            break;
        }

        const currentId = current.id;
        if (closedSet[currentId] === 1) {
            continue;
        }

        closedSet[currentId] = 1;
        currentBatch[currentBatchCount] = currentId;
        currentBatchCount += 1;

        if (currentId === goalId) {
            if (currentBatchCount > 0) {
                postVisitedBatch(requestId, currentBatch, currentBatchCount);
            }
            return reconstructPath(cameFrom, goalId);
        }

        const currentGScore = gScore[currentId];
        pushNeighbors(grid, size, currentId, (neighborId) => {
            if (closedSet[neighborId] === 1) {
                return;
            }

            const tentativeGScore = currentGScore + 1;
            if (tentativeGScore >= gScore[neighborId]) {
                return;
            }

            cameFrom[neighborId] = currentId;
            gScore[neighborId] = tentativeGScore;
            openHeap.push({
                id: neighborId,
                priority: tentativeGScore + heuristicById(neighborId, goalId, size),
            });
        });

        if (currentBatchCount === currentBatch.length) {
            postVisitedBatch(requestId, currentBatch, currentBatchCount);
            currentBatch = new Int32Array(batchSize);
            currentBatchCount = 0;
        }

        iterationsSinceYield += 1;
        if (iterationsSinceYield >= batchSize) {
            iterationsSinceYield = 0;
            if (currentBatchCount > 0) {
                postVisitedBatch(requestId, currentBatch, currentBatchCount);
                currentBatch = new Int32Array(batchSize);
                currentBatchCount = 0;
            }
            await pauseWorker();
        }
    }

    if (currentBatchCount > 0) {
        postVisitedBatch(requestId, currentBatch, currentBatchCount);
    }

    return new Int32Array(0);
}

function pushNeighbors(grid, size, cellId, callback) {
    const row = Math.floor(cellId / size);
    const col = cellId % size;

    if (row > 0) {
        const nextId = cellId - size;
        if (grid[nextId] === 1) {
            callback(nextId);
        }
    }

    if (row < size - 1) {
        const nextId = cellId + size;
        if (grid[nextId] === 1) {
            callback(nextId);
        }
    }

    if (col > 0) {
        const nextId = cellId - 1;
        if (grid[nextId] === 1) {
            callback(nextId);
        }
    }

    if (col < size - 1) {
        const nextId = cellId + 1;
        if (grid[nextId] === 1) {
            callback(nextId);
        }
    }
}

function heuristicById(cellId, goalId, size) {
    const row = Math.floor(cellId / size);
    const col = cellId % size;
    const goalRow = Math.floor(goalId / size);
    const goalCol = goalId % size;
    return Math.abs(row - goalRow) + Math.abs(col - goalCol);
}

function reconstructPath(cameFrom, goalId) {
    let length = 0;
    let cursor = goalId;

    while (cursor !== -1) {
        length += 1;
        cursor = cameFrom[cursor];
    }

    const path = new Int32Array(length);
    cursor = goalId;

    for (let index = length - 1; index >= 0; index -= 1) {
        path[index] = cursor;
        cursor = cameFrom[cursor];
    }

    return path;
}

function postVisitedBatch(requestId, source, length) {
    const payload = new Int32Array(length);
    payload.set(source.subarray(0, length));
    self.postMessage(
        {
            type: "progress",
            requestId,
            visitedIds: payload,
        },
        [payload.buffer],
    );
}

function pauseWorker() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

function isCanceled(requestId) {
    return canceledRequests.has(requestId);
}

function clearCanceled(requestId) {
    canceledRequests.delete(requestId);
}

function postError(requestId, error) {
    self.postMessage({
        type: "error",
        requestId,
        error: error instanceof Error ? error.message : String(error),
    });
    clearCanceled(requestId);
}
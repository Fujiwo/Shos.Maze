// Worker algorithms perform maze generation and A* search off the main thread.
// The implementation favors typed arrays, cellId math, and batched progress
// messages to keep large mazes responsive even at Super Hard size.
(function initializeMazeWorkerAlgorithms(workerScope) {
    const WorkerHeap = workerScope.MazeWorkerHeap;

    async function runGenerateRequest(size, requestId, controls) {
        const { isCanceled, pauseWorker } = controls;
        // A flat Uint8Array keeps memory compact and lets generation use cellId
        // arithmetic without allocating row/col wrapper objects.
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
            // Yield periodically so very large generation runs do not monopolize
            // the Worker event loop and delay cancellation handling.
            if (stepsSinceYield >= 2048) {
                stepsSinceYield = 0;
                await pauseWorker();
            }
        }

        grid[startId] = 1;
        grid[goalId] = 1;

        return { grid, startId, goalId };
    }

    async function runSolveRequest(grid, size, startId, goalId, batchSize, requestId, controls) {
        const { isCanceled, pauseWorker, postSolveRequestProgress } = controls;
        const totalCells = size * size;
        // Typed arrays keep the A* bookkeeping dense and predictable for large
        // grids, where object-heavy structures become noticeably more expensive.
        const cameFrom = new Int32Array(totalCells);
        const gScore = new Float64Array(totalCells);
        const closedSet = new Uint8Array(totalCells);
        const openHeap = new WorkerHeap();
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
                    postSolveRequestProgress(requestId, currentBatch, currentBatchCount);
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
                postSolveRequestProgress(requestId, currentBatch, currentBatchCount);
                currentBatch = new Int32Array(batchSize);
                currentBatchCount = 0;
            }

            iterationsSinceYield += 1;
            // Progress is emitted in batches so the main thread can animate the
            // search without paying the overhead of one message per visited cell.
            if (iterationsSinceYield >= batchSize) {
                iterationsSinceYield = 0;
                if (currentBatchCount > 0) {
                    postSolveRequestProgress(requestId, currentBatch, currentBatchCount);
                    currentBatch = new Int32Array(batchSize);
                    currentBatchCount = 0;
                }
                await pauseWorker();
            }
        }

        if (currentBatchCount > 0) {
            postSolveRequestProgress(requestId, currentBatch, currentBatchCount);
        }

        return new Int32Array(0);
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
        // cellId-based Manhattan distance avoids constructing coordinate objects
        // while keeping the heuristic easy to audit.
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

    workerScope.MazeWorkerAlgorithms = {
        runGenerateRequest,
        runSolveRequest,
    };
})(self);
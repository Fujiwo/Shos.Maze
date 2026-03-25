// MazeRenderCanvas owns canvas sizing and drawing. It keeps static maze pixels,
// coordinate caches, and incremental overlays separate so large grids can redraw
// without repainting every cell on every animation frame.
(function initializeMazeRenderCanvas() {
    const { MAZE_PALETTE } = window.MazeAppConfig;

    class MazeRenderCanvas {
        constructor(canvas, stageElement) {
            this.canvas = canvas;
            this.stageElement = stageElement;
            this.context = canvas.getContext("2d");
            this.palette = MAZE_PALETTE;
            this.cellSize = 0;
            this.staticCanvas = document.createElement("canvas");
            this.staticContext = this.staticCanvas.getContext("2d");
            this.staticContext.imageSmoothingEnabled = false;
            this.context.imageSmoothingEnabled = false;
            this.renderCache = {
                mazeGrid: null,
                visitedCount: 0,
                pathCount: 0,
            };
            this.coordinateCache = {
                gridSize: 0,
                dimension: 0,
                xByCellId: new Float32Array(0),
                yByCellId: new Float32Array(0),
                markerXByCellId: new Float32Array(0),
                markerYByCellId: new Float32Array(0),
                markerSize: 0,
            };
            this.pathSupport = typeof Path2D === "function";
        }

        resize(gridSize) {
            const bounds = this.stageElement.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const availableHeight = Math.max(240, viewportHeight - bounds.top - 32);
            const dimension = Math.max(240, Math.floor(Math.min(bounds.width, availableHeight)));
            const resized = this.canvas.width !== dimension || this.canvas.height !== dimension;
            const cacheStale =
                this.coordinateCache.gridSize !== gridSize ||
                this.coordinateCache.dimension !== dimension;

            if (!resized && !cacheStale) {
                return false;
            }

            if (resized) {
                this.canvas.width = dimension;
                this.canvas.height = dimension;
                this.staticCanvas.width = dimension;
                this.staticCanvas.height = dimension;
            }

            this.cellSize = dimension / gridSize;
            this.context.imageSmoothingEnabled = false;
            this.staticContext.imageSmoothingEnabled = false;
            this.ensureCoordinateCache(gridSize, dimension);
            return resized;
        }

        ensureCoordinateCache(gridSize, dimension) {
            if (
                this.coordinateCache.gridSize === gridSize &&
                this.coordinateCache.dimension === dimension
            ) {
                return;
            }

            // Cache every cell's drawing coordinates once per size/dimension pair
            // so render-time work stays proportional to changed cells only.
            const totalCells = gridSize * gridSize;
            const xByCellId = new Float32Array(totalCells);
            const yByCellId = new Float32Array(totalCells);
            const markerXByCellId = new Float32Array(totalCells);
            const markerYByCellId = new Float32Array(totalCells);
            const markerInset = Math.max(2, this.cellSize * 0.18);
            const markerSize = Math.max(2, this.cellSize - markerInset * 2);
            let cellId = 0;

            for (let row = 0; row < gridSize; row += 1) {
                const y = row * this.cellSize;
                for (let col = 0; col < gridSize; col += 1) {
                    const x = col * this.cellSize;
                    xByCellId[cellId] = x;
                    yByCellId[cellId] = y;
                    markerXByCellId[cellId] = x + markerInset;
                    markerYByCellId[cellId] = y + markerInset;
                    cellId += 1;
                }
            }

            this.coordinateCache = {
                gridSize,
                dimension,
                xByCellId,
                yByCellId,
                markerXByCellId,
                markerYByCellId,
                markerSize,
            };
        }

        render(state) {
            if (!state.mazeGrid || state.gridSize === 0) {
                return;
            }

            const resized = this.resize(state.gridSize);
            const mazeChanged = this.renderCache.mazeGrid !== state.mazeGrid;
            const countsReset =
                state.renderedVisitedCount < this.renderCache.visitedCount ||
                state.renderedPathCount < this.renderCache.pathCount;
            // Full redraw is only needed when geometry changed, the maze changed,
            // or animation progress moved backward after a reset or rollback.
            const requiresFullRedraw = resized || mazeChanged || countsReset;

            if (resized || mazeChanged) {
                this.drawStaticLayer(state);
            }

            if (requiresFullRedraw) {
                this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.context.drawImage(this.staticCanvas, 0, 0);
                this.drawCellsByIdRange(
                    state.visitedOrder,
                    0,
                    state.renderedVisitedCount,
                    this.palette.visited,
                    this.context,
                );
                this.drawCellsByIdRange(
                    state.shortestPath,
                    0,
                    state.renderedPathCount,
                    this.palette.solution,
                    this.context,
                );
            } else {
                this.drawCellsByIdRange(
                    state.visitedOrder,
                    this.renderCache.visitedCount,
                    state.renderedVisitedCount,
                    this.palette.visited,
                    this.context,
                );
                this.drawCellsByIdRange(
                    state.shortestPath,
                    this.renderCache.pathCount,
                    state.renderedPathCount,
                    this.palette.solution,
                    this.context,
                );
            }

            this.drawMarkerById(state.startId, this.palette.start, this.context);
            this.drawMarkerById(state.goalId, this.palette.goal, this.context);

            this.renderCache = {
                mazeGrid: state.mazeGrid,
                visitedCount: state.renderedVisitedCount,
                pathCount: state.renderedPathCount,
            };
        }

        drawStaticLayer(state) {
            const context = this.staticContext;
            const grid = state.mazeGrid;
            const { xByCellId, yByCellId } = this.coordinateCache;
            const wallPath = this.pathSupport ? new Path2D() : null;
            const routePath = this.pathSupport ? new Path2D() : null;

            context.clearRect(0, 0, this.staticCanvas.width, this.staticCanvas.height);

            if (this.pathSupport) {
                // Path2D drastically reduces draw calls on dense grids, while the
                // fillRect branch preserves compatibility in simpler environments.
                for (let cellId = 0; cellId < grid.length; cellId += 1) {
                    const targetPath = grid[cellId] === 0 ? wallPath : routePath;
                    targetPath.rect(
                        xByCellId[cellId],
                        yByCellId[cellId],
                        this.cellSize,
                        this.cellSize,
                    );
                }

                context.fillStyle = this.palette.wall;
                context.fill(wallPath);
                context.fillStyle = this.palette.path;
                context.fill(routePath);
            } else {
                for (let cellId = 0; cellId < grid.length; cellId += 1) {
                    context.fillStyle = grid[cellId] === 0 ? this.palette.wall : this.palette.path;
                    context.fillRect(
                        xByCellId[cellId],
                        yByCellId[cellId],
                        this.cellSize,
                        this.cellSize,
                    );
                }
            }

            this.drawMarkerById(state.startId, this.palette.start, context);
            this.drawMarkerById(state.goalId, this.palette.goal, context);
        }

        drawCellsByIdRange(ids, startIndex, endIndex, color, context) {
            if (!ids || endIndex <= startIndex) {
                return;
            }

            const { xByCellId, yByCellId } = this.coordinateCache;

            if (this.pathSupport) {
                const path = new Path2D();

                for (let index = startIndex; index < endIndex; index += 1) {
                    const cellId = ids[index];
                    path.rect(
                        xByCellId[cellId],
                        yByCellId[cellId],
                        this.cellSize,
                        this.cellSize,
                    );
                }

                context.fillStyle = color;
                context.fill(path);
                return;
            }

            context.fillStyle = color;
            for (let index = startIndex; index < endIndex; index += 1) {
                const cellId = ids[index];
                context.fillRect(
                    xByCellId[cellId],
                    yByCellId[cellId],
                    this.cellSize,
                    this.cellSize,
                );
            }
        }

        drawMarkerById(cellId, color, context) {
            if (cellId < 0) {
                return;
            }

            const { markerXByCellId, markerYByCellId, markerSize } = this.coordinateCache;
            context.fillStyle = color;
            context.fillRect(
                markerXByCellId[cellId],
                markerYByCellId[cellId],
                markerSize,
                markerSize,
            );
        }
    }

    window.MazeRenderCanvas = MazeRenderCanvas;
})();
(function initializeMazeWorkerHeap(workerScope) {
    class WorkerHeap {
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

    workerScope.MazeWorkerHeap = WorkerHeap;
})(self);
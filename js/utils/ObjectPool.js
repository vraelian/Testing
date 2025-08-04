// js/utils/ObjectPool.js
export class ObjectPool {
    constructor(createFn, resetFn) {
        this.pool = [];
        this.createFn = createFn; // Function to create a new object
        this.resetFn = resetFn;   // Function to reset an object for reuse
    }

    get() {
        if (this.pool.length > 0) {
            const obj = this.pool.pop();
            this.resetFn(obj);
            return obj;
        }
        return this.createFn();
    }

    release(obj) {
        this.pool.push(obj);
    }
}
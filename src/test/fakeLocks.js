// Minimal controllable stand-in for the Web Locks API (navigator.locks).
// jsdom ships none, and SessionContext's primary-window election needs one that
// actually honors a FIFO wait queue so we can test failover/promotion.
//
// Supported shapes:
//   request(name, cb)                         -> queued if held, else granted now
//   request(name, { signal }, cb)             -> same (signal is accepted, ignored)
//   request(name, { ifAvailable: true }, cb)  -> cb(null) immediately if held, never queues
//
// Test controls:
//   locks.__release(name)      force-release the current holder (simulates its
//                              window dying); drains the next queued waiter FIFO
//   locks.__queueLength(name)  number of waiters parked on `name`
//   locks.__isHeld(name)       whether `name` currently has a holder

export function createFakeLockManager() {
    const held = new Map();   // name -> { release: fn }
    const queues = new Map(); // name -> [{ cb, resolveOuter }]

    const queueFor = (name) => {
        if (!queues.has(name)) queues.set(name, []);
        return queues.get(name);
    };

    async function grant(name, cb) {
        let releaseHolder;
        const holderDone = new Promise((res) => { releaseHolder = res; });
        held.set(name, { release: releaseHolder });

        const lockObj = { name, mode: 'exclusive' };
        // Hold the lock until the callback's promise settles OR __release fires.
        Promise.resolve()
            .then(() => cb(lockObj))
            .then(() => releaseHolder(), () => releaseHolder());

        await holderDone;
        held.delete(name);

        const q = queueFor(name);
        if (q.length > 0) {
            const next = q.shift();
            // Detached: let __release's caller return before the next waiter runs.
            grant(name, next.cb).then(next.resolveOuter, next.resolveOuter);
        }
    }

    const locks = {
        request(name, optionsOrCb, maybeCb) {
            let options = {};
            let cb;
            if (typeof optionsOrCb === 'function') {
                cb = optionsOrCb;
            } else {
                options = optionsOrCb || {};
                cb = maybeCb;
            }

            if (!held.has(name)) {
                return grant(name, cb);
            }
            if (options.ifAvailable) {
                return Promise.resolve().then(() => cb(null));
            }
            return new Promise((resolveOuter) => {
                queueFor(name).push({ cb, resolveOuter });
            });
        },

        __release(name) {
            const h = held.get(name);
            if (h) h.release();
        },
        __queueLength(name) {
            return queueFor(name).length;
        },
        __isHeld(name) {
            return held.has(name);
        },
    };

    return locks;
}

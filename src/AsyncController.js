const STATUS = {
    WAITING: 1,
    EXECUTING: 2,
    FINISHED: 3,
    FAILED: 4,
    ABORTED: 5,
}

const QUEUE_LIMIT = 5

const canAbort = task => [ STATUS.EXECUTING, STATUS.WAITING ].includes(task.status)

function makeDelay (delay) {
    return new Promise((resolve) => setTimeout(resolve, delay))
}
function abortCallback (task, callback) {
    return (res) => {
        if (canAbort(task) && callback) {
            return callback(res)
        }
        return task
    }
}

function abortify (task, genPro, resolve, reject, options = {}) {
    const { delay = 0 } = options
    const abortThen = abortCallback(task, (res) => {
        task.status = STATUS.FINISHED
        return resolve && resolve(res)
    })
    const abortCatch = abortCallback(task, (res) => {
        task.status = STATUS.FAILED
        return reject && reject(res)
    })
    const getAbPro = () => genPro().then(abortThen).catch(abortCatch)
    if (delay <= 0) return getAbPro()
    return makeDelay(delay).then(abortCallback(task, () => getAbPro()))
}


class AsyncController {
    tasks = []
    reqNum = 0
    register (spec, genPro, resolve, reject, options) {
        const task = { ...spec, status: STATUS.EXECUTING, reqNum: this.reqNum }
        task.pro = abortify(task, genPro, resolve, reject, options)
        this.tasks.push(task)
        if (this.tasks.length >= QUEUE_LIMIT) {
            this.clearIdleTask()
        }
        this.reqNum += 1
        return task
    }
    abort (matchFunc) {
        this.tasks.filter(canAbort).filter(matchFunc).forEach(task => {
            task.status = STATUS.ABORTED
            if (task.cancel) {
                task.cancel()
            }
        })
        this.clearIdleTask()
    }
    abortAll () {
        this.abort(() => true)
    }
    clearIdleTask () {
        this.tasks = this.tasks.filter(canAbort)
    }
    getTask (matchFunc) {
        return this.tasks.filter(canAbort).find(matchFunc)
    }
}

export function mixinAsyncController (component) {
    const controller = new AsyncController()
    if (!component.componentWillUnmount) {
        component.componentWillUnmount = () => controller.abortAll()
    } else {
        const originFunc = component.componentWillUnmount
        component.componentWillUnmount = () => {
            controller.abortAll()
            originFunc.call(component)
        }
    }
    return controller
}
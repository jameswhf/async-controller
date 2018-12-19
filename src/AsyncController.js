
const STATUS = {
    WAITING: 1,
    EXECUTING: 2,
    FINISHED: 3,
    FAILED: 4,
    ABORTED: 5,
}

const QUEUE_LIMIT = 5

const isAborted = task => task.status === STATUS.ABORTED
const canAbort = task => task.status === STATUS.EXECUTING || STATUS.WAITING


class AsyncController {
    tasks = []
    register (spec, pro, resolve, reject) {
        const task = { ...spec, status: STATUS.EXECUTING }
        task.pro = pro.then(res => {
            if (!isAborted(task) && resolve) {
                task.status = STATUS.FINISHED
                return resolve(res)
            }
        }).catch(err => {
            if (!isAborted(task) && reject) {
                task.status = STATUS.FAILED
                return reject(err)
            }
        })
        this.tasks.push(task)
        if (this.tasks.length >= QUEUE_LIMIT) {
            this.clearIdleTask()
        }
    }
    abort (matchFunc) {
        this.tasks.filter(canAbort).filter(matchFunc).forEach(task => { task.status = STATUS.ABORTED })
        this.clearIdleTask()
    }
    abortAll () {
        this.abort(() => true)
    }
    clearIdleTask () {
        this.tasks = this.tasks.filter(canAbort)
    }
}

function mixinAsyncController (component) {
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
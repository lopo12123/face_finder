export class RafController {
    #rafId = -1
    #video: HTMLVideoElement
    #playing = false

    constructor() {
        const _video = document.createElement('video')
        _video.autoplay = true
        _video.playsInline = true
        _video.width = 1
        _video.height = 1
        this.#video = _video
    }

    private stream(): Promise<void> {
        if(this.#playing) return Promise.resolve()
        else {
            return navigator.mediaDevices
                .getUserMedia({ video: true, audio: false })
                .then(stream => {
                    console.log('setup stream')
                    this.#video.srcObject = stream
                })
        }
    }

    public start(ctx: CanvasRenderingContext2D) {
        const _this = this
        const rafLoop = (t: DOMHighResTimeStamp) => {
            console.log(t)
            ctx.drawImage(_this.#video, 0, 0)
            _this.#rafId = requestAnimationFrame(rafLoop)
        }

        return this.stream()
            .then(() => {
                rafLoop(performance.now())
            })
    }

    public stop() {
        console.log(this.#rafId)
        cancelAnimationFrame(this.#rafId)
    }
}
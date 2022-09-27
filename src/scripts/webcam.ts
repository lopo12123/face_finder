export type FrameCallback = (video: HTMLVideoElement, dtInMs: DOMHighResTimeStamp) => void

// export const CascadeUrl = './facefinder'
// export const PuplocUrl = './puploc.bin'

export class WebCam {
    #rafId: number = -1
    #video: HTMLVideoElement

    constructor() {
        const _video = document.createElement('video')
        _video.autoplay = true
        _video.playsInline = true
        _video.width = 1
        _video.height = 1
        this.#video = _video
    }

    // setup stream from user-media
    private stream() {
        return new Promise<void>((resolve, reject) => {
            navigator
                .mediaDevices
                .getUserMedia({ video: true, audio: false })
                .then(stream => {
                    this.#video.srcObject = stream
                    resolve()
                })
                .catch(err => {
                    reject(err)
                })
        })
    }

    // raf
    private raf(cb?: FrameCallback) {
        const self = this
        let last_t = performance.now()

        const loop = (t: DOMHighResTimeStamp) => {
            cb?.(self.#video, t - last_t)
            last_t = t
            self.#rafId = requestAnimationFrame(loop)
        }

        this.#rafId = requestAnimationFrame(loop)
    }

    /**
     * @description start raf - with custom callback closure
     * @description auto-stop the old one if exist
     */
    start_custom(cb?: FrameCallback) {
        this.stop()

        this.stream()
            .then(() => {
                this.raf(cb)
            })
            .catch(err => {
                console.log(err)
            })
    }

    /**
     * @description start raf - just do the render work
     * @description auto-stop the old one if exist
     */
    start_pure(ctx: CanvasRenderingContext2D) {
        this.start_custom((el, dt) => {
            ctx.drawImage(el, 0, 0)
        })
    }

    /**
     * @description
     * @description auto-stop the old one if exist
     * @param ctx_base 底图画布 ctx
     * @param ctx_mark 标记画布 ctx
     * @param mark_render 绘制函数 (不传入则使用默认绘制)
     */
    start_detect(
        ctx_base: CanvasRenderingContext2D,
        ctx_mark: CanvasRenderingContext2D,
        mark_render?: (x: number, y: number, radius: number) => void
    ) {

    }

    /**
     * @description stop curr raf
     * @return boolean - if a raf has been stopped
     */
    stop() {
        if(this.#rafId !== -1) {
            cancelAnimationFrame(this.#rafId)
            this.#rafId = -1
            return true
        }
        return false
    }
}
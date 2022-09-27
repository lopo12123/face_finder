import { CascadeParam, ClassifyRegion, ImageSource, Pico } from "./pico";

export type FrameCallback = (video: HTMLVideoElement, dtInMs: DOMHighResTimeStamp) => void

export const CascadeUrl = './facefinder'
export const PuplocUrl = './puploc.bin'

/**
 * @description rgba => gray
 * @description gray = 0.2 * red + 0.7 * green + 0.1 * blue
 */
const rgba2grayscale = (rgba: Uint8ClampedArray, nrows: number, ncols: number) => {
    const gray = new Uint8Array(nrows * ncols)
    for (let r = 0; r < nrows; r++) {
        for (let c = 0; c < ncols; c++) {
            // 4个一组 [r, g, b, a]
            const _pixel_start_idx = (r * ncols + c) * 4
            gray[r * ncols + c] = (
                7 * rgba[_pixel_start_idx] +
                7 * rgba[_pixel_start_idx + 1] +
                rgba[_pixel_start_idx + 2]
            ) / 10
        }
    }
    return gray
}

/**
 * @description default renderer to render the detected face.
 */
const default_renderer = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2, false)
    ctx.lineWidth = 3
    ctx.strokeStyle = 'red'
    ctx.stroke()
}

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

    // load file `facefinder`, return the classify_region function
    private load_faceFinder(): Promise<ClassifyRegion> {
        return new Promise((resolve, reject) => {
            fetch(CascadeUrl)
                .then(res => res.arrayBuffer())
                .then(buffer => {
                    const bytes = new Int8Array(buffer)
                    const classify_region = Pico.unpack_cascade(bytes)
                    console.log('[WebCam] face_finder loaded.')
                    resolve(classify_region)
                })
                .catch(err => {
                    reject(err)
                })
        })
    }

    /**
     * @description start raf - with custom callback closure
     * @description auto-stop the old one if exist
     */
    start_custom(cb?: FrameCallback) {
        this.stop()

        return this.stream()
            .then(() => {
                this.raf(cb)
            })
    }

    /**
     * @description start raf - just do the render work
     * @description auto-stop the old one if exist
     */
    start_pure(ctx: CanvasRenderingContext2D) {
        return this.start_custom((el, dt) => {
            ctx.drawImage(el, 0, 0)
        })
    }

    /**
     * @description start raf - do render work and detect work
     * @description auto-stop the old one if exist
     * @param ctx_base 底图画布 ctx
     * @param ctx_mark 标记画布 ctx
     * @param custom_renderer 绘制函数 (不传入则使用默认绘制)
     */
    start_detect(
        ctx_base: CanvasRenderingContext2D,
        ctx_mark: CanvasRenderingContext2D,
        custom_renderer?: (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => void
    ) {
        const canvas_base = ctx_base.canvas
        const canvas_mark = ctx_mark.canvas

        canvas_base.width = canvas_base.clientWidth
        canvas_base.height = canvas_base.clientHeight
        canvas_mark.width = canvas_mark.clientWidth
        canvas_mark.height = canvas_mark.clientHeight

        const { width, height } = canvas_base
        const rgba = ctx_base.getImageData(0, 0, width, height).data

        const update_memory = Pico.instantiate_detection_memory(5)
        const image: ImageSource = {
            pixels: rgba2grayscale(rgba, height, width),
            nrows: height,
            ncols: width,
            ldim: Math.max(width, height)
        }
        const param: CascadeParam = {
            minsize: 100,
            maxsize: 1000,
            scalefactor: 1.1,
            shiftfactor: 0.1
        }

        return this.load_faceFinder()
            .then(classify_region => {
                const renderer = custom_renderer ?? default_renderer
                const update_fn = (el: HTMLVideoElement) => {
                    // run the cascade over the frame and cluster the obtained detections
                    // dets is an array that contains (r, c, s, q) quadruplets
                    // representing (row, column, scale and detection score)
                    let dets = Pico.run_cascade(image, classify_region, param)
                    dets = update_memory(dets)

                    // set IoU threshold to 0.2
                    dets = Pico.cluster_detection(dets, 0.2)

                    // draw detections
                    for (let i = 0; i < dets.length; i++) {
                        // check the detection score, if it's above the threshold, draw it.
                        // the constant 50.0 is empirical: other cascades might require a different one.
                        if(dets[i][3] > 50) {
                            const [ row, col, scale ] = dets[i]
                            renderer(ctx_mark, col, row, scale)
                        }
                    }

                    ctx_base.drawImage(el, 0, 0)
                }

                return this.start_custom(update_fn)
            })
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
import {
    FaceFinderFilePath,
    ClassifyRegion,
    Pico,
    ImageSource,
    CascadeParam,
    QThreshold,
    IoUThreshold
} from "./scripts/pico";

// raf 每帧调用的回调
export type RafCallback = (video: HTMLVideoElement, dt: DOMHighResTimeStamp) => void
// 标记绘制
export type DetectionRenderer = (ctx: CanvasRenderingContext2D, loc: [ x: number, y: number, radius: number ]) => void

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

// 默认标记绘制方式
const DefaultRenderer: DetectionRenderer = (ctx: CanvasRenderingContext2D, [ x, y, radius ]) => {
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2, false)
    ctx.lineWidth = 3
    ctx.strokeStyle = 'red'
    ctx.stroke()
}

// facefinder文件加载器
const faceFinderLoader = (): Promise<ClassifyRegion> => {
    return new Promise<ClassifyRegion>((resolve, reject) => {
        fetch(FaceFinderFilePath)
            .then(res => res.arrayBuffer())
            .then(buffer => {
                const bytes = new Int8Array(buffer)
                const classify_region = Pico.unpack_cascade(bytes)
                console.log('[FaceFinder] "face_finder" loaded.')
                resolve(classify_region)
            })
            .catch(err => reject(err))
    })
}

// 单图检测
const imageDetect = (source: ImageData, width: number, height: number, ctx: CanvasRenderingContext2D, renderer?: DetectionRenderer) => {
    const update_memory = Pico.instantiate_detection_memory(5)
    const image: ImageSource = {
        pixels: rgba2grayscale(source.data, height, width),
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
    const _renderer = renderer || DefaultRenderer

    return faceFinderLoader()
        .then(classify_region => {
            let dets = Pico.run_cascade(image, classify_region, param)
            dets = update_memory(dets)
            dets = Pico.cluster_detection(dets, 0.2)

            for (let i = 0; i < dets.length; i++) {
                if(dets[i][3] > 50) {
                    const [ row, col, scale ] = dets[i]
                    _renderer(ctx, [ col, row, scale ])
                }
            }
        })
}

// 获取图片文件尺寸
export const getImageSize = (file: File) => {
    return new Promise<[ number, number ]>((resolve, reject) => {
        const img = new Image()
        const reader = new FileReader()
        reader.onload = () => {
            img.src = reader.result as string
            if(img.complete) resolve([ img.width, img.height ])
            else {
                img.onload = () => {
                    resolve([ img.width, img.height ])
                }
            }
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

export class FaceFinder {
    #rafId = -1
    #video: HTMLVideoElement

    // region 播放状态相关
    // 内部读写 是否正在播放
    #playing = false

    // 外部只读 是否正在播放
    get playing() {
        return this.#playing
    }

    // 播放状态改变回调
    onPlayingChange: ((to: boolean) => void) | null = null

    // endregion

    constructor() {
        const _video = document.createElement('video')
        _video.autoplay = true
        _video.playsInline = true
        _video.width = 1
        _video.height = 1
        this.#video = _video
    }

    // region 视频流检测
    /**
     * @description 获取视频流
     */
    private requestStream(): Promise<void> {
        if(this.#playing) return Promise.resolve()
        else {
            return navigator.mediaDevices
                .getUserMedia({ video: true, audio: false })
                .then(stream => {
                    console.log(`[FaceFinder] media-stream ready. (id: ${ stream.id })`)
                    this.#video.srcObject = stream
                })
        }
    }

    /**
     * @description raf 自定义回调
     */
    private start_custom(cb: RafCallback) {
        if(this.#rafId !== -1) return Promise.reject(new Error('Active raf already exist.'))
        const _super = this
        let last_t: DOMHighResTimeStamp

        const rafLoop = (t: DOMHighResTimeStamp) => {
            cb(_super.#video, t - last_t)
            last_t = t
            _super.#rafId = requestAnimationFrame(rafLoop)
        }

        return this.requestStream()
            .then(() => {
                last_t = performance.now()
                rafLoop(last_t)
                this.#playing = true
                this.onPlayingChange?.(true)
            })
    }

    /**
     * @description 仅渲染视频流
     */
    public start_pure(ctx: CanvasRenderingContext2D) {
        return this.start_custom((video) => {
            ctx.drawImage(video, 0, 0)
        })
    }

    /**
     * @description 渲染底图 + 标记
     */
    public start_detect(ctx_base: CanvasRenderingContext2D, ctx_mark: CanvasRenderingContext2D, renderer?: DetectionRenderer) {
        const cvs_base = ctx_base.canvas
        const cvs_mark = ctx_mark.canvas

        cvs_base.width = cvs_base.clientWidth
        cvs_base.height = cvs_base.clientHeight
        cvs_mark.width = cvs_mark.clientWidth
        cvs_mark.height = cvs_mark.clientHeight

        const { width, height } = cvs_base
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

        return faceFinderLoader()
            .then(classify_region => {
                const _renderer = renderer ?? DefaultRenderer
                const updateFn = (el: HTMLVideoElement) => {
                    ctx_base.drawImage(el, 0, 0)

                    // run the cascade over the frame and cluster the obtained detections
                    // dets is an array that contains (r, c, s, q) quadruplets
                    // representing (row, column, scale and detection score)
                    let dets = Pico.run_cascade(image, classify_region, param)
                    dets = update_memory(dets)

                    // set IoU threshold
                    dets = Pico.cluster_detection(dets, IoUThreshold)

                    // draw detections
                    for (let i = 0; i < dets.length; i++) {
                        // check the detection score, if it's above the threshold, draw it.
                        // the constant 50.0 is empirical: other cascades might require a different one.
                        if(dets[i][3] > QThreshold) {
                            const [ row, col, scale ] = dets[i]
                            _renderer(ctx_mark, [ col, row, scale ])
                        }
                    }
                }
                return this.start_custom(updateFn)
            })
    }

    /**
     * @description 停止 raf
     */
    public stop(close_stream: boolean = true) {
        if(this.#rafId !== -1) {
            cancelAnimationFrame(this.#rafId)
            this.#rafId = -1
            if(close_stream) this.#video.srcObject = null
            console.log('[FaceFinder] raf has been cancelled')
            this.#playing = false
            this.onPlayingChange?.(false)
            return true
        }
        else {
            console.log('[FaceFinder] no raf is running')
            return false
        }
    }

    // endregion

    // region 单图检测 todo
    public single_detect(file: File, ctx: CanvasRenderingContext2D) {
        if(!file.type.startsWith('image/')) return Promise.reject('File type error.')

        getImageSize(file)
            .then(_size => {
                const reader = new FileReader()
                const img = new Image(..._size)
                reader.onload = () => {
                    img.src = reader.result as string
                    img.onload = () => {
                        const _cvs = document.createElement('canvas')
                        _cvs.width = _size[0]
                        _cvs.height = _size[1]
                        const _ctx = _cvs.getContext('2d')!
                        _ctx.drawImage(img, 0, 0)
                        const image_data = _ctx.getImageData(0, 0, _size[0], _size[1])
                        imageDetect(image_data, _size[0], _size[1], ctx)
                            .then(() => {
                                console.log('done')
                            })
                            .catch(err => {
                                console.log(err)
                            })
                    }
                }
                reader.readAsDataURL(file)
            })
    }

    // endregion
}
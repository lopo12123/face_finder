/**
 * @description we skip the first 8 bytes of the cascade file
 * (cascade version number and some data used during the learning process)
 */
const CascadeOffset = 8

export type ClassifyRegion = (row: number, col: number, s: number, pixels: number[], ldim: number) => number
export type ImageSource = {
    nrows: number
    ncols: number
    pixels: number[]
    ldim: number
}
export type CascadeParam = {
    minsize: number
    maxsize: number
    shiftfactor: number
    scalefactor: number
}
export type DetectionUnit = [ row: number, column: number, scale: number, quality: number ]
export type DetectionList = DetectionUnit[]

export abstract class Pico {
    // unpack cascade
    public static unpack_cascade(bytes: Array<any>): ClassifyRegion {
        // region 获取树的深度、大小信息
        // 构建一个4字节大小的视图
        const data_view = new DataView(new ArrayBuffer(4))

        // 每个树的深度(大小): 32位有符号数, 小端序读取 (32-bit signed integer)
        data_view.setUint8(0, bytes[CascadeOffset])
        data_view.setUint8(1, bytes[CascadeOffset + 1])
        data_view.setUint8(2, bytes[CascadeOffset + 2])
        data_view.setUint8(3, bytes[CascadeOffset + 3])
        // 每个树的深度(大小)
        const treeDepth = data_view.getInt32(0, true)

        // 树的个数: 32位有符号数, 小端序读取 (32-bit signed integer)
        data_view.setUint8(0, bytes[CascadeOffset + 4])
        data_view.setUint8(1, bytes[CascadeOffset + 5])
        data_view.setUint8(2, bytes[CascadeOffset + 6])
        data_view.setUint8(3, bytes[CascadeOffset + 7])
        // 树的个数
        const treeCount = data_view.getInt32(0, true)
        // endregion

        // region 读取树数据和阈值
        // 树数据起始位置: CascadeOffset + 8 (树深度信息4 + 树大小信息4)
        let p = CascadeOffset + 8
        // 每个树所占长度(字节)
        const treeLength = 4 * Math.pow(2, treeDepth) - 4

        // 树 列表 code
        const tree_code_list: number[] = []
        // 预测 列表 prediction
        const tree_pred_list: number[] = []
        // 阈值 列表 threshold
        const threshold_list: number[] = []

        for (let tree_idx = 0; tree_idx < treeCount; tree_idx++) {
            // 读取树
            Array.prototype.push.apply(tree_code_list, [ 0, 0, 0, 0 ])
            Array.prototype.push.apply(tree_code_list, bytes.slice(p, p + treeLength))
            p += treeLength

            // 读取预测
            for (let i = 0; i < treeLength + 4; i++) {
                data_view.setUint8(0, bytes[p])
                data_view.setUint8(1, bytes[p + 1])
                data_view.setUint8(2, bytes[p + 2])
                data_view.setUint8(3, bytes[p + 3])
                tree_pred_list.push(data_view.getFloat32(0, true))
                p += 4
            }

            // 读取阈值
            data_view.setUint8(0, bytes[p])
            data_view.setUint8(1, bytes[p + 1])
            data_view.setUint8(2, bytes[p + 2])
            data_view.setUint8(3, bytes[p + 3])
            threshold_list.push(data_view.getFloat32(0, true))
            p += 4
        }
        // endregion

        // 使用 typed array 存储
        const tree_code = new Int8Array(tree_code_list)
        const tree_pred = new Float32Array(tree_pred_list)
        const threshold = new Float32Array(threshold_list)

        // 构造分类函数 (classification function)
        return (row: number, col: number, s: number, pixels: number[], ldim: number) => {
            row *= 256
            col *= 256

            let root = 0
            let o = 0.0
            const pow2depth = Math.pow(2, treeDepth) >> 0

            for (let i = 0; i < treeCount; i++) {
                let idx = 1
                for (let j = 0; j < treeDepth; j++) {
                    // we use '>> 8' here to perform an integer division: this seems important for performance
                    idx = 2 * idx + (
                        pixels[((row + tree_code[root + 4 * idx] * s) >> 8) * ldim + ((col + tree_code[root + 4 * idx + 1] * s) >> 8)]
                        <= pixels[((row + tree_code[root + 4 * idx + 2] * s) >> 8) * ldim + ((col + tree_code[root + 4 * idx + 3] * s) >> 8)]
                            ? 1 : 0
                    )
                }
                o = o + tree_pred[pow2depth * i + idx - pow2depth]

                if(o < threshold[i]) return -1

                root += 4 * pow2depth
            }

            return o - threshold[treeCount - 1]
        }
    }

    // run cascade
    public static run_cascade(image: ImageSource, classify_region: ClassifyRegion, params: CascadeParam) {
        const { nrows, ncols, pixels, ldim } = image
        const { minsize, maxsize, shiftfactor, scalefactor } = params

        let scale = minsize
        const detections: DetectionList = []

        while (scale < maxsize) {
            const step = Math.max(shiftfactor * scale, 1) >> 0
            const offset = (scale / 2 + 1) >> 0

            for (let r = offset; r <= nrows - offset; r += step)
                for (let c = offset; c <= ncols - offset; c += step) {
                    const q = classify_region(r, c, scale, pixels, ldim)
                    if(q > 0) detections.push([ r, c, scale, q ])
                }

            scale *= scalefactor
        }

        return detections
    }

    // cluster detection
    public static cluster_detection(dets: DetectionList, iouthreshold: number) {
        // 按照分数排序 (sort detections by their score)
        dets.sort((a, b) => b[3] - a[3])

        // 计算 IoU (this helper function calculates the intersection over union for two detections)
        const calculate_iou = (det1: DetectionUnit, det2: DetectionUnit) => {
            // unpack the position and size of each detection
            const [ r1, c1, s1 ] = det1
            const [ r2, c2, s2 ] = det2
            // calculate detection overlap in each dimension
            const over_r = Math.max(0, Math.min(r1 + s1 / 2, r2 + s2 / 2) - Math.max(r1 - s1 / 2, r2 - s2 / 2));
            const over_c = Math.max(0, Math.min(c1 + s1 / 2, c2 + s2 / 2) - Math.max(c1 - s1 / 2, c2 - s2 / 2));
            // calculate and return IoU
            return over_r * over_c / (s1 * s1 + s2 * s2 - over_r * over_c)
        }

        // do clustering through non-maximum suppression
        const assignments: number[] = new Array(dets.length).fill(0)
        const clusters: DetectionList = []

        for (let i = 0; i < dets.length; i++) {
            // is this detection assigned to a cluster?
            if(assignments[i] === 0) {
                // it is not:
                // now we make a cluster out of it and see whether some other detections belong to it
                let r = 0, c = 0, s = 0, q = 0, n = 0
                for (let j = i; j < dets.length; j++) {
                    if(calculate_iou(dets[i], dets[j]) > iouthreshold) {
                        assignments[j] = 1
                        r += dets[j][0]
                        c += dets[j][1]
                        s += dets[j][2]
                        q += dets[j][3]
                        n += 1
                    }
                }
                // make a cluster representative
                clusters.push([ r / n, c / n, s / n, q ])
            }
        }

        return clusters
    }

    // instantiate detection memory
    public static instantiate_detection_memory(size: number) {
        // initialize a circular buffer of `size` elements
        const memory: DetectionList[] = new Array(size).fill(0).map(_ => [])

        let n = 0
        // build a function that:
        // (1) inserts the current frame's detections into the buffer;
        // (2) merges all detections from the last `size` frames and returns them
        return (dets: DetectionList) => {
            memory[n] = dets
            n = (n + 1) % memory.length
            dets = []
            for (let i = 0; i < memory.length; i++)
                dets = dets.concat(memory[i])
            return dets
        }
    }
}
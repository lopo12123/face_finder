import { ImageSource } from "./pico";

export abstract class Lploc {
    // unpack localizer
    public static unpack_localizer(bytes: number[]) {
        // 构建一个4字节大小的视图
        const data_view = new DataView(new ArrayBuffer(4))

        let p = 0

        // region the number of stages, scale multiplier (applied after each stage), number of trees per stage and depth of each tree
        // the number of stages
        data_view.setUint8(0, bytes[p])
        data_view.setUint8(1, bytes[p + 1])
        data_view.setUint8(2, bytes[p + 2])
        data_view.setUint8(3, bytes[p + 3])
        p += 4
        const stageCount = data_view.getInt32(0, true)

        // scale multiplier
        data_view.setUint8(0, bytes[p])
        data_view.setUint8(1, bytes[p + 1])
        data_view.setUint8(2, bytes[p + 2])
        data_view.setUint8(3, bytes[p + 3])
        p += 4
        const scaleMulCounter = data_view.getFloat32(0, true)

        // number of trees per stage
        data_view.setUint8(0, bytes[p])
        data_view.setUint8(1, bytes[p + 1])
        data_view.setUint8(2, bytes[p + 2])
        data_view.setUint8(3, bytes[p + 3])
        p += 4
        const treeCountInStage = data_view.getInt32(0, true)

        // depth of each tree
        data_view.setUint8(0, bytes[p])
        data_view.setUint8(1, bytes[p + 1])
        data_view.setUint8(2, bytes[p + 2])
        data_view.setUint8(3, bytes[p + 3])
        p += 4
        const treeDepth = data_view.getInt32(0, true)
        // endregion

        // region unpack the trees
        // 每个树所占长度(字节)
        const treeLength = 4 * Math.pow(2, treeDepth) - 4

        const tree_code_list: number[] = []
        const tree_pred_list: number[] = []

        for (let i = 0; i < stageCount; i++) {
            // read the trees for this stage
            for (let j = 0; j < treeCountInStage; j++) {
                Array.prototype.push.apply(tree_code_list, bytes.slice(p, p + treeLength))
                p += treeLength
                // read the prediction in the leaf nodes of the tree
                for (let k = 0; k < treeLength + 4; k++) {
                    data_view.setUint8(0, bytes[p])
                    data_view.setUint8(1, bytes[p + 1])
                    data_view.setUint8(2, bytes[p + 2])
                    data_view.setUint8(3, bytes[p + 3])
                    tree_pred_list.push(data_view.getFloat32(0, true))
                    p += 4

                    data_view.setUint8(0, bytes[p])
                    data_view.setUint8(1, bytes[p + 1])
                    data_view.setUint8(2, bytes[p + 2])
                    data_view.setUint8(3, bytes[p + 3])
                    tree_pred_list.push(data_view.getFloat32(0, true))
                    p += 4
                }
            }
        }
        // endregion

        const tree_code = new Int8Array(tree_code_list)
        const tree_pred = new Float32Array(tree_pred_list)

        // the location estimation function
        const _location_estimation = (
            row: number, col: number,
            scale: number, pixels: number[],
            nrows: number, ncols: number,
            ldim: number
        ) => {
            const pow2depth = Math.pow(2, treeDepth) >> 0
            let root = 0

            for (let i = 0; i < stageCount; i++) {
                let dr = 0, dc = 0

                for (let j = 0; j < treeCountInStage; j++) {
                    let idx = 0

                    for (let k = 0; k < treeDepth; k++) {
                        const r1 = Math.min(nrows - 1, Math.max(0, (256 * row + tree_code[root + 4 * idx] * scale) >> 8))
                        const c1 = Math.min(ncols - 1, Math.max(0, (256 * col + tree_code[root + 4 * idx + 1] * scale) >> 8))
                        const r2 = Math.min(nrows - 1, Math.max(0, (256 * row + tree_code[root + 4 * idx + 2] * scale) >> 8))
                        const c2 = Math.min(ncols - 1, Math.max(0, (256 * col + tree_code[root + 4 * idx + 3] * scale) >> 8))

                        idx = 2 * idx + 1 + (pixels[r1 * ldim + c1] > pixels[r2 * ldim + c2] ? 1 : 0)
                    }

                    const lutidx = 2 * (treeCountInStage * pow2depth * i + pow2depth * j + idx - (pow2depth - 1))
                    dr += tree_pred[lutidx]
                    dc += tree_pred[lutidx + 1]

                    root += 4 * (pow2depth - 1)
                }

                row += dr * scale
                col += dc * scale

                scale *= scaleMulCounter
            }

            return [ row, col ]
        }

        return (row: number, col: number, scale: number, countPerTurb: number, image: ImageSource) => {
            const rows: number[] = []
            const cols: number[] = []

            for (let i = 0; i < countPerTurb; i++) {
                const _scale = scale * (0.925 + 0.15 * Math.random())
                let _row = row + scale * 0.15 * (0.5 - Math.random())
                let _col = col + scale * 0.15 * (0.5 - Math.random())

                ;[ _row, _col ] = _location_estimation(_row, _col, _scale, image.pixels, image.nrows, image.ncols, image.ldim)

                rows.push(_row)
                cols.push(_col)
            }

            // return the median along each axis
            rows.sort((a, b) => a - b)
            cols.sort((a, b) => a - b)

            return [
                rows[Math.round(countPerTurb / 2)],
                cols[Math.round(countPerTurb / 2)]
            ]
        }
    }
}
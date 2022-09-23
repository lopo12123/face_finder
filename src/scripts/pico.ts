/**
 * @description we skip the first 8 bytes of the cascade file
 * (cascade version number and some data used during the learning process)
 */
const CascadeOffset = 8

export abstract class Pico {
    public static unpack_cascade(bytes: ArrayLike<any>) {
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

        const tree_code_list: number[] = []
        const tree_pred_list: number[] = []
        const threshold_list: number[] = []
        for (let tree_idx = 0; tree_idx < treeCount; tree_idx ++) {

        }

        // endregion

    }
}
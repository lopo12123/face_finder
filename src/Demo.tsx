import { useEffect, useState } from "react";
import { FaceFinder, getImageSize } from "./FaceFinder";

export default () => {
    const [ ctx, setCtx ] = useState<CanvasRenderingContext2D | null>(null)
    const [ ctx2, setCtx2 ] = useState<CanvasRenderingContext2D | null>(null)

    useEffect(() => {
        const canvas = (document.getElementById('demoCanvas') as HTMLCanvasElement)!
        const canvas2 = (document.getElementById('demoCanvas2') as HTMLCanvasElement)!

        setCtx(canvas.getContext('2d'))
        setCtx2(canvas2.getContext('2d'))
        console.log('loaded')
    }, [])

    const controller = new FaceFinder()
    const controllerStart = () => {
        controller.start_detect(ctx!, ctx2!)
    }
    const controllerStop = () => {
        controller.stop()
    }

    const loadImage = () => {
        const ipt = document.createElement('input')
        ipt.type = 'file'
        ipt.accept = 'image/*'
        ipt.onchange = () => {
            const file = ipt.files?.[0]
            if(!file) {
                console.log('no file')
                return
            }

            controller.single_detect(file, ctx!)
            // getImageSize(file)
            //     .then(size => {
            //         file.arrayBuffer()
            //             .then(buffer => {
            //                 // const
            //             })
            //     })
            //     .catch(err => {
            //         console.log(err)
            //     })
        }
        ipt.click()
    }

    return (
        <div className="demo">
            <button onClick={ controllerStart }>controllerStart</button>
            <button onClick={ controllerStop }>controllerStop</button>

            <button onClick={ loadImage }>load image
            </button>
            <canvas id="demoCanvas"
                    style={ {
                        position: 'absolute',
                        zIndex: 1,
                        width: '100%',
                        height: '100%'
                    } }/>
            <canvas id="demoCanvas2"
                    style={ {
                        position: 'absolute',
                        zIndex: 10,
                        width: '100%',
                        height: '100%'
                    } }/>
        </div>
    )
}
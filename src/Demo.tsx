import { useEffect, useState } from "react";
import { RafController } from "./RafController";

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

    const controller = new RafController()
    const controllerStart = () => {
        controller.start_detect(ctx!, ctx2!)
    }
    const controllerStop = () => {
        controller.stop()
    }

    return (
        <div className="demo">
            <button onClick={ controllerStart }>controllerStart</button>
            <button onClick={ controllerStop }>controllerStop</button>
            <canvas id="demoCanvas"
                    style={ {
                        position: 'absolute',
                        zIndex: 1
                    } }
                    width={ 400 } height={ 300 }/>
            <canvas id="demoCanvas2"
                    style={ {
                        position: 'absolute',
                        zIndex: 10
                    } }
                    width={ 400 } height={ 300 }/>
        </div>
    )
}
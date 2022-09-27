import { useEffect, useState } from "react";
import { RafController } from "./RafController";

export default () => {
    const [ ctx, setCtx ] = useState<CanvasRenderingContext2D | null>(null)

    useEffect(() => {
        const canvas = (document.getElementById('demoCanvas') as HTMLCanvasElement)!
        canvas.width = canvas.clientWidth
        canvas.height = canvas.clientHeight
        setCtx(canvas.getContext('2d'))
        console.log('loaded')
    }, [])

    const videoEl = document.createElement('video')
    videoEl.autoplay = true
    videoEl.playsInline = true
    videoEl.width = 1
    videoEl.height = 1
    let rafId = -1
    const rafLoop = (curr_t: DOMHighResTimeStamp) => {
        ctx?.drawImage(videoEl, 0, 0)
        rafId = requestAnimationFrame(rafLoop)
    }

    const doRaf = () => {
        navigator
            .mediaDevices
            .getUserMedia({ video: true, audio: false })
            .then(stream => {
                videoEl.srcObject = stream
                document.body.appendChild(videoEl)
                rafLoop(performance.now())
            })
            .catch(err => {
                console.log(err)
            })
    }

    const doStop = () => {
        videoEl.srcObject = null
        cancelAnimationFrame(rafId)
    }

    const controller = new RafController()
    const controllerStart = () => {
        controller.start(ctx!)
    }
    const controllerStop = () => {
        controller.stop()
    }

    return (
        <div className="demo">
            <button onClick={ doRaf }>do raf</button>
            <button onClick={ doStop }>do stop</button>
            <br/>
            <button onClick={ controllerStart }>controllerStart</button>
            <button onClick={ controllerStop }>controllerStop</button>
            <canvas id="demoCanvas" width={ 600 } height={ 400 }/>
        </div>
    )
}
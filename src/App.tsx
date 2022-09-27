import { WebCam } from "./scripts/webcam";
import Styles from "./App.module.scss";
import { useEffect, useState } from "react";

function App() {
    const controller = new WebCam()

    const [ detect, setDetect ] = useState(false)
    const [ baseCtx, setBaseCtx ] = useState<CanvasRenderingContext2D | null>(null)
    const [ markCtx, setMarkCtx ] = useState<CanvasRenderingContext2D | null>(null)

    useEffect(() => {
        const cvs1 = document.getElementById('cvs_base') as HTMLCanvasElement
        const cvs2 = document.getElementById('cvs_mark') as HTMLCanvasElement
        setBaseCtx(cvs1.getContext('2d'))
        setMarkCtx(cvs2.getContext('2d'))
    })

    const start = () => {
        if(!baseCtx || !markCtx) {
            console.log('no ctx')
        }
        else {
            controller.start_detect(baseCtx, markCtx)
            setDetect(true)
        }
    }

    const stop = () => {
        controller.stop()
        setDetect(false)
    }

    return (
        <div className={ Styles.app }>
            <div className={ Styles.operatePanel }>
                { detect ? 'detecting' : 'pause' } <br/>
                <button onClick={ start }>start</button>
                <br/>
                <button onClick={ stop }>stop</button>
            </div>
            <div className={ Styles.detectPanel }>
                <canvas id="cvs_base"/>
                <canvas id="cvs_mark"/>
            </div>
        </div>
    )
}

export default App

import { WebCam } from "./scripts/webcam";
import Styles from "./App.module.scss";
import { useEffect, useState } from "react";

function App() {
    const controller = new WebCam()

    const [ detect, setDetect ] = useState(false)
    const [ baseCtx, setBaseCtx ] = useState<CanvasRenderingContext2D | null>(null)
    const [ markCtx, setMarkCtx ] = useState<CanvasRenderingContext2D | null>(null)

    // useEffect(() => {
    //     const cvs1 = document.getElementById('cvs_base') as HTMLCanvasElement
    //     const cvs2 = document.getElementById('cvs_mark') as HTMLCanvasElement
    //     setBaseCtx(cvs1.getContext('2d'))
    //     setMarkCtx(cvs2.getContext('2d'))
    // }, [])

    setTimeout(() => {
        const cvs1 = document.getElementById('cvs_base') as HTMLCanvasElement
        const cvs2 = document.getElementById('cvs_mark') as HTMLCanvasElement
        setBaseCtx(cvs1.getContext('2d'))
        setMarkCtx(cvs2.getContext('2d'))
    }, 100)

    return (
        <div className={ Styles.app }>
            <div className={ Styles.operatePanel }>
                { detect ? 'detecting' : 'pause' }
                <br/>
                <button onClick={ () => {
                    if(!baseCtx || !markCtx) {
                        console.log('no ctx')
                    }
                    else {
                        controller
                            .start_pure(baseCtx)
                            .then(_ => {
                                console.log('[WebCam] detect start')
                                setDetect(true)

                                // controller.test()
                            })
                            .catch(err => {
                                console.log(err)
                            })
                        // controller.start_detect(baseCtx, markCtx)
                    }
                } }>start
                </button>
                <br/>
                <button onClick={ () => {
                    const ifStop = controller.stop()
                    console.log(ifStop)
                    setDetect(false)
                } }>stop
                </button>
            </div>
            <div className={ Styles.detectPanel }>
                <canvas id="cvs_base" className={ Styles.cvs_base }/>
                <canvas id="cvs_mark" className={ Styles.cvs_mark }/>
            </div>
        </div>
    )
}

export default App

import { WebCam } from "./scripts/webcam";
import './App.css'
import { useEffect, useState } from "react";

function App() {
    const controller = new WebCam()

    const [ ctx, setCtx ] = useState<CanvasRenderingContext2D | null>(null)

    setTimeout(() => {
        const cvsEl = document.getElementById('cvs') as HTMLCanvasElement
        setCtx(cvsEl.getContext('2d'))
    }, 200)

    return (
        <div className="App">
            <button onClick={ () => {
                controller.start_pure(ctx!)
            } }>start
            </button>
            <button onClick={ () => {
                controller.stop()
            } }>stop
            </button>
            <canvas id="cvs"/>
        </div>
    )
}

export default App

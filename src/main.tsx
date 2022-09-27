import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Demo from "./Demo";
import "./index.scss";

createRoot(document.getElementById('root') as HTMLElement)
    .render(
        // <React.StrictMode>
        //     <App/>
            <Demo/>
        // </React.StrictMode>
    )

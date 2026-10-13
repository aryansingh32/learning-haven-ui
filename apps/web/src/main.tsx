import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installImageFallback } from "./lib/imageFallback";

installImageFallback();
createRoot(document.getElementById("root")!).render(<App />);

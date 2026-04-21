import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import App from "./App.tsx";
import { ThemeProvider } from "./lib/ThemeContext.tsx";
import SplashScreen from "./components/SplashScreen.tsx";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ThemeProvider>
      <App />
      <Analytics />
      <SplashScreen />
    </ThemeProvider>
  </BrowserRouter>,
);

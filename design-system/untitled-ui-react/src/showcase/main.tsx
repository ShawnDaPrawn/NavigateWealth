import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { installLinkGuard } from "./link-guard";
import { Showcase } from "./showcase";

installLinkGuard();

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Showcase />
    </StrictMode>,
);

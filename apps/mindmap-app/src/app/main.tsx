import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EditorPage } from "../pages/editor";

createRoot(document.getElementById("root")!).render(
  <StrictMode><EditorPage /></StrictMode>,
);

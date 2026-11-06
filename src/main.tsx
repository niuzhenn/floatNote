import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./styles/global.css";
import { MainWindow } from "./windows/MainWindow";
import { NoteWindow } from "./windows/NoteWindow";

function resolveLabel(): string {
  if (!("__TAURI_INTERNALS__" in window)) return "main";
  return getCurrentWebviewWindow().label;
}

const label = resolveLabel();
const isNoteWindow = label.startsWith("note-");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isNoteWindow ? <NoteWindow /> : <MainWindow />}</React.StrictMode>,
);

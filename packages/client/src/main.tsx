import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";
import { connect } from "./ws.js";
import "./styles.css";

connect();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "./src/contexts/AuthContext";
import LoginPage from "./src/pages/LoginPage";
const html = renderToString(React.createElement(MemoryRouter,null,React.createElement(AuthProvider,null,React.createElement(LoginPage))));
console.log(html.match(/<input[^>]*>/g).join("\n\n"));

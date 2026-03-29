// <== IMPORTS ==>
import http from "http";
import express from "express";
import { Server } from "socket.io";

// <== CREATING APP INSTANCE ==>
const app = express();

// <== CREATING SERVER ==>
const server = http.createServer(app);

// <== SOCKET SERVER INSTANCE ==>
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:8080"],
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// <== EXPORTING THE APP, SERVER AND IO INSTANCE ==>
export { app, server, io };

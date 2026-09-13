const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const express = require("express");
const connectDB = require("./config/db");

const app = express();

app.use(express.json());
async function startServer() {
    const db = await connectDB();

    app.locals.db = db;

    app.listen(process.env.PORT || 5000, () => {
        console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
}

startServer().catch(() => {
    console.error("Backend startup failed because MongoDB could not be connected.");
    process.exitCode = 1;
});
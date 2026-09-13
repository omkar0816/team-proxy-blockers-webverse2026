const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const express = require("express");
const connectDB = require("./config/db");
const { refreshSession } = require("./utils/supabase/middleware");
const patientRoutes = require("./routes/patientRoutes");
const scoreRoutes = require("./routes/scoreRoutes");

const app = express();
const frontendPath = path.resolve(__dirname, "../frontend");

app.use(express.json());
app.use(refreshSession);
app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    }

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});
app.use(express.static(frontendPath));
app.get("/", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});
app.use("/api/patient", patientRoutes);
app.use("/api/scores", scoreRoutes);

async function startServer() {
    const port = process.env.PORT || 5000;
    app.locals.supabase = null;

    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });

    try {
        app.locals.supabase = await connectDB();
    } catch (error) {
        console.error(`Supabase is unavailable. The local server will continue without database features: ${error.message}`);
    }
}

startServer().catch((error) => {
    console.error("Backend startup failed.", error);
    process.exitCode = 1;
});
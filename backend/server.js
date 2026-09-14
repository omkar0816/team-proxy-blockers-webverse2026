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
app.post("/api/notify-caregiver", async (req, res) => {
    try {
        const { alertTitle, patientName } = req.body;
        
        // Grab the Supabase connection that your app initialized
        const supabase = req.app.locals.supabase;
        
        if (!supabase) {
            return res.status(500).json({ error: "Database connection not ready." });
        }

        // 1. Get the patient ID
        const { data: patientData, error: patientError } = await supabase
            .from("patients")
            .select("id, caregiver_phone")
            .limit(1)
            .single();

        if (patientError) {
            console.error("Could not find patient:", patientError.message);
            return res.status(404).json({ error: "Patient not found" });
        }

        // 2. Insert the alert into your new cognitive_alerts table
        const { data: insertedData, error: insertError } = await supabase
            .from("cognitive_alerts")
            .insert([{
                patient_id: patientData.id,
                alert_title: alertTitle,
                status: "Acknowledged"
            }])
            .select(); // .select() forces Supabase to return the inserted row

        if (insertError) {
            console.error("Failed to insert into cognitive_alerts:", insertError.message);
            return res.status(500).json({ error: "Failed to log alert" });
        }

        console.log("Successfully logged alert to database:", insertedData);
        res.status(200).json({ success: true, message: "Alert logged successfully" });

    } catch (err) {
        console.error("Server Error:", err.message);
        res.status(500).json({ error: "Internal server error" });
    }
});
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
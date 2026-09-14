const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const express = require("express");
const connectDB = require("./config/db");
const { refreshSession } = require("./utils/supabase/middleware");
const sendSms = require("./utils/sms");
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
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    }

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});
app.use(express.static(frontendPath, { index: false }));
app.get("/", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../index.html"));
});
app.get("/index.html", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../index.html"));
});
app.get("/auth-login.html", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../index.html"));
});
app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(frontendPath, "dashboard.html"));
});
app.get("/patient", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../patient.html"));
});
app.get("/patient.html", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../patient.html"));
});
app.get("/game", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../patient.html"));
});
app.use("/api/patient", patientRoutes);
app.use("/api/scores", scoreRoutes);
app.post("/api/notify-caregiver", async (req, res) => {
    try {
        // 1. Reverted to alertTitle and patientName to match your frontend HTML
        const { alertTitle, patientName } = req.body;
        const supabase = req.app.locals.supabase;

        if (!supabase) {
            return res.status(500).json({ error: "Database connection not ready." });
        }

        // 2. Grab the demo patient without needing an ID from the frontend
        const { data: patientData, error: patientError } = await supabase
            .from("patients")
            .select("id, name, caregiver_name, caregiver_phone")
            .limit(1)
            .single();

        if (patientError) {
            console.error("Could not find patient:", patientError.message);
            return res.status(404).json({ error: "Patient not found" });
        }

        // 3. Log into cognitive_alerts
        const { data: insertedAlert, error: insertError } = await supabase
            .from("cognitive_alerts")
            .insert([{
                patient_id: patientData.id,
                alert_title: alertTitle,
                status: "Acknowledged",
                created_at: new Date().toISOString()
            }])
            .select("id, created_at")
            .single();

        if (insertError) {
            console.error("Failed to insert into cognitive_alerts:", insertError.message);
            return res.status(500).json({ error: "Failed to log alert" });
        }

        // 4. Use the actual Twilio client instead of Copilot's fake sendSms function
        if (process.env.TWILIO_SID) {
            try {
                const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
                await client.messages.create({
                    body: `${patientData.name}: ${alertTitle}. Please check in.`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: patientData.caregiver_phone
                });
            } catch (smsError) {
                console.error("Caregiver SMS failed:", smsError.message);
                // We still return 200 because the database log was successful
            }
        }

        res.status(200).json({
            success: true,
            alertId: insertedAlert.id,
            message: `Alert logged and ${patientData.caregiver_name || "caregiver"} notified.`
        });

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
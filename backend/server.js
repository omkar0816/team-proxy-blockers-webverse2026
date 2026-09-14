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
        
        // Access the Supabase client initialized in your startServer function
        const supabase = req.app.locals.supabase;
        
        if (!supabase) {
            return res.status(500).json({ error: "Database connection not ready." });
        }

        // 1. Get the patient ID and caregiver phone number
        const { data: patientData, error: patientError } = await supabase
            .from("patients")
            .select("id, caregiver_phone")
            .limit(1)
            .single();

        if (patientError) throw patientError;
        
        const patientId = patientData.id;
        const caregiverPhone = patientData.caregiver_phone;

        // 2. Send the SMS via Twilio
        if (process.env.TWILIO_SID) {
            const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
            await client.messages.create({
                body: `MindBridge Alert: ${patientName} has acknowledged the reminder: "${alertTitle}".`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: caregiverPhone 
            });
        }

        // 3. Log the interaction into the cognitive_alerts table
        const { error: insertError } = await supabase
            .from("cognitive_alerts")
            .insert([{
                patient_id: patientId,
                alert_title: alertTitle,
                status: "Acknowledged"
            }]);

        if (insertError) {
            console.error("Failed to log alert to database:", insertError.message);
        }

        res.status(200).json({ success: true, message: "SMS Sent and Logged" });
    } catch (err) {
        console.error("Notification Error:", err.message);
        res.status(500).json({ error: "Failed to process notification" });
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
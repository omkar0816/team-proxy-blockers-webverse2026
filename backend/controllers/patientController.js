const jwt = require("jsonwebtoken");
const { hashPassword, verifyPassword } = require("../utils/passwordHash");

const defaultPatient = {
    name: "Elderly Resident",
    age: 74,
    region: "Assam / North East India",
    caregiver_name: "Family Caregiver",
    caregiver_phone: "+91 9876543210",
    preferred_language: "English"
};

function toPatientResponse(patient) {
    return {
        _id: patient.id,
        name: patient.name,
        age: patient.age,
        region: patient.region,
        caregiverName: patient.caregiver_name,
        caregiverPhone: patient.caregiver_phone,
        preferredLanguage: patient.preferred_language,
        createdAt: patient.created_at,
        updatedAt: patient.updated_at
    };
}

async function getPatient(req, res) {
    const supabase = req.app.locals.supabase;

    if (!supabase) {
        return res.status(503).json({ error: "Supabase is not connected." });
    }

    const { data: patients, error: findError } = await supabase
        .from("patients")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1);

    if (findError) {
        return res.status(500).json({ error: findError.message });
    }

    if (patients.length) {
        return res.json(toPatientResponse(patients[0]));
    }

    const { data: createdPatient, error: createError } = await supabase
        .from("patients")
        .insert(defaultPatient)
        .select()
        .single();

    if (createError) {
        return res.status(500).json({ error: createError.message });
    }

    return res.status(201).json(toPatientResponse(createdPatient));
}

function createToken(caregiver, patient) {
    return jwt.sign(
        {
            id: caregiver.id,
            patient_id: patient.id,
            caretaker_name: caregiver.caretaker_name
        },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
    );
}

async function createSession(supabase, caregiverId, token, req) {
    const { error } = await supabase.from("caregiver_sessions").insert({
        caregiver_id: caregiverId,
        token,
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    if (error) {
        throw error;
    }
}

function authUnavailable(res) {
    if (!process.env.JWT_SECRET) {
        res.status(503).json({ message: "Authentication is not configured. Set JWT_SECRET." });
        return true;
    }

    return false;
}

async function register(req, res) {
    const supabase = req.app.locals.supabase;

    if (!supabase) {
        return res.status(503).json({ message: "Database unavailable" });
    }
    if (authUnavailable(res)) {
        return;
    }

    const {
        patient_name: patientName,
        caretaker_name: caretakerName,
        caretaker_mobile: caretakerMobile,
        password,
        language,
        voice_helper: voiceHelper
    } = req.body;

    if (!patientName || !caretakerName || !caretakerMobile || !password || !language) {
        return res.status(400).json({ message: "Missing required fields" });
    }
    if (String(password).length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    if (!/^\d{10}$/.test(String(caretakerMobile))) {
        return res.status(400).json({ message: "Mobile number must contain 10 digits" });
    }

    const { data: patient, error: patientError } = await supabase
        .from("patients")
        .insert({
            name: patientName,
            age: 0,
            caregiver_name: caretakerName,
            caregiver_phone: caretakerMobile,
            preferred_language: language
        })
        .select()
        .single();

    if (patientError) {
        return res.status(500).json({ message: "Registration failed", error: patientError.message });
    }

    const { data: caregiver, error: caregiverError } = await supabase
        .from("caregivers")
        .insert({
            patient_id: patient.id,
            caretaker_name: caretakerName,
            mobile_number: caretakerMobile,
            password_hash: hashPassword(password),
            language,
            voice_helper: voiceHelper || language
        })
        .select()
        .single();

    if (caregiverError) {
        await supabase.from("patients").delete().eq("id", patient.id);
        const duplicate = caregiverError.code === "23505";
        return res.status(duplicate ? 409 : 500).json({
            message: duplicate ? "A caregiver with that mobile number already exists" : "Registration failed",
            error: caregiverError.message
        });
    }

    try {
        const token = createToken(caregiver, patient);
        await createSession(supabase, caregiver.id, token, req);
        return res.status(201).json({
            success: true,
            user: {
                id: caregiver.id,
                patient_id: patient.id,
                patient_name: patient.name,
                caretaker_name: caregiver.caretaker_name,
                language: caregiver.language,
                voice_helper: caregiver.voice_helper
            },
            token
        });
    } catch (error) {
        return res.status(500).json({ message: "Registration failed", error: error.message });
    }
}

async function login(req, res) {
    const supabase = req.app.locals.supabase;

    if (!supabase) {
        return res.status(503).json({ message: "Database unavailable" });
    }
    if (authUnavailable(res)) {
        return;
    }

    const { caretaker_name: caretakerName, password } = req.body;
    if (!caretakerName || !password) {
        return res.status(400).json({ message: "Caretaker name and password are required" });
    }

    const { data: caregiver, error: caregiverError } = await supabase
        .from("caregivers")
        .select("*")
        .eq("caretaker_name", caretakerName)
        .maybeSingle();

    if (caregiverError || !caregiver || !verifyPassword(password, caregiver.password_hash)) {
        return res.status(401).json({ message: "Invalid credentials" });
    }

    const { data: patient, error: patientError } = await supabase
        .from("patients")
        .select("*")
        .eq("id", caregiver.patient_id)
        .single();

    if (patientError) {
        return res.status(500).json({ message: "Unable to load patient", error: patientError.message });
    }

    try {
        const token = createToken(caregiver, patient);
        await createSession(supabase, caregiver.id, token, req);
        return res.json({
            success: true,
            user: {
                id: caregiver.id,
                patient_id: patient.id,
                patient_name: patient.name,
                caretaker_name: caregiver.caretaker_name,
                language: caregiver.language,
                voice_helper: caregiver.voice_helper
            },
            token
        });
    } catch (error) {
        return res.status(500).json({ message: "Login failed", error: error.message });
    }
}

async function logout(req, res) {
    const supabase = req.app.locals.supabase;

    if (supabase && req.token) {
        await supabase.from("caregiver_sessions").delete().eq("token", req.token);
    }

    return res.json({ success: true, message: "Logged out" });
}

function verifyTokenEndpoint(req, res) {
    return res.json({ success: true, userId: req.userId, patientId: req.patientId });
}

module.exports = {
    getPatient,
    register,
    login,
    logout,
    verifyTokenEndpoint
};
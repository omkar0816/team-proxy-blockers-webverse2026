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

module.exports = { getPatient };
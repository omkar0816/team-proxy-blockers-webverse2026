function toScoreResponse(score) {
    return {
        _id: score.id,
        patientId: score.patient_id,
        gameType: score.game_type,
        score: score.score,
        attempts: score.attempts,
        difficultyLevel: score.difficulty_level,
        aiSpokenMessage: score.ai_spoken_message,
        aiClinicalObservation: score.ai_clinical_observation,
        completedAt: score.created_at
    };
}

async function createScore(req, res) {
    const supabase = req.app.locals.supabase;
    const { patientId, gameType = "Memory Recall - Cultural Pairs", score, attempts, difficultyLevel = 1 } = req.body;

    if (!supabase) {
        return res.status(503).json({ error: "Supabase is not connected." });
    }

    if (!patientId || !Number.isInteger(score) || !Number.isInteger(attempts)) {
        return res.status(400).json({ error: "patientId, score, and attempts are required." });
    }

    const newScore = {
        patient_id: patientId,
        game_type: gameType,
        score,
        attempts,
        difficulty_level: difficultyLevel,
        ai_spoken_message: "Great work completing today's activity!",
        ai_clinical_observation: "Completed normally."
    };

    const { data, error } = await supabase.from("game_scores").insert(newScore).select().single();

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ success: true, data: toScoreResponse(data) });
}

async function getScores(req, res) {
    const supabase = req.app.locals.supabase;

    if (!supabase) {
        return res.status(503).json({ error: "Supabase is not connected." });
    }

    const { data, error } = await supabase
        .from("game_scores")
        .select("*")
        .eq("patient_id", req.params.patientId)
        .order("created_at", { ascending: false });

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    return res.json(data.map(toScoreResponse));
}

module.exports = { createScore, getScores };
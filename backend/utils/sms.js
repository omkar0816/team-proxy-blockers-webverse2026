async function sendSms({ to, body }) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !from) {
        throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER are required.");
    }

    if (!to) {
        throw new Error("The patient profile has no caregiver phone number.");
    }

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({ To: to, From: from, Body: body })
    });

    if (!response.ok) {
        const details = await response.text();
        throw new Error(`Twilio returned ${response.status}: ${details}`);
    }
}

module.exports = sendSms;
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Elderly Participant',
  age INT DEFAULT 73,
  region TEXT DEFAULT 'North Eastern Region (NER)',
  caregiver_name TEXT DEFAULT 'Assigned Caregiver',
  caregiver_phone TEXT DEFAULT '+91 9876543210',
  preferred_language TEXT DEFAULT 'English',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insert a default demo patient so the app has data
INSERT INTO patients (name, age, caregiver_name, caregiver_phone) 
VALUES ('Demo Participant', 74, 'Hackathon Judge', '+91 0000000000');

-- 3. NOW create the alerts table
CREATE TABLE cognitive_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  alert_title TEXT NOT NULL,
  status TEXT DEFAULT 'Acknowledged',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
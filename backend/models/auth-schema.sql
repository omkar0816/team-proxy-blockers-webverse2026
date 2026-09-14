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
);

-- 4. Caregiver accounts use UUIDs because patients.id is UUID.
CREATE TABLE caregivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  caretaker_name VARCHAR(255) NOT NULL,
  mobile_number VARCHAR(20) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  language VARCHAR(50) DEFAULT 'English',
  voice_helper VARCHAR(50) DEFAULT 'English',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE caregiver_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_caregivers_mobile ON caregivers(mobile_number);
CREATE INDEX idx_sessions_token ON caregiver_sessions(token);

-- Backend access uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS safely server-side.
ALTER TABLE caregivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_sessions ENABLE ROW LEVEL SECURITY;

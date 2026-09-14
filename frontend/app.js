const API_BASE_URL = window.location.port === '5000'
  ? ''
  : `${window.location.protocol}//${window.location.hostname}:5000`;

let patient = null;

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

async function loadPatient() {
  const response = await fetch(apiUrl('/api/patient'));
  if (!response.ok) throw new Error('Patient profile is unavailable.');

  patient = await response.json();
  window.currentPatient = patient;
  setText('patientName', patient.name || 'Elderly Resident');
  setText('patientAge', `♡ ${patient.age || 74} years`);
  setText('patientRegion', `📍 ${patient.region || 'North East India'}`);
  setText('patientLanguage', `🌐 ${patient.preferredLanguage || 'English'}`);
}

function updateStats(scores) {
  if (!scores.length) return;

  const values = scores.map(item => Number(item.score) || 0);
  const average = Math.round(values.reduce((total, value) => total + value, 0) / values.length);
  setText('avgScore', `${average}%`);
  setText('sessionCount', scores.length);
  setText('bestScore', `${Math.max(...values)}%`);
}

async function loadScores() {
  if (!patient?._id) return;

  const response = await fetch(apiUrl(`/api/scores/${patient._id}`));
  if (!response.ok) return;

  updateStats(await response.json());
}

window.recordScore = async ({ name, score, attempts = 1 }) => {
  if (!patient?._id) return;

  await fetch(apiUrl('/api/scores'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId: patient._id,
      patientName: patient.name,
      gameType: name,
      score,
      attempts,
      difficultyLevel: 1
    })
  });

  await loadScores();
};

async function initializeDashboard() {
  try {
    await loadPatient();
    await loadScores();
  } catch (error) {
    console.warn('Supabase dashboard data unavailable:', error.message);
    const syncPill = document.querySelector('.pill');
    if (syncPill) syncPill.innerHTML = '<span class="dot"></span> Offline';
  }
}

initializeDashboard();
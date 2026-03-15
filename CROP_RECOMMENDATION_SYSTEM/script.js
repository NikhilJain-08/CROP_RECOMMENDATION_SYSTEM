// Element references
const rain = document.getElementById('rain');
const rainVal = document.getElementById('rain-val');
const drop = document.getElementById('dropzone');
const browse = document.getElementById('browse');
const fileInput = document.getElementById('fileinput');
const predictBtn = document.getElementById('predict');
const resetBtn = document.getElementById('reset');
const status = document.getElementById('status');
const resultCard = document.getElementById('result-card');
const resultTitle = document.getElementById('result-title');
const resultDesc = document.getElementById('result-desc');
const resultEmoji = document.getElementById('result-emoji');
const lastPred = document.getElementById('last-pred');
const lastConf = document.getElementById('last-conf');
const samplesEl = document.getElementById('samples');


// Mapping region to CSV file names
const csvFiles = {
  "Bihar": "Bihar.csv",
  "Uttar_Pradesh": "Uttar_Pradesh.csv"
};
let selectedRegion = "Bihar"; // Default selected
let uploadedCsvData = [];
let csvLoaded = false;


// CSV load when region changes
document.querySelectorAll('input[name="csvRegion"]').forEach(radio => {
  radio.addEventListener('change', function() {
    selectedRegion = this.value;
    loadCsvFromRegion(selectedRegion);
  });
});


// Loads CSV data corresponding to the selected region
function loadCsvFromRegion(region) {
  fetch(csvFiles[region])
    .then(response => response.text())
    .then(text => {
      const lines = text.trim().split('\n').filter(Boolean);
      const csvHeaders = lines[0].split(',').map(h => h.trim());
      uploadedCsvData = lines.slice(1).map(row => {
        const values = row.split(',').map(v => v.trim());
        let rowObj = {};
        csvHeaders.forEach((h, i) => rowObj[h] = values[i]);
        return rowObj;
      });
      csvLoaded = true;
      // Optionally, update stats/samples count if you use it elsewhere
      const samplesEl = document.getElementById('samples');
      if (samplesEl) animateSamplesCount(samplesEl, uploadedCsvData.length);

function animateSamplesCount(el, target) {
  let current = 0;
  el.textContent = '0';
  if (target === 0) return;
  const step = Math.ceil(target / 38);
  function tick() {
    current += step;
    if (current >= target) {
      el.textContent = target;
    } else {
      el.textContent = current;
      requestAnimationFrame(tick);
    }
  }
  tick();
}

    }).catch(err => {
      csvLoaded = false;
      alert("Could not load CSV for " + region);
    });
}
// Initial CSV load
loadCsvFromRegion(selectedRegion);


// Reset button - clears inputs
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    // Reset form fields
    ['nitrogen', 'phosphorus', 'potassium', 'temp', 'hum', 'ph', 'rain'].forEach((id, i) => {
      let val = [90, 42, 43, 21, 82, 6.5, 200][i];
      let el = document.getElementById(id);
      if (el) el.value = val;
    });
    const rainVal = document.getElementById('rain-val');
    if (rainVal) rainVal.textContent = '200';
    // Hide and clear all result fields
    const resultCard = document.getElementById('result-card');
    if (resultCard) resultCard.style.display = 'none';
    document.getElementById('result-card').style.display = 'none';
    document.getElementById('top-results-list').innerHTML = '';
    const resultTitle = document.getElementById('result-title');
    const resultDesc = document.getElementById('result-desc');
    const resultEmoji = document.getElementById('result-emoji');
    const lastPred = document.getElementById('last-pred');
    const lastConf = document.getElementById('last-conf');
    if (resultTitle) resultTitle.textContent = '';
    if (resultDesc) resultDesc.textContent = '';
    if (resultEmoji) resultEmoji.textContent = '';
    if (lastPred) lastPred.textContent = '';
    if (lastConf) lastConf.textContent = '';
    const samplesEl = document.getElementById('samples');
    if (samplesEl) samplesEl.textContent = '0';

    // Remove/clear estimated yield value and label
    const yieldLabel = document.querySelector('div[style*="font-size:12px"][style*="color:6b7280"]'); // "Estimated yield" label
    if (yieldLabel) yieldLabel.textContent = '';
    const yieldValue = document.querySelector('div[style*="font-weight:800"][style*="font-size:20px"]'); // yield value
    if (yieldValue) yieldValue.textContent = '';

  });
}


// Numerical feature keys to use in similarity
const featureKeys = ['N', 'P', 'K', 'temp', 'humidity', 'ph', 'rainfall', 'rain'];

// Compute normalized similarity between input and CSV row (Euclidean, scaled)
function similarityScore(input, row) {
    let totalDiff = 0;
    let count = 0;
    featureKeys.forEach(key => {
        let inputVal = parseFloat(input[key] || input['rainfall'] || input['rain'] || 0);
        let rowVal = parseFloat(row[key] || row['rainfall'] || row['rain'] || 0);
        if (!isNaN(inputVal) && !isNaN(rowVal)) {
            let max = Math.max(inputVal, rowVal, 1);
            totalDiff += Math.abs(inputVal - rowVal) / max;
            count++;
        }
    });
    if (count === 0) return 0;
    let score = 1 - (totalDiff / count);
    return Math.max(0, Math.min(1, score));
}


// Predict from uploaded CSV file, show matched crop name/label
function predictFromCsv(formData) {
    if (!csvLoaded || uploadedCsvData.length === 0) return null;
    // Try exact match first
    let bestMatch = uploadedCsvData.find(row =>
        row.N == formData.N &&
        row.P == formData.P &&
        row.K == formData.K &&
        row.temp == formData.temp &&
        row.humidity == formData.humidity &&
        (row.ph == formData.ph || row.pH == formData.ph) &&
        (row.rainfall == formData.rain || row.rain == formData.rain)
    );
    if (bestMatch) {
        return {
            crop: bestMatch.crop || bestMatch.label || 'Unknown',
            emoji: '🌾',
            conf: 1.0,
            desc: `Exact match for crop "${bestMatch.crop || bestMatch.label}".`,
            yield: bestMatch.yield || ''
        };
    }
    // Find nearest row in CSV
    let maxScore = -1, nearest = null;
    for (const row of uploadedCsvData) {
        let score = similarityScore(formData, row);
        if (score > maxScore) {
            maxScore = score;
            nearest = row;
        }
    }
    if (nearest && maxScore > 0) {
        return {
            crop: nearest.crop || nearest.label || 'Unknown',
            emoji: '🌾',
            conf: maxScore,
            desc: `Nearest match with crop "${nearest.crop || nearest.label}" from your CSV.`,
            yield: nearest.yield || ''
        };
    }
    return null;
}


// Main prediction logic
async function predict() {
    const data = {
        N: document.getElementById('nitrogen')?.value || '',
        P: document.getElementById('phosphorus')?.value || '',
        K: document.getElementById('potassium')?.value || '',
        temp: document.getElementById('temp')?.value || '',
        humidity: document.getElementById('hum')?.value || '',
        ph: document.getElementById('ph')?.value || '',
        rain: document.getElementById('rain')?.value || ''
    };

    let result = predictFromCsv(data);
    await new Promise(r => setTimeout(r, 400));
    if (result) {
        showResult(result);
    } else if (!csvLoaded) {
        showError('No CSV file loaded. Please upload a CSV file.');
    } else {
        showError('No sufficiently close match found in your CSV file for the given parameters.');
    }
}


// Display recommendation result, clearly showing matched crop name/label
function getTopMatches(inputData, csvData, keys, count = 3) {
  // Calculate confidence for each row
  let matches = csvData.map(row => {
    let score = similarityScore(inputData, row, keys);
    return {...row, confidence: score};
  });
  // Sort by confidence, highest first
  matches.sort((a, b) => b.confidence - a.confidence);
  // Take top 'count' records
  return matches.slice(0, count);
}


// For similarity calculation (Euclidean/proportional)
function similarityScore(input, row, keys) {
  let totalDiff = 0, cnt = 0;
  keys.forEach(key => {
    let a = parseFloat(input[key] || input[key.toLowerCase()]);
    let b = parseFloat(row[key] || row[key.toLowerCase()]);
    if (!isNaN(a) && !isNaN(b)) {
      let max = Math.max(Math.abs(a), Math.abs(b), 1);
      totalDiff += Math.abs(a - b) / max;
      cnt++;
    }
  });
  if (cnt == 0) return 0;
  let rawScore = 1 - (totalDiff / cnt);
  return Math.max(0, Math.min(1, rawScore));
}

// On 'Get Recommendation', show top 3 not only best
predictBtn.addEventListener('click', function(e) {
  e.preventDefault();
  if (!csvLoaded) {
    showError("No CSV loaded.");
    return;
  }
  let inputData = {
    N: document.getElementById('nitrogen').value,
    P: document.getElementById('phosphorus').value,
    K: document.getElementById('potassium').value,
    temp: document.getElementById('temp').value,
    humidity: document.getElementById('hum').value,
    ph: document.getElementById('ph').value,
    rainfall: document.getElementById('rain').value
  };
  let keys = ['N','P','K','temp','humidity','ph','rainfall'];
  let topMatches = getTopMatches(inputData, uploadedCsvData, keys, 3);

  showTopResults(topMatches);
  function getTopMatches(inputData, csvData, keys, count = 3) {
  // Calculate confidence for each row
  let matches = csvData.map(row => {
    let score = similarityScore(inputData, row, keys);
    return {...row, confidence: score};
  });
  // Sort by confidence, highest first
  matches.sort((a, b) => b.confidence - a.confidence);
  // Filter to only include unique crop labels
  const seen = new Set();
  const uniqueMatches = [];
  for (const row of matches) {
    const label = row.label || row.crop;
    if (!seen.has(label)) {
      seen.add(label);
      uniqueMatches.push(row);
      if (uniqueMatches.length === count) break;
    }
  }
  return uniqueMatches;
}
});


// Display top 3 matches in result card
function showTopResults(results) {
  let listDiv = document.getElementById('top-results-list');
  if (!listDiv) return;
  listDiv.innerHTML = `
    <table class="result-table">
      <tr>
        <th>Crop</th>
        <th>Confidence</th>
        <th>Yield</th>
      </tr>
      ${results.map(r => {
        const label = (r.label || r.crop || '').toLowerCase();
        const extra = cropExtras[label] || {};
        const yieldValue = r.yield || extra.yield || '-';
        const emoji = r.emoji || extra.emoji || '';
        return `
          <tr>
            <td>${emoji} ${r.crop || r.label || ''}</td>
            <td class="confidence-cell">${(r.confidence*100).toFixed(1)}%</td>
            <td class="yield-cell">${yieldValue}</td>
          </tr>
        `;
      }).join('')}
    </table>
  `;
  document.querySelectorAll('.result-table tr').forEach(row => {
  row.addEventListener('click', () => {
    // Show modal with more crop details (implement as needed)
  });
  row.addEventListener('mouseenter', () => {
    row.style.boxShadow = '0 0 16px #22b573aa';
  });
  row.addEventListener('mouseleave', () => {
    row.style.boxShadow = '';
  });
});
  document.getElementById('result-card').style.display = 'block';
}


// Show error instead of result
function showError(msg) {
    resultTitle.textContent = 'Error';
    resultDesc.textContent = msg;
    resultEmoji.textContent = '❗';
    resultCard.style.display = 'flex';
    lastPred.textContent = '';
    lastConf.textContent = '';
    if (resultCard) resultCard.classList.add('active');
}

// Attach predict handler to button
if (predictBtn) {
    predictBtn.addEventListener('click', e => {
        e.preventDefault();
        predict();
    });
}


const cropExtras = {
  rice:        { emoji: '🌾', yield: '5000 kg/ha' },
  wheat:       { emoji: '🌾', yield: '3500 kg/ha' },
  maize:       { emoji: '🌽', yield: '2500 kg/ha' },
  chickpea:    { emoji: '🫘', yield: '1800 kg/ha' },
  moong:       { emoji: '🫘', yield: '1400 kg/ha' },
  cotton:      { emoji: '🧵', yield: '1700 kg/ha' },
  barley:      { emoji: '🌾', yield: '2600 kg/ha' },
  jute:        { emoji: '🪢', yield: '2200 kg/ha' },
  lentil:      { emoji: '🫘', yield: '1200 kg/ha' },
  sugarcane:   { emoji: '🥤', yield: '60000 kg/ha' },
  potato:      { emoji: '🥔', yield: '32000 kg/ha' },
  mustard:     { emoji: '🌻', yield: '1100 kg/ha' },
  peas:        { emoji: '🫛', yield: '1500 kg/ha' },
  groundnut:   { emoji: '🥜', yield: '2000 kg/ha' },
  sunflower:   { emoji: '🌻', yield: '1600 kg/ha' },
  tobacco:     { emoji: '🚬', yield: '2300 kg/ha' },
  onion:       { emoji: '🧅', yield: '18000 kg/ha' },
  tomato:      { emoji: '🍅', yield: '22000 kg/ha' },
  sorghum:     { emoji: '🌾', yield: '1950 kg/ha' },
  bajra:       { emoji: '🌾', yield: '1200 kg/ha' },
  oats:        { emoji: '🌾', yield: '2500 kg/ha' },
  millet:      { emoji: '🌾', yield: '1100 kg/ha' },
  soyabean:    { emoji: '🫘', yield: '1300 kg/ha' },
  sesame:      { emoji: '🌱', yield: '700 kg/ha' },
  cumin:       { emoji: '🌱', yield: '500 kg/ha' },
  fenugreek:   { emoji: '🌱', yield: '1100 kg/ha' },
  blackgram:   { emoji: '🫘', yield: '900 kg/ha' },
  greenpea:    { emoji: '🫛', yield: '2100 kg/ha' },
  peanuts:     { emoji: '🥜', yield: '1900 kg/ha' },
  banana:      { emoji: '🍌', yield: '30000 kg/ha' },
  coffee:      { emoji: '☕',  yield: '1500 kg/ha' },
  muskmelon:   { emoji: '🍈', yield: '20000 kg/ha' },
  watermelon: { emoji: '🍉', yield: '10000 kg/ha' },
  papaya: { emoji: '🥭', yield: '17000 kg/ha' },
  apple: { emoji: '🍎', yield: '12000 kg/ha' }

};

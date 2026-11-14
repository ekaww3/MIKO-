const firebaseConfig = {
    apiKey: "AIzaSyC2bt-bN0bnonX1ROPR-59G6cA4eo_xZ2A",
    authDomain: "jamur-esp.firebaseapp.com",
    databaseURL: "https://jamur-esp-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "jamur-esp",
    storageBucket: "jamur-esp.firebasestorage.app",
    messagingSenderId: "772846279758",
    appId: "1:772846279758:web:ca3f4a9396b1aa9409f71f"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ===== Data acuan jamur (silakan ubah/tambah) =====
// suhu & lembab: [minimum, maksimum]
const JAMUR = [
    { nama: 'Jamur tiram putih', latin: 'Pleurotus ostreatus',
      inkubasi: { suhu: [22, 28], lembab: [60, 80] }, tumbuh: { suhu: [20, 28], lembab: [80, 90] },
      catatan: 'Paling mudah untuk pemula dan tahan suhu hangat.' },
    { nama: 'Jamur kuping', latin: 'Auricularia auricula-judae',
      inkubasi: { suhu: [24, 30], lembab: [60, 75] }, tumbuh: { suhu: [22, 28], lembab: [85, 95] },
      catatan: 'Butuh kelembapan tinggi saat tubuh buah muncul.' },
    { nama: 'Jamur merang', latin: 'Volvariella volvacea',
      inkubasi: { suhu: [30, 35], lembab: [70, 80] }, tumbuh: { suhu: [28, 35], lembab: [80, 90] },
      catatan: 'Menyukai suhu panas; tumbuh cepat.' },
    { nama: 'Jamur lingzhi', latin: 'Ganoderma lucidum',
      inkubasi: { suhu: [25, 30], lembab: [70, 80] }, tumbuh: { suhu: [25, 30], lembab: [85, 95] },
      catatan: 'Pertumbuhan lambat; jaga sirkulasi udara.' },
    { nama: 'Jamur shiitake', latin: 'Lentinula edodes',
      inkubasi: { suhu: [20, 25], lembab: [60, 70] }, tumbuh: { suhu: [12, 20], lembab: [80, 90] },
      catatan: 'Butuh suhu sejuk untuk memunculkan tubuh buah.' },
    { nama: 'Jamur kancing', latin: 'Agaricus bisporus',
      inkubasi: { suhu: [22, 25], lembab: [85, 90] }, tumbuh: { suhu: [14, 18], lembab: [85, 92] },
      catatan: 'Butuh suhu sejuk; sulit di daerah panas tanpa pendingin.' },
    { nama: 'Jamur enoki', latin: 'Flammulina velutipes',
      inkubasi: { suhu: [20, 25], lembab: [65, 75] }, tumbuh: { suhu: [8, 15], lembab: [85, 95] },
      catatan: 'Tubuh buah baru muncul di suhu dingin.' }
];

// ===== Elemen HTML =====
const $ = (id) => document.getElementById(id);
const suhuEl = $('suhuVal'), lembabEl = $('lembabVal'), statusPompaEl = $('statusPompa');
const autoToggle = $('autoToggle'), manualToggle = $('manualToggle'), relay2Toggle = $('relay2Toggle');
const humidFill = $('humidFill'), suhuMarker = $('suhuMarker'), suhuLimit = $('suhuLimit');
const thresholdLine = $('thresholdLine');
const connStatus = $('connStatus'), connText = $('connText');
const setLembab = $('setLembab'), setSuhu = $('setSuhu');
const setLembabVal = $('setLembabVal'), setSuhuVal = $('setSuhuVal');
const saveBtn = $('saveBtn'), saveMsg = $('saveMsg');

// ===== Pindah dasbor (Monitoring / Pengaturan) =====
const JUDUL = {
    monitoring: 'Monitoring Jamur & Kontrol Sanyo',
    data: 'Data Sensor Realtime',
    pengaturan: 'Pengaturan Kelembapan & Suhu'
};
function showView() {
    const h = location.hash.slice(1);
    const name = JUDUL[h] ? h : 'monitoring';
    Object.keys(JUDUL).forEach((k) => {
        $('view-' + k).hidden = k !== name;
        const tab = $('tab-' + k);
        tab.classList.toggle('active', k === name);
        if (k === name) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
    });
    $('judul').textContent = JUDUL[name];
}
window.addEventListener('hashchange', showView);
showView();

// ===== Visual monitoring =====
let statusPompaTerakhir = '-';
const SHROOM_BOTTOM = 132, SHROOM_RANGE = 126;
const SUHU_MIN = 15, SUHU_MAX = 40;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function setHumidityLevel(pct) {
    const h = (clamp(pct, 0, 100) / 100) * SHROOM_RANGE;
    humidFill.setAttribute('y', SHROOM_BOTTOM - h);
    humidFill.setAttribute('height', h);
}
function setHumidityThreshold(pct) {
    const y = SHROOM_BOTTOM - (clamp(pct, 0, 100) / 100) * SHROOM_RANGE;
    thresholdLine.setAttribute('y1', y);
    thresholdLine.setAttribute('y2', y);
}
function placeOnScale(el, t) {
    el.style.left = clamp(((t - SUHU_MIN) / (SUHU_MAX - SUHU_MIN)) * 100, 0, 100) + '%';
    el.style.opacity = 1;
}

// Status koneksi Firebase
db.ref('.info/connected').on('value', (snap) => {
    const online = snap.val() === true;
    connStatus.classList.toggle('online', online);
    connStatus.classList.toggle('offline', !online);
    connText.innerText = online ? 'Terhubung' : 'Terputus';
});

// Membaca Data Realtime
db.ref('monitoring').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        if (data.suhu != null) {
            suhuEl.innerText = Number(data.suhu).toFixed(1) + ' °C';
            placeOnScale(suhuMarker, Number(data.suhu));
        } else { suhuEl.innerText = '-- °C'; }
        if (data.kelembapan != null) {
            lembabEl.innerText = Number(data.kelembapan).toFixed(1) + ' %';
            setHumidityLevel(Number(data.kelembapan));
        } else { lembabEl.innerText = '-- %'; }
        jadwalkanTitik(data);
    }
});

db.ref('status/pompa').on('value', (snapshot) => {
    const status = snapshot.val() || 'Mati';
    statusPompaTerakhir = status;
    statusPompaEl.innerText = "Status Pompa: " + status;
    statusPompaEl.classList.toggle('on', /hidup|nyala|on/i.test(String(status)));
});

// ===== Grafik realtime =====
const MAX_POINTS = 100;
const riwayat = [];            // { t, suhu, lembab }
let titikTimer = null;
let nomorData = 0;
const CW = 600, CH = 220, PL = 46, PR = 14, PT = 14, PB = 28;

const jam = (ms) => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function drawChart(svg, statEl, key, batas, minSpan) {
    if (riwayat.length < 2) {
        svg.innerHTML = `<text class="ax" x="${CW / 2}" y="${CH / 2}" text-anchor="middle">Menunggu data…</text>`;
        return;
    }
    const vals = riwayat.map((p) => p[key]);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const rataRata = vals.reduce((a, b) => a + b, 0) / vals.length;
    statEl.textContent = `Min ${lo.toFixed(1)}, rata-rata ${rataRata.toFixed(1)}, maks ${hi.toFixed(1)}`;

    // Sertakan garis batas hanya jika dekat dengan data, supaya grafik tidak gepeng
    const tampilBatas = batas >= lo - minSpan && batas <= hi + minSpan;
    if (tampilBatas) { lo = Math.min(lo, batas); hi = Math.max(hi, batas); }
    if (hi - lo < minSpan) { const mid = (hi + lo) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;

    const t0 = riwayat[0].t, t1 = riwayat[riwayat.length - 1].t;
    const x = (t) => PL + ((t - t0) / (t1 - t0 || 1)) * (CW - PL - PR);
    const y = (v) => PT + ((hi - v) / (hi - lo)) * (CH - PT - PB);

    const pts = riwayat.map((p) => [x(p.t), y(p[key])]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${CH - PB} L${pts[0][0].toFixed(1)} ${CH - PB} Z`;
    const last = pts[pts.length - 1];

    let grid = '';
    [lo, (lo + hi) / 2, hi].forEach((v) => {
        grid += `<line class="grid-line" x1="${PL}" x2="${CW - PR}" y1="${y(v)}" y2="${y(v)}"/>` +
                `<text class="ax" x="${PL - 8}" y="${y(v) + 4}" text-anchor="end">${v.toFixed(1)}</text>`;
    });
    const limit = tampilBatas
        ? `<line class="lim" x1="${PL}" x2="${CW - PR}" y1="${y(batas)}" y2="${y(batas)}"/>` +
          `<text class="lim-label" x="${CW - PR}" y="${y(batas) - 5}" text-anchor="end">batas ${batas}</text>`
        : '';

    svg.innerHTML = `
        <defs><linearGradient id="g-${key}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="currentColor" stop-opacity=".35"/>
            <stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
        ${grid}
        <path d="${area}" fill="url(#g-${key})"/>
        <path class="ln" d="${line}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${limit}
        <circle cx="${last[0]}" cy="${last[1]}" r="4.5" fill="currentColor" stroke="#07050c" stroke-width="2"/>
        <text class="ax" x="${PL}" y="${CH - 8}" text-anchor="start">${jam(t0)}</text>
        <text class="ax" x="${CW - PR}" y="${CH - 8}" text-anchor="end">${jam(t1)}</text>`;
}

function drawCharts() {
    drawChart($('chartSuhu'), $('statSuhu'), 'suhu', saved.suhu, 4);
    drawChart($('chartLembab'), $('statLembab'), 'lembab', saved.lembab, 10);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const waktuLengkap = (ms) => new Date(ms).toLocaleString('id-ID');

function renderTabel() {
    if (!riwayat.length) return;
    $('dataBody').innerHTML = riwayat.slice().reverse().map((p) =>
        `<tr><td>${p.no}</td><td>${waktuLengkap(p.t)}</td><td>${p.suhu.toFixed(1)}</td><td>${p.lembab.toFixed(1)}</td><td>${esc(p.pompa)}</td></tr>`
    ).join('');
}

function unduhCSV() {
    if (!riwayat.length) return;
    const baris = ['No,Waktu,Suhu (C),Kelembapan (%),Status pompa'].concat(riwayat.map((p) =>
        [p.no, '"' + waktuLengkap(p.t) + '"', p.suhu.toFixed(1), p.lembab.toFixed(1), '"' + String(p.pompa).replace(/"/g, '""') + '"'].join(',')
    ));
    const blob = new Blob(['\ufeff' + baris.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data-sensor-jamur.csv';
    a.click();
    URL.revokeObjectURL(a.href);
}

// ESP menulis suhu lalu kelembapan berurutan; tunggu sebentar agar jadi satu titik
function jadwalkanTitik(data) {
    if (data.suhu == null || data.kelembapan == null) return;
    clearTimeout(titikTimer);
    titikTimer = setTimeout(() => {
        riwayat.push({ no: ++nomorData, t: Date.now(), suhu: Number(data.suhu), lembab: Number(data.kelembapan), pompa: statusPompaTerakhir });
        if (riwayat.length > MAX_POINTS) riwayat.shift();
        drawCharts();
        renderTabel();
    }, 1000);
}

// ===== Pengaturan (batas kelembapan & suhu) =====
let saved = { lembab: 80, suhu: 30 };   // nilai awal jika belum ada di Firebase

const isDirty = () => Number(setLembab.value) !== saved.lembab || Number(setSuhu.value) !== saved.suhu;

function renderDraft() {
    setLembabVal.textContent = Number(setLembab.value) + ' %';
    setSuhuVal.textContent = Number(setSuhu.value).toFixed(1) + ' °C';
    saveBtn.disabled = !isDirty();
}
function renderSaved() {
    $('activeLembab').textContent = saved.lembab + ' %';
    $('activeSuhu').textContent = saved.suhu.toFixed(1) + ' °C';
    $('batasLembabTxt').textContent = saved.lembab;
    $('batasLembabTxt2').textContent = saved.lembab;
    $('batasSuhuTxt').textContent = saved.suhu.toFixed(1);
    setHumidityThreshold(saved.lembab);
    placeOnScale(suhuLimit, saved.suhu);
    drawCharts();
}
function flash(text) { saveMsg.textContent = text; }

[setLembab, setSuhu].forEach((el) => el.addEventListener('input', () => { flash(''); renderDraft(); }));
document.querySelectorAll('.step').forEach((btn) => {
    btn.addEventListener('click', () => {
        const input = $(btn.dataset.target);
        input.value = Number(input.value) + Number(btn.dataset.step);
        flash(''); renderDraft();
    });
});

function simpanPengaturan() {
    saveBtn.disabled = true;
    db.ref('kontrol').update({
        batas_kelembapan: Number(setLembab.value),
        batas_suhu: Number(setSuhu.value)
    }).then(() => flash('Tersimpan. Alat akan memakai batas yang baru.'))
      .catch(() => { flash('Gagal menyimpan. Periksa koneksi lalu coba lagi.'); renderDraft(); });
}

// ===== Kartu acuan jamur =====
const fmt = (r) => r[0] + '–' + r[1];
function faseHTML(label, key, f) {
    return `<div class="fase">
        <div class="fase-head"><span>${label}</span>
            <button class="pakai" type="button" data-nama="${key}" data-lembab="${f.lembab[0]}" data-suhu="${f.suhu[1]}">Pakai</button></div>
        <p>Kelembapan ${fmt(f.lembab)}%<br>Suhu ${fmt(f.suhu)} °C</p></div>`;
}
$('jamurList').innerHTML = JAMUR.map((j) => `
    <article class="jamur">
        <h3>${j.nama}</h3><p class="latin">${j.latin}</p>
        ${faseHTML('Inkubasi (miselium)', j.nama + ', inkubasi', j.inkubasi)}
        ${faseHTML('Tubuh buah', j.nama + ', tubuh buah', j.tumbuh)}
        <p class="note">${j.catatan}</p>
    </article>`).join('');

$('jamurList').addEventListener('click', (e) => {
    const b = e.target.closest('.pakai');
    if (!b) return;
    setLembab.value = b.dataset.lembab;
    setSuhu.value = b.dataset.suhu;
    renderDraft();
    flash('Nilai ' + b.dataset.nama + ' dimasukkan. Tekan Simpan untuk menerapkan.');
    $('view-pengaturan').querySelector('.setter').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// ===== Kontrol relay + pengaturan dari Firebase =====
db.ref('kontrol').on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    autoToggle.checked = data.mode_otomatis;
    manualToggle.checked = data.pompa_manual;
    if (relay2Toggle) relay2Toggle.checked = data.relay2;   // toggle Relay 2 opsional
    manualToggle.disabled = data.mode_otomatis;   // manual nonaktif saat otomatis nyala

    const wasDirty = isDirty();
    if (data.batas_kelembapan != null) saved.lembab = Number(data.batas_kelembapan);
    if (data.batas_suhu != null) saved.suhu = Number(data.batas_suhu);
    if (!wasDirty) { setLembab.value = saved.lembab; setSuhu.value = saved.suhu; }
    renderDraft();
    renderSaved();
});
renderDraft();
renderSaved();

// Mengirim Perintah ke Firebase
function updateFirebase(type) {
    if (type === 'auto') {
        db.ref('kontrol').update({ mode_otomatis: autoToggle.checked });
    } else if (type === 'manual') {
        db.ref('kontrol').update({ pompa_manual: manualToggle.checked });
    } else if (type === 'relay2') {
        db.ref('kontrol').update({ relay2: relay2Toggle.checked });
    }
}

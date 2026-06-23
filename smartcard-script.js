// ════════════════════════════════════════════════════════════════════
// SMART CARD — Penerbitan Roxwood Kingdom Card
// Module ini HANYA mengurus halaman "page-smartcard". Tidak menyentuh
// logic absensi/cuti/gaji/login yang ada di <script> utama index.html.
//
// Firebase di-load secara dinamis & non-blocking: kalau CDN gagal/lambat,
// seluruh form & preview kartu TETAP JALAN NORMAL — hanya fitur simpan
// riwayat ke database yang akan dilewati.
// ════════════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyC3mQCVI_MGsyetVlaTdVcvsM--WW2qTkE",
  authDomain: "lisensi-penerbangan.firebaseapp.com",
  databaseURL: "https://lisensi-penerbangan-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lisensi-penerbangan",
  storageBucket: "lisensi-penerbangan.firebasestorage.app",
  messagingSenderId: "319662200229",
  appId: "1:319662200229:web:9503a54a75d705648e444c"
};

let scDb = null;
let scPushToDb = null;
// Fallback langsung ke Worker D1 kalau window.LocalDB (script utama) belum siap
// saat fungsi ini dipanggil (race condition saat halaman baru di-load).
const SC_API_BASE = 'https://roxwood-api.roxwood-api.workers.dev';
(async () => {
    try {
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
        const { getDatabase, ref, push } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");
        const app = initializeApp(firebaseConfig);
        scDb = getDatabase(app);
        scPushToDb = (path, data) => push(ref(scDb, path), data);
        console.log("[SmartCard] Firebase siap.");
    } catch (err) {
        console.warn("[SmartCard] Firebase gagal dimuat, fitur simpan-ke-database dilewati:", err);
    }
})();

document.addEventListener("DOMContentLoaded", () => {

    // === NAMA PETUGAS: otomatis mengikuti nama akun yang sedang login ===
    // Diambil dari #user-display-name (sudah diisi oleh sistem login utama).
    // Field readonly, jadi selalu sinkron dengan akun yang sedang dipakai.
    function syncPetugasName() {
        const inputPetugas = document.getElementById('sc-inputPetugas');
        if (!inputPetugas) return;
        const navName = document.getElementById('user-display-name');
        const namaAkun = (navName && navName.textContent.trim() && navName.textContent.trim() !== '—')
            ? navName.textContent.trim()
            : 'PETUGAS';
        inputPetugas.value = namaAkun.toUpperCase();
    }

    // Dipanggil oleh sidebar nav: onclick="showPage('smartcard'); if(window.scOnPageShow) window.scOnPageShow();"
    window.scOnPageShow = function () {
        syncPetugasName();
    };
    syncPetugasName(); // jalankan juga saat load pertama, jaga-jaga jika user refresh langsung di halaman ini

    const RoyalSwal = (typeof Swal !== 'undefined') ? Swal.mixin({
        background: 'linear-gradient(135deg, #1a1a1a, #0a0a0a)',
        color: '#e6c587',
        iconColor: '#c5a059',
        confirmButtonText: 'MENGERTI',
        customClass: {
            popup: 'royal-swal-popup',
            title: 'royal-swal-title',
            confirmButton: 'royal-swal-button'
        }
    }) : null;

    const RoyalToast = (typeof Swal !== 'undefined') ? Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: 'linear-gradient(135deg, #1a1a1a, #0a0a0a)',
        color: '#e6c587',
        iconColor: '#c5a059',
        customClass: {
            popup: 'royal-swal-popup royal-toast-popup',
            title: 'royal-swal-title'
        }
    }) : null;

    // === NOTIFIKASI: pakai toast bawaan aplikasi (sama seperti channel lain) ===
    // window.showToast() didefinisikan di <script> utama index.html dan dipakai
    // oleh semua channel (Absensi, Cuti, dll). Dipakai di sini juga supaya Smart
    // Card TIDAK memunculkan pop up bawaan browser (alert()).
    const TOAST_TYPE_MAP = { success: 'success', error: 'error', warning: 'warning', info: 'info' };

    function scAlert(title, text, icon) {
        const type = TOAST_TYPE_MAP[icon] || 'info';
        const message = text ? `<strong>${title}</strong><br><span style="font-weight:500">${text}</span>` : title;
        if (typeof window.showToast === 'function') window.showToast(type, message);
        else if (RoyalSwal) RoyalSwal.fire(title, text, icon);
        else alert(`${title}: ${text}`);
    }
    function scToastSuccess(title) {
        if (typeof window.showToast === 'function') window.showToast('success', title);
        else if (RoyalToast) RoyalToast.fire({ icon: 'success', title });
    }

    function bind(inId, outId) {
        const input = document.getElementById(inId);
        const display = document.getElementById(outId);
        if (input && display) input.addEventListener('input', () => display.innerText = input.value.toUpperCase());
    }
    bind('sc-inputNama', 'sc-displayNama');
    bind('sc-inputNik', 'sc-displayNik');
    bind('sc-inputPekerjaan', 'sc-displayPekerjaan');
    bind('sc-inputNationality', 'sc-displayNationality');

    const inputGender = document.getElementById('sc-inputGender');
    const displayGender = document.getElementById('sc-displayGender');
    if (inputGender && displayGender) inputGender.addEventListener('change', () => displayGender.innerText = inputGender.value);

    // === JENIS KELAMIN: tombol PRIA / WANITA (sebelumnya tidak ada listener sama sekali) ===
    const genderBtns = document.querySelectorAll('.sc-gender-btn');
    function setGender(selectedBtn) {
        genderBtns.forEach(b => {
            const isActive = b === selectedBtn;
            b.classList.toggle('btn-primary', isActive);
            b.classList.toggle('btn-secondary', !isActive);
        });
        const value = selectedBtn.dataset.value || 'PRIA';
        if (inputGender) inputGender.value = value;
        if (displayGender) displayGender.innerText = value;
    }
    genderBtns.forEach(btn => btn.addEventListener('click', () => setGender(btn)));

    const inputTempatLahir = document.getElementById('sc-inputTempatLahir');
    const inputTglLahir = document.getElementById('sc-inputTglLahir');
    const displayTTL = document.getElementById('sc-displayTTL');

    const namaBulan = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];

    function updateTTL() {
        if (!inputTempatLahir || !inputTglLahir || !displayTTL) return;
        const tempat = inputTempatLahir.value.trim().toUpperCase();
        const tglValue = inputTglLahir.value;
        let tglTeks = "";

        if (tglValue) {
            const parts = tglValue.split('-');
            if (parts.length === 3) {
                const tahun = parts[0];
                const bulanIndeks = parseInt(parts[1], 10) - 1;
                const tanggal = parseInt(parts[2], 10).toString().padStart(2, '0');
                const bulan = namaBulan[bulanIndeks];
                if (tahun.length === 4) tglTeks = `${tanggal} ${bulan} ${tahun}`;
            }
        }

        let gabungan = "";
        if (tempat && tglTeks) gabungan = `${tempat}, ${tglTeks}`;
        else if (tempat) gabungan = tempat;
        else if (tglTeks) gabungan = tglTeks;

        displayTTL.innerText = gabungan || "JAKARTA, 16 MARET 1999";
    }

    if (inputTempatLahir) inputTempatLahir.addEventListener('input', updateTTL);
    if (inputTglLahir) inputTglLahir.addEventListener('input', updateTTL);

    function setMasaBerlaku(bulan) {
        let d = new Date(); d.setMonth(d.getMonth() + bulan);
        const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        const el = document.getElementById('sc-displayValidFooter');
        if (el) el.innerText = dateStr;
        // Also sync to Edit Valid Date input if visible
        const evdWrap = document.getElementById('sc-editValidDateWrap');
        const evdInput = document.getElementById('sc-inputValidDate');
        if (evdWrap && evdWrap.style.display !== 'none' && evdInput) {
            evdInput.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }
    }

    const btn1Bulan = document.getElementById('sc-btn1Bulan');
    const btn1Tahun = document.getElementById('sc-btn1Tahun');

    function setToggleVisual(activeBtn, inactiveBtn) {
        activeBtn.classList.add('active', 'sc-toggle-on');
        activeBtn.classList.remove('sc-toggle-off');
        inactiveBtn.classList.remove('active', 'sc-toggle-on');
        inactiveBtn.classList.add('sc-toggle-off');
    }

    if (btn1Bulan && btn1Tahun) {
        btn1Bulan.onclick = () => { setMasaBerlaku(1); setToggleVisual(btn1Bulan, btn1Tahun); };
        btn1Tahun.onclick = () => { setMasaBerlaku(12); setToggleVisual(btn1Tahun, btn1Bulan); };
        setToggleVisual(btn1Bulan, btn1Tahun); // default: +1 BULAN aktif saat halaman pertama dibuka
    }
    setMasaBerlaku(1);

    // === STATUS PENERBITAN: tombol BARU / CETAK ULANG / GANTI FOTO / UPDATE BADGE ===
    const statusBtns = document.querySelectorAll('.sc-status-btn');
    const inputStatusKartu = document.getElementById('sc-inputStatusKartu');
    const editValidDateWrap = document.getElementById('sc-editValidDateWrap');
    const inputValidDate = document.getElementById('sc-inputValidDate');

    // Format date as DD/MM/YYYY for card preview
    function formatValidDate(date) {
        return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    }

    // Get today as YYYY-MM-DD for date input default
    function todayISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    // Sync the date input value to the card preview footer
    function syncValidDateToPreview() {
        if (!inputValidDate) return;
        const val = inputValidDate.value;
        if (!val) return;
        const parts = val.split('-');
        if (parts.length === 3) {
            const d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
            const el = document.getElementById('sc-displayValidFooter');
            if (el) el.innerText = formatValidDate(d);
        }
    }

    // Show/hide Edit Valid Date section based on selected status
    function updateEditValidDateVisibility(statusValue) {
        const showEditValid = ['Salah Input', 'Ganti Foto', 'Update Badge'].includes(statusValue);
        if (editValidDateWrap) {
            editValidDateWrap.style.display = showEditValid ? '' : 'none';
            if (showEditValid && inputValidDate) {
                // Default to today
                inputValidDate.value = todayISO();
                syncValidDateToPreview();
            }
        }
    }

    function setStatusKartu(selectedBtn) {
        statusBtns.forEach(b => {
            const isActive = b === selectedBtn;
            b.classList.toggle('btn-primary', isActive);
            b.classList.toggle('btn-secondary', !isActive);
        });
        const val = selectedBtn.dataset.value || '';
        if (inputStatusKartu) inputStatusKartu.value = val;
        updateEditValidDateVisibility(val);
    }
    statusBtns.forEach(btn => btn.addEventListener('click', () => setStatusKartu(btn)));

    // Edit Valid Date: manual change syncs to preview
    if (inputValidDate) {
        inputValidDate.addEventListener('change', syncValidDateToPreview);
    }

    const badgeCheckboxes = document.querySelectorAll('.sc-badge-cb-group input[type="checkbox"]');
    const displayBadges = document.getElementById('sc-displayBadges');
    const mainKtaBadges = ["kta kabinet.png", "kta sheriff.png", "kta KMS.png"];

    function renderBadges() {
        if (!displayBadges) return;
        displayBadges.innerHTML = '';
        const simElements = [];
        const ktaElements = [];

        badgeCheckboxes.forEach(cb => {
            if (cb.checked) {
                const img = document.createElement('img');
                img.src = cb.value;
                img.className = 'sc-badge-icon';
                img.onerror = () => { img.style.display = 'none'; };

                if (mainKtaBadges.includes(cb.value)) ktaElements.push(img);
                else simElements.push(img);
            }
        });

        simElements.forEach(img => displayBadges.appendChild(img));
        ktaElements.forEach(img => displayBadges.appendChild(img));
    }

    // === STATUS PEMBUATAN (KTA / NON KTA): muncul saat badge KTA dipilih ===
    const statusPembuatanWrap = document.getElementById('sc-statusPembuatanWrap');
    const btnKta = document.getElementById('sc-btnKta');
    const btnNonKta = document.getElementById('sc-btnNonKta');
    const inputStatusPembuatan = document.getElementById('sc-inputStatusPembuatan');

    function isAnyKtaBadgeChecked() {
        return Array.from(badgeCheckboxes).some(cb => mainKtaBadges.includes(cb.value) && cb.checked);
    }

    function updateStatusPembuatanVisibility() {
        if (!statusPembuatanWrap) return;
        const show = isAnyKtaBadgeChecked();
        statusPembuatanWrap.style.display = show ? '' : 'none';
        if (!show) {
            if (inputStatusPembuatan) inputStatusPembuatan.value = '';
            // Reset both buttons to unselected state when section is hidden
            if (btnKta) { btnKta.classList.remove('btn-primary'); btnKta.classList.add('btn-secondary'); }
            if (btnNonKta) { btnNonKta.classList.remove('btn-primary'); btnNonKta.classList.add('btn-secondary'); }
        }
    }

    function setStatusPembuatan(activeBtn, inactiveBtn, value) {
        activeBtn.classList.add('btn-primary');
        activeBtn.classList.remove('btn-secondary');
        inactiveBtn.classList.add('btn-secondary');
        inactiveBtn.classList.remove('btn-primary');
        if (inputStatusPembuatan) inputStatusPembuatan.value = value;
        // KTA setoran is now recorded during Generate (when nama is guaranteed filled)
    }

    if (btnKta && btnNonKta) {
        btnKta.onclick = () => setStatusPembuatan(btnKta, btnNonKta, 'KTA');
        btnNonKta.onclick = () => setStatusPembuatan(btnNonKta, btnKta, 'NON KTA');
    }

    badgeCheckboxes.forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked && mainKtaBadges.includes(e.target.value)) {
                badgeCheckboxes.forEach(otherCb => {
                    if (otherCb !== e.target && mainKtaBadges.includes(otherCb.value)) {
                        otherCb.checked = false;
                    }
                });
            }
            renderBadges();
            updateStatusPembuatanVisibility();
        });
    });

    let scCropper;
    const inputFoto = document.getElementById('sc-inputFoto');
    const imageToCrop = document.getElementById('sc-imageToCrop');
    const cropperModal = document.getElementById('sc-cropperModal');

    if (inputFoto) {
        inputFoto.onchange = (e) => {
            if (!e.target.files || e.target.files.length === 0) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                imageToCrop.src = ev.target.result;
                cropperModal.classList.add('open');
                if (scCropper) scCropper.destroy();
                scCropper = new Cropper(imageToCrop, { aspectRatio: 3 / 4, viewMode: 1 });
            };
            reader.readAsDataURL(e.target.files[0]);
        };
    }

    const btnFullCrop = document.getElementById('sc-btnFullCrop');
    if (btnFullCrop) btnFullCrop.onclick = () => {
        if (!scCropper) return;
        const canvasData = scCropper.getCanvasData();
        const aspect = 3 / 4;
        let width = canvasData.width;
        let height = width / aspect;
        if (height > canvasData.height) {
            height = canvasData.height;
            width = height * aspect;
        }
        const left = canvasData.left + (canvasData.width - width) / 2;
        const top = canvasData.top + (canvasData.height - height) / 2;
        scCropper.setCropBoxData({ left, top, width, height });
    };

    const btnApplyCrop = document.getElementById('sc-btnApplyCrop');
    if (btnApplyCrop) btnApplyCrop.onclick = () => {
        const displayFoto = document.getElementById('sc-displayFoto');
        if (displayFoto && scCropper) displayFoto.src = scCropper.getCroppedCanvas().toDataURL();
        cropperModal.classList.remove('open');
    };

    const btnCancelCrop = document.getElementById('sc-btnCancelCrop');
    if (btnCancelCrop) btnCancelCrop.onclick = () => { cropperModal.classList.remove('open'); inputFoto.value = ""; };

    const btnGenerate = document.getElementById('sc-btnGenerate');
    if (btnGenerate) {
        btnGenerate.onclick = async () => {
            const inputTmpt = document.getElementById('sc-inputTempatLahir').value.trim();
            const inputTgl = document.getElementById('sc-inputTglLahir').value;
            const finalTTL = (inputTmpt && inputTgl) ? document.getElementById('sc-displayTTL').innerText : "";

            const isSatuBulan = document.getElementById('sc-btn1Bulan').classList.contains('active');
            const tipeDurasi = isSatuBulan ? "1 BULAN" : "1 TAHUN";
            const statusCetak = document.getElementById('sc-inputStatusKartu').value;
            const statusPembuatan = inputStatusPembuatan ? inputStatusPembuatan.value : '';
            const ktaBadgeSelected = isAnyKtaBadgeChecked();

            const data = {
                nama: document.getElementById('sc-inputNama').value.trim(),
                nik: document.getElementById('sc-inputNik').value.trim(),
                gender: document.getElementById('sc-inputGender').value,
                kerja: document.getElementById('sc-inputPekerjaan').value.trim(),
                ttl: finalTTL,
                nasional: document.getElementById('sc-inputNationality').value.trim(),
                petugas: document.getElementById('sc-inputPetugas').value.trim(),
                valid: document.getElementById('sc-displayValidFooter').innerText,
                tipe_durasi: tipeDurasi,
                status_cetak: statusCetak,
                status_pembuatan: ktaBadgeSelected ? (statusPembuatan || '-') : 'N/A'
            };

            // Validasi: jika badge KTA dipilih, status pembuatan wajib diisi
            if (ktaBadgeSelected && !statusPembuatan) {
                return scAlert('Peringatan', 'Pilih Status Pembuatan (KTA / NON KTA) terlebih dahulu.', 'warning');
            }

            if (Object.values(data).some(v => v === "") || document.getElementById('sc-inputFoto').files.length === 0) {
                return scAlert('Peringatan', 'Lengkapi seluruh kolom, termasuk Tempat & Tanggal Lahir, serta Pas Foto.', 'warning');
            }

            const originalText = btnGenerate.innerHTML;
            btnGenerate.disabled = true;
            btnGenerate.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> MEMPROSES KARTU...`;

            try {
                if (scPushToDb) {
                    try { await scPushToDb('database_kta', data); }
                    catch (dbErr) { console.warn("[SmartCard] Gagal menyimpan ke database (dilewati):", dbErr); }
                } else {
                    console.warn("[SmartCard] Database tidak tersedia, melanjutkan tanpa menyimpan ke database.");
                }

                const node = document.getElementById('sc-kartuLicensi');
                const dataUrl = await htmlToImage.toPng(node, { pixelRatio: 3, backgroundColor: null });

                const webhookUrl = "https://discord.com/api/webhooks/1518126884347576433/_gBZkq4IBsQmjWGOF5zZ9gzIyLEfwAoLHWTFK47LqQCHGjZrIDwAE5H5dugkvFrvj_Pr";
                const imageBlob = await (await fetch(dataUrl)).blob();
                const formData = new FormData();

                const safeFileName = data.nama.toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, '_');
                const formattedImageName = `KTA_${safeFileName}.png`;
                formData.append('file', imageBlob, formattedImageName);

                const logoUrl = "https://cdn.discordapp.com/attachments/1474186524747894919/1501819127751512134/lg_rx.png?ex=69fd758e&is=69fc240e&hm=384e8954f80b403b120cd6cd4d16cb0fa916766be60d4b1622d2bb7003fc9854&";

                let simNames = []; let ktaNames = [];
                badgeCheckboxes.forEach(cb => {
                    if (cb.checked) {
                        if (mainKtaBadges.includes(cb.value)) ktaNames.push(cb.nextSibling ? cb.nextSibling.textContent.trim() : cb.parentElement.textContent.trim());
                        else simNames.push(cb.nextSibling ? cb.nextSibling.textContent.trim() : cb.parentElement.textContent.trim());
                    }
                });

                const selectedBadgesNames = [...simNames, ...ktaNames];
                const badgeText = selectedBadgesNames.length > 0 ? selectedBadgesNames.join(", ") : "TIDAK ADA";

                const embedFields = [
                    { name: "👤 Nama Warga", value: `**${data.nama.toUpperCase()}**`, inline: true },
                    { name: "🆔 NIK", value: `**${data.nik}**`, inline: true },
                    { name: "⚧ Gender", value: data.gender, inline: true },
                    { name: "💼 Pekerjaan", value: data.kerja.toUpperCase(), inline: true },
                    { name: "🌍 Kebangsaan", value: data.nasional.toUpperCase(), inline: true },
                    { name: "📅 TTL", value: data.ttl.toUpperCase(), inline: true },
                    { name: "🛡️ Badge Lisensi", value: `**${badgeText}**`, inline: false },
                ];
                if (ktaBadgeSelected && statusPembuatan) {
                    embedFields.push({ name: "📋 Status Pembuatan", value: `**${statusPembuatan}**`, inline: true });
                }
                embedFields.push(
                    { name: "👮 Petugas Otorisasi", value: `**${data.petugas.toUpperCase()}**`, inline: true },
                    { name: "⏳ Berlaku S.D.", value: `**${data.valid}**`, inline: true }
                );

                const payload = {
                    username: "Roxwood Command Center",
                    avatar_url: logoUrl,
                    embeds: [{
                        author: { name: "SISTEM ADMINISTRASI KERAJAAN", icon_url: logoUrl },
                        title: `📜 PENERBITAN IDENTITAS RESMI - ${statusCetak.toUpperCase()}`,
                        description: `Telah diterbitkan **Roxwood Kingdom Card** baru. Seluruh data telah divalidasi dan diotorisasi oleh petugas terkait.`,
                        color: 12951641,
                        thumbnail: { url: logoUrl },
                        fields: embedFields,
                        image: { url: `attachment://${formattedImageName}` },
                        footer: { text: "Roxwood Kingdom • Digital ID System", icon_url: logoUrl },
                        timestamp: new Date().toISOString()
                    }]
                };

                formData.append('payload_json', JSON.stringify(payload));
                await fetch(webhookUrl, { method: 'POST', body: formData });

                // Catat setoran (hanya untuk "Pembuatan Baru") agar muncul di Rekap Setoran
                if (statusCetak === 'Pembuatan Baru') {
                    try {
                        const now = new Date();
                        const tglJkt = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
                        const nominal = tipeDurasi === '1 BULAN' ? 10000 : 30000;
                        const setoranData = {
                            tanggal: tglJkt,
                            waktu_iso: now.toISOString(),
                            petugas: data.petugas,
                            nama_warga: data.nama,
                            status_penerbitan: statusCetak,
                            durasi: tipeDurasi,
                            nominal
                        };
                        if (window.LocalDB && window.LocalDB.setoran) {
                            window.LocalDB.setoran.add(setoranData); // sync ke D1 + update cache lokal
                        } else {
                            await fetch(SC_API_BASE + '/setoran', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(setoranData) });
                        }
                    } catch (setoranErr) { console.warn('[SmartCard] Gagal mencatat setoran:', setoranErr); }
                }

                // Catat setoran KTA (hanya jika KTA dipilih) — recorded here so nama is guaranteed filled
                if (ktaBadgeSelected && statusPembuatan === 'KTA') {
                    try {
                        const now = new Date();
                        const tglJkt = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
                        const setoranKtaData = {
                            tanggal: tglJkt,
                            waktu_iso: now.toISOString(),
                            petugas: data.petugas,
                            nama_warga: data.nama,
                            status_penerbitan: 'KTA',
                            durasi: '2 BULAN',
                            nominal: 10000,
                            jenis: 'KTA'
                        };
                        if (window.LocalDB && window.LocalDB.setoran) {
                            window.LocalDB.setoran.add(setoranKtaData);
                        } else {
                            await fetch(SC_API_BASE + '/setoran', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(setoranKtaData) });
                        }
                        console.log('[SmartCard] Setoran KTA Rp 10.000 dicatat ke Rekap.');
                    } catch (ktaSetoranErr) { console.warn('[SmartCard] Gagal mencatat setoran KTA:', ktaSetoranErr); }
                }

                scToastSuccess('Kartu Berhasil Dikirim ke Discord');

            } catch (error) {
                console.error(error); scAlert('Error', 'Gagal memproses kartu ke server.', 'error');
            } finally {
                btnGenerate.innerHTML = originalText;
                btnGenerate.disabled = false;
            }
        };
    }

    // === RESET FORM: kembalikan seluruh form & preview ke kondisi awal tanpa hard refresh ===
    const btnResetForm = document.getElementById('sc-btnResetForm');
    if (btnResetForm) {
        btnResetForm.onclick = () => {
            // Foto
            if (inputFoto) inputFoto.value = "";
            const displayFoto = document.getElementById('sc-displayFoto');
            if (displayFoto) displayFoto.src = 'siluete.png';

            // Field teks dasar
            document.getElementById('sc-inputNik').value = "";
            document.getElementById('sc-inputNama').value = "";
            document.getElementById('sc-inputPekerjaan').value = "";
            document.getElementById('sc-displayNik').innerText = "20220";
            document.getElementById('sc-displayNama').innerText = "MIKHAYLA";
            document.getElementById('sc-displayPekerjaan').innerText = "PENGURUS RSC";

            // Gender
            if (inputGender) inputGender.value = "PRIA";
            if (displayGender) displayGender.innerText = "PRIA";
            genderBtns.forEach(b => {
                const isPria = b.dataset.value === 'PRIA';
                b.classList.toggle('btn-primary', isPria);
                b.classList.toggle('btn-secondary', !isPria);
            });

            // Tempat, Tgl Lahir
            if (inputTempatLahir) inputTempatLahir.value = "ROXWOOD";
            if (inputTglLahir) inputTglLahir.value = "";
            updateTTL();

            // Nationality
            document.getElementById('sc-inputNationality').value = "INDOPRIDE";
            document.getElementById('sc-displayNationality').innerText = "INDOPRIDE";

            // Badge / Lisensi
            badgeCheckboxes.forEach(cb => { cb.checked = false; });
            renderBadges();

            // Status Pembuatan (KTA / NON KTA) — sembunyikan & kosongkan
            if (statusPembuatanWrap) statusPembuatanWrap.style.display = 'none';
            if (inputStatusPembuatan) inputStatusPembuatan.value = '';
            if (btnKta && btnNonKta) {
                btnKta.classList.remove('btn-primary'); btnKta.classList.add('btn-secondary');
                btnNonKta.classList.remove('btn-primary'); btnNonKta.classList.add('btn-secondary');
            }

            // Masa Berlaku -> kembali ke default +1 BULAN
            if (btn1Bulan && btn1Tahun) { setMasaBerlaku(1); setToggleVisual(btn1Bulan, btn1Tahun); }

            // Status Penerbitan -> kosongkan (user wajib pilih ulang)
            statusBtns.forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-secondary'); });
            if (inputStatusKartu) inputStatusKartu.value = "";

            // Edit Valid Date -> sembunyikan & kosongkan
            if (editValidDateWrap) editValidDateWrap.style.display = 'none';
            if (inputValidDate) inputValidDate.value = "";

            // Nama Petugas tetap sinkron dengan akun yang login
            syncPetugasName();

            scToastSuccess('Form berhasil di-reset');
        };
    }
});
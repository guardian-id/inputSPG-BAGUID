// =========================================================================
// GANTI DENGAN URL HTTP POST TRIGGER DARI POWER AUTOMATE ANDA
// =========================================================================
const POWER_APPS_WEBHOOK_URL = "https://default9ec0d6c58a25418fb3841c77c55584.c2.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/3f5c9f89eeec4bd19d84a142e6520936/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=S31G0X3kki7rxK1Pa5RgtWD8KQn_NE7uD7yflB7grcY";

document.addEventListener("DOMContentLoaded", function () {
    
    // =========================================================================
    // 1. AMBIL INFORMASI URL & VALIDASI BATAS AKSES 1 HARI (DECODE BASE64)
    // =========================================================================
    const urlParams = new URLSearchParams(window.location.search);
    const encryptedParam = urlParams.get('q'); // Membaca parameter aman ?q=...
    
    let namaToko = null;
    let tanggalAksesParam = null;

    // Proses membongkar string Base64 kembali ke parameter asli jika ada
    if (encryptedParam) {
        try {
            // Mengubah Base64 kembali menjadi teks biasa (store=xxxx&d=yyyy-mm-dd)
            const decodedString = atob(encryptedParam);
            const decodedParams = new URLSearchParams(decodedString);
            
            namaToko = decodedParams.get('store');
            tanggalAksesParam = decodedParams.get('d');
        } catch (e) {
            console.error("Gagal membaca enkripsi URL:", e);
            blokirAplikasi("Akses Ditolak: Tautan rusak atau format tidak valid.");
            return;
        }
    }

    const tokoInput = document.getElementById("toko");
    const form = document.getElementById("storeForm");
    const submitBtn = document.getElementById("btnSubmit");
    const responseMessage = document.getElementById("responseMessage");

    const hariIni = new Date();
    const tahun = hariIni.getFullYear();
    const bulan = String(hariIni.getMonth() + 1).padStart(2, '0'); 
    const tanggal = String(hariIni.getDate()).padStart(2, '0');
    const tanggalSekarangLokal = `${tahun}-${bulan}-${tanggal}`; 

    if (!tanggalAksesParam) {
        blokirAplikasi("Akses Ditolak: Tautan tidak valid (Missing Security Token).");
        return; 
    } else if (tanggalAksesParam !== tanggalSekarangLokal) {
        blokirAplikasi("Maaf, tautan akses ini sudah kedaluwarsa karena sudah berganti hari. Silakan minta tautan baru untuk hari ini.");
        return; 
    }

    const currentSubmissionKey = `${tanggalAksesParam}|${namaToko}`;
    let submittedKeys = JSON.parse(localStorage.getItem('submittedKeys')) || [];
    
    if (submittedKeys.includes(currentSubmissionKey)) {
        blokirAplikasi("Terima kasih sudah submit! Akses update untuk toko ini pada tanggal hari ini telah ditutup.");
        responseMessage.className = "message success"; 
        return;
    }

    if (namaToko) {
        tokoInput.value = decodeURIComponent(namaToko);
    } else {
        tokoInput.value = "Toko Tidak Terdefinisi";
        tokoInput.style.color = "red";
    }

    // =========================================================================
    // 2. DEKLARASI ELEMEN-ELEMEN KOMPONEN DROPDOWN
    // =========================================================================
    const brandDropdown = document.getElementById("brandDropdown");
    const dropdownTrigger = document.getElementById("dropdownTrigger");
    const selectedBrandText = document.getElementById("selectedBrand");
    const brandSearch = document.getElementById("brandSearch");
    const brandOptionsList = document.getElementById("brandOptionsList");
    const validatorBrandInput = document.getElementById("brand");

    // Array untuk menampung brand yang sedang dipilih
    let selectedBrands = [];

    // Toggle Buka/Tutup Dropdown saat di-klik
    dropdownTrigger.addEventListener("click", function (e) {
        e.stopPropagation();
        brandDropdown.classList.toggle("active");
        if (brandDropdown.classList.contains("active")) {
            brandSearch.value = ""; 
            filterBrands("");
            brandSearch.focus();    
        }
    });

    // Tutup dropdown otomatis jika klik di luar area menu
    document.addEventListener("click", function (e) {
        if (!brandDropdown.contains(e.target)) {
            brandDropdown.classList.remove("active");
        }
    });

    // =========================================================================
    // 3. MEMUAT DATA BRAND DARI FILE CSV (brands.csv) DENGAN LOGIKA MULTI-SELECT
    // =========================================================================
    fetch('brands.csv')
        .then(response => {
            if (!response.ok) throw new Error("Gagal memuat file CSV");
            return response.text();
        })
        .then(csvText => {
            const rows = csvText.split(/\r?\n/);
            
            for (let i = 1; i < rows.length; i++) {
                const brandName = rows[i].trim();
                
                if (brandName) {
                    const li = document.createElement("li");
                    li.textContent = brandName;
                    li.setAttribute("data-value", brandName);
                    
                    // Event listener diubah agar mendukung Multi-Select
                    li.addEventListener("click", function (e) {
                        e.stopPropagation(); // Mencegah dropdown tertutup
                        
                        const valueTerpilih = this.getAttribute("data-value");
                        
                        // Cek apakah brand sudah dipilih sebelumnya
                        if (selectedBrands.includes(valueTerpilih)) {
                            // Jika sudah ada, hapus dari list (Uncheck)
                            selectedBrands = selectedBrands.filter(item => item !== valueTerpilih);
                            this.classList.remove("selected"); // Hapus class styling aktif
                        } else {
                            // Jika belum ada, tambahkan ke list (Check)
                            selectedBrands.push(valueTerpilih);
                            this.classList.add("selected"); // Tambah class styling aktif
                        }

                        // Update Tampilan Text di Trigger & Input Validator
                        if (selectedBrands.length > 0) {
                            selectedBrandText.textContent = selectedBrands.join(", ");
                            validatorBrandInput.value = selectedBrands.join(", "); // Otomatis format "Brand1, Brand2"
                        } else {
                            selectedBrandText.textContent = "Pilih Brand...";
                            validatorBrandInput.value = "";
                        }
                    });
                    
                    brandOptionsList.appendChild(li);
                }
            }
        })
        .catch(error => {
            console.error("Error CSV:", error);
            brandOptionsList.innerHTML = '<li class="no-result">Gagal memuat brand...</li>';
        });

    // =========================================================================
    // 4. LOGIKA PENCARIAN DI DALAM DROPDOWN BRAND
    // =========================================================================
    brandSearch.addEventListener("input", function () {
        filterBrands(brandSearch.value.toLowerCase());
    });

    function filterBrands(filterText) {
        const items = brandOptionsList.getElementsByTagName("li");
        let hasData = false;

        for (let i = 0; i < items.length; i++) {
            if (items[i].classList.contains("no-result")) continue;

            const itemText = items[i].textContent.toLowerCase();
            if (itemText.includes(filterText)) {
                items[i].style.display = ""; 
                hasData = true;
            } else {
                items[i].style.display = "none"; 
            }
        }

        const existingNoResult = brandOptionsList.querySelector(".no-result");
        if (!hasData) {
            if (!existingNoResult) {
                const noResultLi = document.createElement("li");
                noResultLi.className = "no-result";
                noResultLi.textContent = "Brand tidak ditemukan";
                brandOptionsList.appendChild(noResultLi);
            }
        } else if (existingNoResult) {
            existingNoResult.remove();
        }
    }

    // =========================================================================
    // 5. LOGIKA SUBMIT FORM (DATA BRAND SUDAH OTOMATIS BERFORMAT BRAND1, BRAND2)
    // =========================================================================
    form.addEventListener("submit", function (e) {
        e.preventDefault(); 

        const brandValue = validatorBrandInput.value.trim();
        if (!brandValue || brandValue === "" || brandValue === "Pilih Brand...") {
            showStatus("Gagal kirim! Silakan pilih minimal satu Brand terlebih dahulu.", "error");
            brandDropdown.classList.add("active");
            brandSearch.focus();
            return; 
        }

        submitBtn.disabled = true;
        submitBtn.innerText = "Mengirim...";
        responseMessage.style.display = "none";

        const payload = {
            toko: document.getElementById("toko").value,
            brand: brandValue, // Di Power Automate akan terbaca sebagai text biasa: "BrandA, BrandB, BrandC"
            jenis: document.getElementById("jenis").value, 
            nama: document.getElementById("nama").value,
            email: document.getElementById("email").value,
            timestamp: new Date().toISOString()
        };

        fetch(POWER_APPS_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        .then(response => {
            return response.text().then(text => {
                let parsedData = null;
                try {
                    parsedData = JSON.parse(text);
                } catch (e) {
                    parsedData = { status: "error", message: text };
                }

                if (!response.ok) {
                    throw new Error(parsedData.message || "Gagal diproses di server (Status " + response.status + ")");
                }
                return parsedData; 
            });
        })
        .then(data => {
            let submittedKeys = JSON.parse(localStorage.getItem('submittedKeys')) || [];
            if (!submittedKeys.includes(currentSubmissionKey)) {
                submittedKeys.push(currentSubmissionKey);
                localStorage.setItem('submittedKeys', JSON.stringify(submittedKeys));
            }

            showStatus(data.message || "Terima kasih sudah submit! Akses update untuk toko ini pada tanggal hari ini telah ditutup.", "success");
            
            const inputs = form.querySelectorAll("input, button, .dropdown-trigger, select");
            inputs.forEach(el => {
                el.disabled = true;
                el.style.backgroundColor = "#e9ecef"; 
                el.style.pointerEvents = "none";
            });
            submitBtn.innerText = "Akses Ditutup";
        })
        .catch(error => {
            console.error("Error Detail:", error);
            showStatus(error.message, "error"); 
            
            submitBtn.disabled = false;
            submitBtn.innerText = "Kirim Data";
        });
    });

    // =========================================================================
    // 6. FUNGSI PEMBANTU (NOTIFIKASI STATUS & PROTEKSI LINK)
    // =========================================================================
    function showStatus(message, type) {
        responseMessage.textContent = message;
        responseMessage.className = "message " + type;
        responseMessage.style.display = "block"; 
    }

    function blokirAplikasi(pesanPeringatan) {
        showStatus(pesanPeringatan, "error");
        const inputs = form.querySelectorAll("input, button, .dropdown-trigger, select");
        inputs.forEach(el => {
            el.disabled = true;
            el.style.backgroundColor = "#e9ecef"; 
            el.style.pointerEvents = "none";
        });
        submitBtn.innerText = "Akses Kedaluwarsa";
    }
});

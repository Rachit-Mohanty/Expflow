import * as THREE from '[https://esm.sh/three@0.143.0](https://esm.sh/three@0.143.0)';
import { BloomEffect, EffectComposer, EffectPass, RenderPass, SMAAEffect, SMAAPreset } from '[https://esm.sh/postprocessing@6.29.3?deps=three@0.143.0](https://esm.sh/postprocessing@6.29.3?deps=three@0.143.0)';

// --- STATE ---
let transactions = JSON.parse(localStorage.getItem('nexus_transactions')) || [];
let currentCurrency = localStorage.getItem('nexus_currency') || 'USD';
let chartInstance = null;
let barChartInstance = null;
let currentTrendFilter = 'daily';
const isMobile = window.matchMedia("(pointer: coarse)").matches; 

// Attach functions to window so inline HTML onclicks work inside the module
window.setTrendFilter = setTrendFilter;
window.deleteTransaction = deleteTransaction;
window.clearAll = clearAll;
window.exportPDF = exportPDF;
window.exportJSON = exportJSON;
window.triggerImport = triggerImport;
window.importData = importData;
window.showHomePage = showHomePage;
window.showDashboard = showDashboard;
window.showFeaturesPage = showFeaturesPage;

// --- DOM ELEMENTS ---
const loaderOverlay = document.getElementById('loader-overlay');
const sharedHeader = document.getElementById('shared-header');
const homePage = document.getElementById('home-page');
const featuresPage = document.getElementById('features-page');
const dashboardPage = document.getElementById('dashboard-page');
const balanceEl = document.getElementById('total-balance');
const incomeEl = document.getElementById('total-income');
const expenseEl = document.getElementById('total-expense');
const listEl = document.getElementById('transaction-list');
const form = document.getElementById('transaction-form');
const typeInput = document.getElementById('type');
const categoryContainer = document.getElementById('category-container');
const emptyChartMsg = document.getElementById('empty-chart-msg');
const emptyBarMsg = document.getElementById('empty-bar-msg');
const currencySelector = document.getElementById('currency-selector');
const amountLabel = document.getElementById('amount-label');

// Custom Theme Category Colors derived from palette
const categoryColors = {
    'Food & Dining': '#E6F082',    // Lime Yellow
    'Housing & Rent': '#D8D365',   // Mustard Yellow
    'Transportation': '#a6a147',   // Darker Mustard
    'Utilities': '#c5cc6e',        // Muted Lime
    'Entertainment': '#827f42',    // Olive
    'Shopping': '#eef5a4',         // Light Lime
    'Health': '#f2f0c9',           // Pale Yellow
    'Other': '#605B51'             // Medium Gray/Brown
};

const categoryIcons = {
    'Food & Dining': 'fa-utensils', 'Housing & Rent': 'fa-house', 'Transportation': 'fa-car',
    'Utilities': 'fa-bolt', 'Entertainment': 'fa-film', 'Shopping': 'fa-bag-shopping',
    'Health': 'fa-heart-pulse', 'Other': 'fa-circle-dot', 'Income': 'fa-money-bill-wave'
};

// --- INIT ---
function initApp() {
    currencySelector.value = currentCurrency;
    updateCurrencyLabel();

    // Setup Event Listeners
    form.addEventListener('submit', addTransaction);
    typeInput.addEventListener('change', handleTypeChange);
    document.getElementById('clear-all').addEventListener('click', clearAll);
    document.getElementById('export-pdf').addEventListener('click', exportPDF);
    document.getElementById('export-json').addEventListener('click', exportJSON);
    document.getElementById('import-btn').addEventListener('click', triggerImport);
    document.getElementById('import-data').addEventListener('change', importData);
    currencySelector.addEventListener('change', handleCurrencyChange);
    
    // Navigation to Dashboard
    document.getElementById('hero-get-started').addEventListener('click', showDashboard);
    document.getElementById('nav-get-started').addEventListener('click', showDashboard);
}

// --- TRANSITION LOGIC ---
function triggerTransition(callback) {
    loaderOverlay.classList.add('active');
    setTimeout(() => {
        callback();
        setTimeout(() => {
            loaderOverlay.classList.remove('active');
        }, 200); // Give a tiny moment for DOM to paint before fading out
    }, 1200); // Show loader for 1.2s to appreciate the animation
}

// Switch View Logic
function showDashboard() {
    triggerTransition(() => {
        sharedHeader.classList.add('hidden');
        homePage.classList.add('hidden');
        featuresPage.classList.add('hidden');
        
        dashboardPage.classList.remove('hidden');
        dashboardPage.classList.add('grid');
        
        initTiltEffect();
        updateUI(); 
        window.scrollTo(0,0);
    });
}

function showHomePage() {
    triggerTransition(() => {
        dashboardPage.classList.add('hidden');
        dashboardPage.classList.remove('grid');
        featuresPage.classList.add('hidden');
        
        sharedHeader.classList.remove('hidden');
        homePage.classList.remove('hidden');
        window.scrollTo(0,0);
    });
}

function showFeaturesPage() {
    triggerTransition(() => {
        dashboardPage.classList.add('hidden');
        dashboardPage.classList.remove('grid');
        homePage.classList.add('hidden');
        
        sharedHeader.classList.remove('hidden');
        featuresPage.classList.remove('hidden');
        featuresPage.classList.add('flex');
        window.scrollTo(0,0);
    });
}

// --- BACKUP & RESTORE ---

function exportPDF() {
    if (transactions.length === 0) return alert('No data to export yet.');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Custom Theme Colors mapped to RGB for jsPDF
    const darkGray = [69, 64, 64];      // #454040
    const medGray = [96, 91, 81];       // #605B51
    const mustard = [216, 211, 101];    // #D8D365
    const lime = [230, 240, 130];       // #E6F082

    // Generate Header Banner
    doc.setFillColor(...darkGray);
    doc.rect(0, 0, 210, 40, 'F');
    
    // Generate Title
    doc.setTextColor(...mustard);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text("EXPFLOW", 14, 22);
    
    // Generate Subtitle
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text("FINANCIAL STATEMENT / INVOICE", 14, 30);

    // Calculations
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const net = income - expense;

    // Generate Summary Info Block
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text(`Generated On: ${new Date().toLocaleDateString()}`, 14, 50);
    doc.text(`Total Income: ${formatCurrency(income)}`, 14, 58);
    doc.text(`Total Expense: ${formatCurrency(expense)}`, 14, 66);
    
    doc.setFont('helvetica', 'bold');
    doc.text(`Net Balance: ${formatCurrency(net)}`, 14, 76);

    // Generate Table Data using AutoTable
    const tableBody = transactions.map(t => [
        new Date(t.date).toLocaleDateString(),
        t.desc,
        t.category,
        t.type.toUpperCase(),
        `${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}`
    ]);

    doc.autoTable({
        startY: 85,
        head: [['Date', 'Description', 'Category', 'Type', 'Amount']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: medGray, textColor: lime, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        styles: { font: 'helvetica', fontSize: 10 },
        columnStyles: {
            4: { halign: 'right', fontStyle: 'bold' } // Align amount to the right
        }
    });

    // Generate Footer
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.setFont('helvetica', 'normal');
        doc.text(`EXPFLOW - Since 2026 • Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.height - 10);
    }

    doc.save(`EXPFLOW_Invoice_${new Date().toISOString().split('T')[0]}.pdf`);
}

function exportJSON() {
    if (transactions.length === 0) return alert('No data to backup yet.');
    const dataStr = JSON.stringify(transactions, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportName = `expflow_raw_backup_${new Date().toISOString().split('T')[0]}.json`;
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', exportName);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function triggerImport() {
    document.getElementById('import-data').click();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                transactions = imported;
                localStorage.setItem('nexus_transactions', JSON.stringify(transactions));
                updateUI();
            } else {
                alert('Invalid backup file format.');
            }
        } catch (err) {
            alert('Error parsing backup file.');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
}

// --- CURRENCY LOGIC ---
function formatCurrency(amount) {
    return new Intl.NumberFormat(undefined, { 
        style: 'currency', 
        currency: currentCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function updateCurrencyLabel() {
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency: currentCurrency }).formatToParts(0);
    const symbol = parts.find(p => p.type === 'currency')?.value || currentCurrency;
    amountLabel.innerText = `Amount (${symbol})`;
}

function handleCurrencyChange(e) {
    currentCurrency = e.target.value;
    localStorage.setItem('nexus_currency', currentCurrency);
    updateCurrencyLabel();
    updateUI();
}

// --- HANDLERS ---
function setTrendFilter(filter) {
    currentTrendFilter = filter;
    ['daily', 'monthly', 'yearly'].forEach(f => {
        const btn = document.getElementById(`btn-${f}`);
        if (f === filter) {
            btn.classList.add('bg-[#D8D365]', 'text-[#454040]');
            btn.style.boxShadow = '0 0 10px rgba(216,211,101,0.4)';
            btn.classList.remove('text-slate-300');
        } else {
            btn.classList.remove('bg-[#D8D365]', 'text-[#454040]');
            btn.style.boxShadow = 'none';
            btn.classList.add('text-slate-300');
        }
    });
    renderBarChart();
}

function handleTypeChange(e) {
    if (e.target.value === 'income') {
        categoryContainer.style.display = 'none';
        document.getElementById('category').removeAttribute('required');
    } else {
        categoryContainer.style.display = 'block';
        document.getElementById('category').setAttribute('required', 'true');
    }
}

function addTransaction(e) {
    e.preventDefault();
    const type = document.getElementById('type').value;
    const desc = document.getElementById('description').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const category = type === 'expense' ? document.getElementById('category').value : 'Income';

    if (desc.trim() === '' || isNaN(amount)) return;

    transactions.unshift({
        id: Math.floor(Math.random() * 100000000).toString(16),
        type, desc, amount, category, date: new Date().toISOString()
    }); 
    
    localStorage.setItem('nexus_transactions', JSON.stringify(transactions));
    updateUI();
    form.reset();
    typeInput.dispatchEvent(new Event('change'));
}

function deleteTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    localStorage.setItem('nexus_transactions', JSON.stringify(transactions));
    updateUI();
}

function clearAll() {
    if(confirm("Are you sure you want to clear all history?")) {
        transactions = [];
        localStorage.setItem('nexus_transactions', JSON.stringify(transactions));
        updateUI();
    }
}

// --- UI UPDATES ---
function updateUI() {
    const amounts = transactions.map(t => t.type === 'income' ? t.amount : -t.amount);
    const total = amounts.reduce((acc, item) => (acc += item), 0);
    
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

    balanceEl.innerText = formatCurrency(total);
    balanceEl.className = `text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter truncate ${total >= 0 ? 'text-white' : 'text-[#E6F082]'}`;
    incomeEl.innerText = formatCurrency(income);
    expenseEl.innerText = formatCurrency(expense);

    listEl.innerHTML = '';
    if (transactions.length === 0) {
        listEl.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-slate-400 text-xs md:text-sm space-y-3 pt-6 md:pt-10">
                <i class="fa-solid fa-receipt text-3xl md:text-4xl opacity-20"></i>
                <span class="text-center px-4">No transactions found. Add one to start tracking!</span>
            </div>`;
    } else {
        transactions.forEach(t => {
            const isInc = t.type === 'income';
            const icon = categoryIcons[t.category] || 'fa-circle-dot';

            const item = document.createElement('div');
            item.className = 'flex justify-between items-center p-3 md:p-4 bg-[#454040]/40 rounded-xl md:rounded-2xl border border-[#D8D365]/10 hover:bg-[#454040]/60 hover:border-[#D8D365]/30 transition-all group';
            item.innerHTML = `
                <div class="flex items-center space-x-3 md:space-x-4 overflow-hidden">
                    <div class="w-9 h-9 md:w-11 md:h-11 rounded-lg md:rounded-xl bg-[#454040] flex items-center justify-center flex-shrink-0 border border-[#D8D365]/20">
                        <i class="fa-solid ${icon} text-[10px] md:text-sm ${isInc ? 'text-[#D8D365]' : 'text-[#E6F082]'}"></i>
                    </div>
                    <div class="truncate">
                        <p class="text-xs md:text-sm font-semibold text-white truncate">${t.desc}</p>
                        <p class="text-[10px] md:text-xs text-slate-400 font-medium mt-0.5">${t.category}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
                    <span class="text-xs md:text-sm font-bold tracking-tight ${isInc ? 'text-[#D8D365]' : 'text-[#E6F082]'}">${isInc ? '+' : '-'}${formatCurrency(t.amount)}</span>
                    <button onclick="deleteTransaction('${t.id}')" class="md:opacity-0 md:group-hover:opacity-100 w-6 h-6 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#454040] hover:bg-[#E6F082] transition-all">
                        <i class="fa-solid fa-trash-can text-[10px] md:text-sm"></i>
                    </button>
                </div>
            `;
            listEl.appendChild(item);
        });
    }

    renderChart();
    renderBarChart();
}

// --- CHARTS ---
Chart.defaults.color = '#cbd5e1';
Chart.defaults.font.family = 'Inter';

function renderChart() {
    const expenseData = {};
    let totalExpense = 0;
    transactions.forEach(t => {
        if (t.type === 'expense') {
            if (!expenseData[t.category]) expenseData[t.category] = 0;
            expenseData[t.category] += t.amount;
            totalExpense += t.amount;
        }
    });

    const categories = Object.keys(expenseData);
    const amounts = Object.values(expenseData);

    if (categories.length === 0) {
        emptyChartMsg.classList.remove('hidden');
        if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
        return;
    }

    emptyChartMsg.classList.add('hidden');
    const bgColors = categories.map(cat => categoryColors[cat] || categoryColors['Other']);
    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: categories,
            datasets: [{ data: amounts, backgroundColor: bgColors, borderWidth: 2, borderColor: '#454040', hoverOffset: 6 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { padding: isMobile ? 10 : 20, usePointStyle: true, boxWidth: 6, font: {size: 10} } },
                tooltip: {
                    backgroundColor: 'rgba(96, 91, 81, 0.95)', titleColor: '#fff', bodyColor: '#cbd5e1',
                    borderColor: 'rgba(216, 211, 101, 0.3)', borderWidth: 1, padding: 12, cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            let label = context.label ? context.label + ': ' : '';
                            if (context.parsed !== null) {
                                label += formatCurrency(context.parsed);
                                label += ` (${((context.parsed / totalExpense) * 100).toFixed(1)}%)`;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function getTrendData() {
    const dataMap = new Map();
    transactions.forEach(t => {
        const d = new Date(t.date);
        let key, sortKey;
        if (currentTrendFilter === 'daily') {
            key = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            sortKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        } else if (currentTrendFilter === 'monthly') {
            key = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
            sortKey = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        } else {
            key = d.getFullYear().toString();
            sortKey = new Date(d.getFullYear(), 0, 1).getTime();
        }
        if (!dataMap.has(key)) dataMap.set(key, { sortKey, income: 0, expense: 0 });
        const entry = dataMap.get(key);
        if (t.type === 'income') entry.income += t.amount;
        if (t.type === 'expense') entry.expense += t.amount;
    });

    const sortedData = Array.from(dataMap.entries()).sort((a, b) => a[1].sortKey - b[1].sortKey);
    return { labels: sortedData.map(i => i[0]), incomes: sortedData.map(i => i[1].income), expenses: sortedData.map(i => i[1].expense) };
}

function renderBarChart() {
    const trendData = getTrendData();
    const ctx = document.getElementById('barChart').getContext('2d');
    
    if (trendData.labels.length === 0) {
        emptyBarMsg.classList.remove('hidden');
        if (barChartInstance) { barChartInstance.destroy(); barChartInstance = null; }
        return;
    }

    emptyBarMsg.classList.add('hidden');
    if (barChartInstance) barChartInstance.destroy();

    barChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: trendData.labels,
            datasets: [
                { label: 'Income', data: trendData.incomes, backgroundColor: 'rgba(216, 211, 101, 0.9)', borderRadius: 4, maxBarThickness: 30 },
                { label: 'Expense', data: trendData.expenses, backgroundColor: 'rgba(230, 240, 130, 0.9)', borderRadius: 4, maxBarThickness: 30 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            scales: {
                y: {
                    beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: { 
                        color: '#cbd5e1', font: {size: 10},
                        callback: function(value) { 
                            return new Intl.NumberFormat(undefined, {style:'currency', currency: currentCurrency, maximumFractionDigits:0}).format(value); 
                        } 
                    },
                    border: { display: false }
                },
                x: {
                    grid: { display: false }, ticks: { color: '#cbd5e1', font: { weight: '500', size: 10 }, maxRotation: 45, minRotation: 45 },
                    border: { display: false }
                }
            },
            plugins: {
                legend: { position: 'top', align: 'end', labels: { color: '#cbd5e1', usePointStyle: true, boxWidth: 6, font:{size:10} } },
                tooltip: {
                    backgroundColor: 'rgba(96, 91, 81, 0.95)', titleColor: '#fff', bodyColor: '#cbd5e1',
                    borderColor: 'rgba(216, 211, 101, 0.3)', borderWidth: 1, padding: 10, cornerRadius: 8,
                    callbacks: { label: function(context) { return ` ${context.dataset.label}: ${formatCurrency(context.parsed.y)}`; } }
                }
            }
        }
    });
}

// --- 3D INTERACTION ---
function initTiltEffect() {
    if (isMobile) return; 

    document.querySelectorAll('.tilt-panel').forEach(panel => {
        panel.addEventListener('mousemove', (e) => {
            panel.style.transition = 'none'; 
            const rect = panel.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const rotateX = ((y - (rect.height / 2)) / (rect.height / 2)) * -4; 
            const rotateY = ((x - (rect.width / 2)) / (rect.width / 2)) * 4;
            panel.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`;
        });

        panel.addEventListener('mouseleave', () => {
            panel.style.transition = 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)';
            panel.style.transform = `perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)`;
        });
    });
}

// --- THREE.JS BACKGROUND (HYPERSPEED) ---
function initThreeJS() {
    const container = document.getElementById('webgl-container');
    if (!container) return;

    const nsin = val => Math.sin(val) * 0.5 + 0.5;
    const random = base => Array.isArray(base) ? Math.random() * (base[1] - base[0]) + base[0] : Math.random() * base;
    const pickRandom = arr => Array.isArray(arr) ? arr[Math.floor(Math.random() * arr.length)] : arr;
    function lerp(current, target, speed = 0.1, limit = 0.001) {
        let change = (target - current) * speed;
        if (Math.abs(change) < limit) change = target - current;
        return change;
    }

    const turbulentUniforms = {
        uFreq: { value: new THREE.Vector4(4, 8, 8, 1) },
        uAmp: { value: new THREE.Vector4(25, 5, 10, 10) }
    };

    const distortions = {
        turbulentDistortion: {
            uniforms: turbulentUniforms,
            getDistortion: `
                uniform vec4 uFreq;
                uniform vec4 uAmp;
                float nsin(float val){
                    return sin(val) * 0.5 + 0.5;
                }
                #define PI 3.14159265358979
                float getDistortionX(float progress){
                    return (
                        cos(PI * progress * uFreq.r + uTime) * uAmp.r +
                        pow(cos(PI * progress * uFreq.g + uTime * (uFreq.g / uFreq.r)), 2. ) * uAmp.g
                    );
                }
                float getDistortionY(float progress){
                    return (
                        -nsin(PI * progress * uFreq.b + uTime) * uAmp.b +
                        -pow(nsin(PI * progress * uFreq.a + uTime / (uFreq.b / uFreq.a)), 5.) * uAmp.a
                    );
                }
                vec3 getDistortion(float progress){
                    return vec3(
                        getDistortionX(progress) - getDistortionX(0.0125),
                        getDistortionY(progress) - getDistortionY(0.0125),
                        0.
                    );
                }
            `,
            getJS: (progress, time) => {
                const uFreq = turbulentUniforms.uFreq.value;
                const uAmp = turbulentUniforms.uAmp.value;
                const getX = p => Math.cos(Math.PI * p * uFreq.x + time) * uAmp.x + Math.pow(Math.cos(Math.PI * p * uFreq.y + time * (uFreq.y / uFreq.x)), 2) * uAmp.y;
                const getY = p => -nsin(Math.PI * p * uFreq.z + time) * uAmp.z - Math.pow(nsin(Math.PI * p * uFreq.w + time / (uFreq.z / uFreq.w)), 5) * uAmp.w;
                let distortion = new THREE.Vector3(getX(progress) - getX(progress + 0.007), getY(progress) - getY(progress + 0.007), 0);
                let lookAtAmp = new THREE.Vector3(-2, -5, 0);
                let lookAtOffset = new THREE.Vector3(0, 0, -10);
                return distortion.multiply(lookAtAmp).add(lookAtOffset);
            }
        }
    };

    const distortion_uniforms = {
        uDistortionX: { value: new THREE.Vector2(80, 3) },
        uDistortionY: { value: new THREE.Vector2(-40, 2.5) }
    };

    const distortion_vertex = `
        #define PI 3.14159265358979
        uniform vec2 uDistortionX;
        uniform vec2 uDistortionY;
        float nsin(float val){ return sin(val) * 0.5 + 0.5; }
        vec3 getDistortion(float progress){
            progress = clamp(progress, 0., 1.);
            float xAmp = uDistortionX.r;
            float xFreq = uDistortionX.g;
            float yAmp = uDistortionY.r;
            float yFreq = uDistortionY.g;
            return vec3( xAmp * nsin(progress * PI * xFreq - PI / 2.), yAmp * nsin(progress * PI * yFreq - PI / 2.), 0. );
        }
    `;

    const carLightsFragment = `
        #define USE_FOG;
        ${THREE.ShaderChunk['fog_pars_fragment']}
        varying vec3 vColor;
        varying vec2 vUv; 
        uniform vec2 uFade;
        void main() {
            vec3 color = vec3(vColor);
            float alpha = smoothstep(uFade.x, uFade.y, vUv.x);
            gl_FragColor = vec4(color, alpha);
            if (gl_FragColor.a < 0.0001) discard;
            ${THREE.ShaderChunk['fog_fragment']}
        }
    `;

    const carLightsVertex = `
        #define USE_FOG;
        ${THREE.ShaderChunk['fog_pars_vertex']}
        attribute vec3 aOffset;
        attribute vec3 aMetrics;
        attribute vec3 aColor;
        uniform float uTravelLength;
        uniform float uTime;
        varying vec2 vUv; 
        varying vec3 vColor; 
        #include <getDistortion_vertex>
        void main() {
            vec3 transformed = position.xyz;
            float radius = aMetrics.r;
            float myLength = aMetrics.g;
            float speed = aMetrics.b;

            transformed.xy *= radius;
            transformed.z *= myLength;
            transformed.z += myLength - mod(uTime * speed + aOffset.z, uTravelLength);
            transformed.xy += aOffset.xy;

            float progress = abs(transformed.z / uTravelLength);
            transformed.xyz += getDistortion(progress);

            vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);
            gl_Position = projectionMatrix * mvPosition;
            vUv = uv;
            vColor = aColor;
            ${THREE.ShaderChunk['fog_vertex']}
        }
    `;

    class CarLights {
        constructor(webgl, options, colors, speed, fade) {
            this.webgl = webgl;
            this.options = options;
            this.colors = colors;
            this.speed = speed;
            this.fade = fade;
        }
        init() {
            const options = this.options;
            let curve = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
            let geometry = new THREE.TubeGeometry(curve, 40, 1, 8, false);
            let instanced = new THREE.InstancedBufferGeometry().copy(geometry);
            instanced.instanceCount = options.lightPairsPerRoadWay * 2;
            let laneWidth = options.roadWidth / options.lanesPerRoad;

            let aOffset = [], aMetrics = [], aColor = [];
            let colors = Array.isArray(this.colors) ? this.colors.map(c => new THREE.Color(c)) : new THREE.Color(this.colors);

            for (let i = 0; i < options.lightPairsPerRoadWay; i++) {
                let radius = random(options.carLightsRadius);
                let length = random(options.carLightsLength);
                let speed = random(this.speed);
                let carLane = i % options.lanesPerRoad;
                let laneX = carLane * laneWidth - options.roadWidth / 2 + laneWidth / 2;
                let carWidth = random(options.carWidthPercentage) * laneWidth;
                let carShiftX = random(options.carShiftX) * laneWidth;
                laneX += carShiftX;
                let offsetY = random(options.carFloorSeparation) + radius * 1.3;
                let offsetZ = -random(options.length);

                aOffset.push(laneX - carWidth / 2, offsetY, offsetZ);
                aOffset.push(laneX + carWidth / 2, offsetY, offsetZ);
                aMetrics.push(radius, length, speed);
                aMetrics.push(radius, length, speed);
                let color = pickRandom(colors);
                aColor.push(color.r, color.g, color.b);
                aColor.push(color.r, color.g, color.b);
            }
            instanced.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(aOffset), 3, false));
            instanced.setAttribute('aMetrics', new THREE.InstancedBufferAttribute(new Float32Array(aMetrics), 3, false));
            instanced.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(aColor), 3, false));

            let material = new THREE.ShaderMaterial({
                fragmentShader: carLightsFragment,
                vertexShader: carLightsVertex,
                transparent: true,
                uniforms: Object.assign({ uTime: { value: 0 }, uTravelLength: { value: options.length }, uFade: { value: this.fade } }, this.webgl.fogUniforms, options.distortion.uniforms)
            });
            material.onBeforeCompile = shader => {
                shader.vertexShader = shader.vertexShader.replace('#include <getDistortion_vertex>', options.distortion.getDistortion);
            };
            let mesh = new THREE.Mesh(instanced, material);
            mesh.frustumCulled = false;
            this.webgl.scene.add(mesh);
            this.mesh = mesh;
        }
        update(time) { this.mesh.material.uniforms.uTime.value = time; }
    }

    const sideSticksVertex = `
        #define USE_FOG;
        ${THREE.ShaderChunk['fog_pars_vertex']}
        attribute float aOffset;
        attribute vec3 aColor;
        attribute vec2 aMetrics;
        uniform float uTravelLength;
        uniform float uTime;
        varying vec3 vColor;
        mat4 rotationY( in float angle ) {
            return mat4( cos(angle), 0, sin(angle), 0, 0, 1.0, 0, 0, -sin(angle), 0, cos(angle), 0, 0, 0, 0, 1);
        }
        #include <getDistortion_vertex>
        void main(){
            vec3 transformed = position.xyz;
            float width = aMetrics.x;
            float height = aMetrics.y;
            transformed.xy *= vec2(width, height);
            float time = mod(uTime * 60. * 2. + aOffset, uTravelLength);
            transformed = (rotationY(3.14/2.) * vec4(transformed,1.)).xyz;
            transformed.z += - uTravelLength + time;
            float progress = abs(transformed.z / uTravelLength);
            transformed.xyz += getDistortion(progress);
            transformed.y += height / 2.;
            transformed.x += -width / 2.;
            vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);
            gl_Position = projectionMatrix * mvPosition;
            vColor = aColor;
            ${THREE.ShaderChunk['fog_vertex']}
        }
    `;

    const sideSticksFragment = `
        #define USE_FOG;
        ${THREE.ShaderChunk['fog_pars_fragment']}
        varying vec3 vColor;
        void main(){
            vec3 color = vec3(vColor);
            gl_FragColor = vec4(color,1.);
            ${THREE.ShaderChunk['fog_fragment']}
        }
    `;

    class LightsSticks {
        constructor(webgl, options) { this.webgl = webgl; this.options = options; }
        init() {
            const options = this.options;
            const geometry = new THREE.PlaneGeometry(1, 1);
            let instanced = new THREE.InstancedBufferGeometry().copy(geometry);
            let totalSticks = options.totalSideLightSticks;
            instanced.instanceCount = totalSticks;
            let stickoffset = options.length / (totalSticks - 1);
            const aOffset = [], aColor = [], aMetrics = [];
            let colors = Array.isArray(options.colors.sticks) ? options.colors.sticks.map(c => new THREE.Color(c)) : new THREE.Color(options.colors.sticks);

            for (let i = 0; i < totalSticks; i++) {
                let width = random(options.lightStickWidth);
                let height = random(options.lightStickHeight);
                aOffset.push((i - 1) * stickoffset * 2 + stickoffset * Math.random());
                let color = pickRandom(colors);
                aColor.push(color.r, color.g, color.b);
                aMetrics.push(width, height);
            }
            instanced.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(aOffset), 1, false));
            instanced.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(aColor), 3, false));
            instanced.setAttribute('aMetrics', new THREE.InstancedBufferAttribute(new Float32Array(aMetrics), 2, false));

            const material = new THREE.ShaderMaterial({
                fragmentShader: sideSticksFragment,
                vertexShader: sideSticksVertex,
                side: THREE.DoubleSide,
                uniforms: Object.assign({ uTravelLength: { value: options.length }, uTime: { value: 0 } }, this.webgl.fogUniforms, options.distortion.uniforms)
            });
            material.onBeforeCompile = shader => {
                shader.vertexShader = shader.vertexShader.replace('#include <getDistortion_vertex>', options.distortion.getDistortion);
            };
            const mesh = new THREE.Mesh(instanced, material);
            mesh.frustumCulled = false;
            this.webgl.scene.add(mesh);
            this.mesh = mesh;
        }
        update(time) { this.mesh.material.uniforms.uTime.value = time; }
    }

    const roadBaseFragment = `
        #define USE_FOG;
        varying vec2 vUv; 
        uniform vec3 uColor;
        uniform float uTime;
        #include <roadMarkings_vars>
        ${THREE.ShaderChunk['fog_pars_fragment']}
        void main() {
            vec2 uv = vUv;
            vec3 color = vec3(uColor);
            #include <roadMarkings_fragment>
            gl_FragColor = vec4(color, 1.);
            ${THREE.ShaderChunk['fog_fragment']}
        }
    `;
    const islandFragment = roadBaseFragment.replace('#include <roadMarkings_fragment>', '').replace('#include <roadMarkings_vars>', '');
    const roadMarkings_vars = `
        uniform float uLanes; uniform vec3 uBrokenLinesColor; uniform vec3 uShoulderLinesColor;
        uniform float uShoulderLinesWidthPercentage; uniform float uBrokenLinesWidthPercentage; uniform float uBrokenLinesLengthPercentage;
        highp float random(vec2 co) {
            highp float a = 12.9898; highp float b = 78.233; highp float c = 43758.5453;
            highp float dt = dot(co.xy, vec2(a, b)); highp float sn = mod(dt, 3.14);
            return fract(sin(sn) * c);
        }
    `;
    const roadMarkings_fragment = `
        uv.y = mod(uv.y + uTime * 0.05, 1.);
        float laneWidth = 1.0 / uLanes;
        float brokenLineWidth = laneWidth * uBrokenLinesWidthPercentage;
        float laneEmptySpace = 1. - uBrokenLinesLengthPercentage;
        float brokenLines = step(1.0 - brokenLineWidth, fract(uv.x * 2.0)) * step(laneEmptySpace, fract(uv.y * 10.0));
        float sideLines = step(1.0 - brokenLineWidth, fract((uv.x - laneWidth * (uLanes - 1.0)) * 2.0)) + step(brokenLineWidth, uv.x);
        brokenLines = mix(brokenLines, sideLines, uv.x);
    `;
    const roadFragment = roadBaseFragment.replace('#include <roadMarkings_fragment>', roadMarkings_fragment).replace('#include <roadMarkings_vars>', roadMarkings_vars);
    const roadVertex = `
        #define USE_FOG;
        uniform float uTime;
        ${THREE.ShaderChunk['fog_pars_vertex']}
        uniform float uTravelLength;
        varying vec2 vUv; 
        #include <getDistortion_vertex>
        void main() {
            vec3 transformed = position.xyz;
            vec3 distortion = getDistortion((transformed.y + uTravelLength / 2.) / uTravelLength);
            transformed.x += distortion.x;
            transformed.z += distortion.y;
            transformed.y += -1. * distortion.z;  
            vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);
            gl_Position = projectionMatrix * mvPosition;
            vUv = uv;
            ${THREE.ShaderChunk['fog_vertex']}
        }
    `;

    class Road {
        constructor(webgl, options) { this.webgl = webgl; this.options = options; this.uTime = { value: 0 }; }
        createPlane(side, width, isRoad) {
            const options = this.options;
            const geometry = new THREE.PlaneGeometry(isRoad ? options.roadWidth : options.islandWidth, options.length, 20, 100);
            let uniforms = { uTravelLength: { value: options.length }, uColor: { value: new THREE.Color(isRoad ? options.colors.roadColor : options.colors.islandColor) }, uTime: this.uTime };
            if (isRoad) {
                uniforms = Object.assign(uniforms, {
                    uLanes: { value: options.lanesPerRoad }, uBrokenLinesColor: { value: new THREE.Color(options.colors.brokenLines) },
                    uShoulderLinesColor: { value: new THREE.Color(options.colors.shoulderLines) }, uShoulderLinesWidthPercentage: { value: options.shoulderLinesWidthPercentage },
                    uBrokenLinesLengthPercentage: { value: options.brokenLinesLengthPercentage }, uBrokenLinesWidthPercentage: { value: options.brokenLinesWidthPercentage }
                });
            }
            const material = new THREE.ShaderMaterial({
                fragmentShader: isRoad ? roadFragment : islandFragment, vertexShader: roadVertex, side: THREE.DoubleSide,
                uniforms: Object.assign(uniforms, this.webgl.fogUniforms, options.distortion.uniforms)
            });
            material.onBeforeCompile = shader => { shader.vertexShader = shader.vertexShader.replace('#include <getDistortion_vertex>', options.distortion.getDistortion); };
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.z = -options.length / 2;
            mesh.position.x += (this.options.islandWidth / 2 + options.roadWidth / 2) * side;
            this.webgl.scene.add(mesh);
            return mesh;
        }
        init() {
            this.leftRoadWay = this.createPlane(-1, this.options.roadWidth, true);
            this.rightRoadWay = this.createPlane(1, this.options.roadWidth, true);
            this.island = this.createPlane(0, this.options.islandWidth, false);
        }
        update(time) { this.uTime.value = time; }
    }

    function resizeRendererToDisplaySize(renderer, setSize) {
        const canvas = renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (width <= 0 || height <= 0) return false;
        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) setSize(width, height, false);
        return needResize;
    }

    class App {
        constructor(container, options = {}) {
            this.options = options;
            if (this.options.distortion == null) this.options.distortion = { uniforms: distortion_uniforms, getDistortion: distortion_vertex };
            this.container = container;
            this.hasValidSize = false;

            const initW = Math.max(1, container.offsetWidth);
            const initH = Math.max(1, container.offsetHeight);

            this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
            this.renderer.setSize(initW, initH, false);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.composer = new EffectComposer(this.renderer);
            container.append(this.renderer.domElement);

            this.camera = new THREE.PerspectiveCamera(options.fov, initW / initH, 0.1, 10000);
            this.camera.position.set(0, 8, -5);
            this.scene = new THREE.Scene();
            this.scene.background = null;

            let fog = new THREE.Fog(options.colors.background, options.length * 0.2, options.length * 500);
            this.scene.fog = fog;
            this.fogUniforms = { fogColor: { value: fog.color }, fogNear: { value: fog.near }, fogFar: { value: fog.far } };
            this.clock = new THREE.Clock();

            this.road = new Road(this, options);
            this.leftCarLights = new CarLights(this, options, options.colors.leftCars, options.movingAwaySpeed, new THREE.Vector2(0, 1 - options.carLightsFade));
            this.rightCarLights = new CarLights(this, options, options.colors.rightCars, options.movingCloserSpeed, new THREE.Vector2(1, 0 + options.carLightsFade));
            this.leftSticks = new LightsSticks(this, options);

            this.fovTarget = options.fov;
            this.speedUpTarget = 0;
            this.speedUp = 0;
            this.timeOffset = 0;

            this.tick = this.tick.bind(this);
            this.init = this.init.bind(this);
            this.setSize = this.setSize.bind(this);
            this.onMouseDown = this.onMouseDown.bind(this);
            this.onMouseUp = this.onMouseUp.bind(this);
            this.onTouchStart = this.onTouchStart.bind(this);
            this.onTouchEnd = this.onTouchEnd.bind(this);

            this.onWindowResize = this.onWindowResize.bind(this);
            window.addEventListener('resize', this.onWindowResize);

            if (container.offsetWidth > 0 && container.offsetHeight > 0) this.hasValidSize = true;
            this.bindElement = document.body; // Use body since container has pointer-events: none
        }

        onWindowResize() {
            const width = this.container.offsetWidth, height = this.container.offsetHeight;
            if (width <= 0 || height <= 0) { this.hasValidSize = false; return; }
            this.renderer.setSize(width, height);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.composer.setSize(width, height);
            this.hasValidSize = true;
        }

        initPasses() {
            this.renderPass = new RenderPass(this.scene, this.camera);
            this.bloomPass = new EffectPass(this.camera, new BloomEffect({ luminanceThreshold: 0.2, luminanceSmoothing: 0, resolutionScale: 1 }));
            const smaaPass = new EffectPass(this.camera, new SMAAEffect({ preset: SMAAPreset.MEDIUM, searchImage: SMAAEffect.searchImageDataURL, areaImage: SMAAEffect.areaImageDataURL }));
            this.renderPass.renderToScreen = false;
            this.bloomPass.renderToScreen = false;
            smaaPass.renderToScreen = true;
            this.composer.addPass(this.renderPass);
            this.composer.addPass(this.bloomPass);
            this.composer.addPass(smaaPass);
        }

        loadAssets() {
            return new Promise(resolve => {
                const manager = new THREE.LoadingManager(resolve);
                const searchImage = new Image(), areaImage = new Image();
                searchImage.addEventListener('load', function () { manager.itemEnd('smaa-search'); });
                areaImage.addEventListener('load', function () { manager.itemEnd('smaa-area'); });
                manager.itemStart('smaa-search'); manager.itemStart('smaa-area');
                searchImage.src = SMAAEffect.searchImageDataURL; areaImage.src = SMAAEffect.areaImageDataURL;
            });
        }

        init() {
            this.initPasses();
            const options = this.options;
            this.road.init();
            this.leftCarLights.init();
            this.leftCarLights.mesh.position.setX(-options.roadWidth / 2 - options.islandWidth / 2);
            this.rightCarLights.init();
            this.rightCarLights.mesh.position.setX(options.roadWidth / 2 + options.islandWidth / 2);
            this.leftSticks.init();
            this.leftSticks.mesh.position.setX(-(options.roadWidth + options.islandWidth / 2));

            this.bindElement.addEventListener('mousedown', this.onMouseDown);
            this.bindElement.addEventListener('mouseup', this.onMouseUp);
            this.bindElement.addEventListener('mouseout', this.onMouseUp);
            this.bindElement.addEventListener('touchstart', this.onTouchStart, { passive: true });
            this.bindElement.addEventListener('touchend', this.onTouchEnd, { passive: true });
            this.bindElement.addEventListener('touchcancel', this.onTouchEnd, { passive: true });

            this.tick();
        }

        onMouseDown(ev) { if (this.options.onSpeedUp) this.options.onSpeedUp(ev); this.fovTarget = this.options.fovSpeedUp; this.speedUpTarget = this.options.speedUp; }
        onMouseUp(ev) { if (this.options.onSlowDown) this.options.onSlowDown(ev); this.fovTarget = this.options.fov; this.speedUpTarget = 0; }
        onTouchStart(ev) { if (this.options.onSpeedUp) this.options.onSpeedUp(ev); this.fovTarget = this.options.fovSpeedUp; this.speedUpTarget = this.options.speedUp; }
        onTouchEnd(ev) { if (this.options.onSlowDown) this.options.onSlowDown(ev); this.fovTarget = this.options.fov; this.speedUpTarget = 0; }

        update(delta) {
            let lerpPercentage = Math.exp(-(-60 * Math.log2(1 - 0.1)) * delta);
            this.speedUp += lerp(this.speedUp, this.speedUpTarget, lerpPercentage, 0.00001);
            this.timeOffset += this.speedUp * delta;
            let time = this.clock.elapsedTime + this.timeOffset;

            this.rightCarLights.update(time);
            this.leftCarLights.update(time);
            this.leftSticks.update(time);
            this.road.update(time);

            let updateCamera = false;
            let fovChange = lerp(this.camera.fov, this.fovTarget, lerpPercentage);
            if (fovChange !== 0) { this.camera.fov += fovChange * delta * 6; updateCamera = true; }

            if (this.options.distortion.getJS) {
                const distortion = this.options.distortion.getJS(0.025, time);
                this.camera.lookAt(new THREE.Vector3(this.camera.position.x + distortion.x, this.camera.position.y + distortion.y, this.camera.position.z + distortion.z));
                updateCamera = true;
            }
            if (updateCamera) this.camera.updateProjectionMatrix();
        }

        render(delta) { this.composer.render(delta); }
        setSize(width, height, updateStyles) {
            if (width <= 0 || height <= 0) { this.hasValidSize = false; return; }
            this.composer.setSize(width, height, updateStyles);
            this.hasValidSize = true;
        }

        tick() {
            if (!this.hasValidSize) {
                const w = this.container.offsetWidth, h = this.container.offsetHeight;
                if (w > 0 && h > 0) {
                    this.renderer.setSize(w, h, false);
                    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
                    this.composer.setSize(w, h); this.hasValidSize = true;
                } else { requestAnimationFrame(this.tick); return; }
            }
            if (resizeRendererToDisplaySize(this.renderer, this.setSize)) {
                if (this.hasValidSize) {
                    this.camera.aspect = this.renderer.domElement.clientWidth / this.renderer.domElement.clientHeight;
                    this.camera.updateProjectionMatrix();
                }
            }
            if (this.hasValidSize) { const delta = this.clock.getDelta(); this.render(delta); this.update(delta); }
            requestAnimationFrame(this.tick);
        }
    }

    // Hyperspeed config with integrated custom palette
    const options = {
        onSpeedUp: () => {},
        onSlowDown: () => {},
        distortion: distortions.turbulentDistortion,
        length: 400, roadWidth: 10, islandWidth: 2, lanesPerRoad: 4,
        fov: 90, fovSpeedUp: 150, speedUp: 2, carLightsFade: 0.4,
        totalSideLightSticks: 20, lightPairsPerRoadWay: 40,
        shoulderLinesWidthPercentage: 0.05, brokenLinesWidthPercentage: 0.1, brokenLinesLengthPercentage: 0.5,
        lightStickWidth: [0.12, 0.5], lightStickHeight: [1.3, 1.7],
        movingAwaySpeed: [60, 80], movingCloserSpeed: [-120, -160],
        carLightsLength: [400 * 0.03, 400 * 0.2], carLightsRadius: [0.05, 0.14],
        carWidthPercentage: [0.3, 0.5], carShiftX: [-0.8, 0.8], carFloorSeparation: [0, 5],
        colors: {
            roadColor: 0x454040,      // Match Base Theme
            islandColor: 0x3b3636,    // Darker Gray Island
            background: 0x454040,     // Dark Gray Fog
            shoulderLines: 0x605B51,  // Medium Gray Box Matches
            brokenLines: 0x605B51,    // Medium Gray Box Matches
            leftCars: [0xD8D365, 0xE6F082, 0xD8D365], // Mustard & Lime Lights
            rightCars: [0xE6F082, 0xD8D365, 0xE6F082], 
            sticks: 0xD8D365          // Mustard Sticks
        }
    };

    const app = new App(container, options);
    app.loadAssets().then(() => app.init());
}

// Execute application logic sequentially
initApp();
initThreeJS();
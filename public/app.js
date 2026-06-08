// Main Application logic for "Alisher Usta"
import { 
    loginWithGoogle, 
    logoutUser, 
    setupAuthListener, 
    syncDataToCloud, 
    fetchFromCloud, 
    getFirebaseStatus 
} from './firebase-config.js';

// Global state
let state = {
    apprentices: [],
    orders: [],
    jobs: [],
    apprenticeJobs: []
};

let currentUser = null;
let tempMaterials = []; // Temporary materials list for current order creation

// Helper function to format currency in Uzbek Som
function formatSom(value) {
    if (value === undefined || value === null || isNaN(value)) return "0 so'm";
    return new Intl.NumberFormat('uz-UZ', { style: 'decimal' }).format(Math.round(value)) + " so'm";
}

// Utility: Generate Unique ID
function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    loadLocalData();
    initTabNavigation();
    initCollapsibleForms();
    initApprenticeSection();
    initOrderSection();
    initJobsSection();
    initApprenticeJobsSection();
    initCalculator();
    initSettingsSection();
    
    // Auth Listener
    setupAuthListener(async (user) => {
        currentUser = user;
        if (user) {
            console.log("Logged in as:", user.displayName);
            // Fetch cloud data and merge/sync
            const cloudData = await fetchFromCloud(user.uid);
            if (cloudData) {
                // If cloud data is newer or has contents, merge
                mergeCloudData(cloudData);
            } else {
                // If cloud is empty but local has data, sync local to cloud
                await syncState();
            }
        } else {
            console.log("Running in offline mode");
        }
        renderAll();
    });
});

// Load data from LocalStorage
function loadLocalData() {
    const savedData = localStorage.getItem('alisher_usta_state');
    if (savedData) {
        try {
            state = JSON.parse(savedData);
            // Ensure all properties exist
            if (!state.apprentices) state.apprentices = [];
            if (!state.orders) state.orders = [];
            if (!state.jobs) state.jobs = [];
            if (!state.apprenticeJobs) state.apprenticeJobs = [];
        } catch (e) {
            console.error("Local data parsing error:", e);
        }
    }
}

// Save data locally and sync with cloud if online
async function syncState() {
    localStorage.setItem('alisher_usta_state', JSON.stringify(state));
    if (currentUser) {
        const syncBadge = document.getElementById('sync-badge');
        if (syncBadge) {
            syncBadge.textContent = "Sinxronlanmoqda...";
            syncBadge.className = "badge badge-online";
        }
        const success = await syncDataToCloud(currentUser.uid, state);
        if (syncBadge) {
            if (success) {
                syncBadge.textContent = "Bulutda Saqlangan";
                syncBadge.className = "badge badge-online";
            } else {
                syncBadge.textContent = "Sinxronlashda xato";
                syncBadge.className = "badge badge-offline";
            }
        }
    }
}

// Merge cloud data with local data
function mergeCloudData(cloudData) {
    // Basic merge strategy: overwrite local with cloud data (since cloud is the source of truth)
    // In future versions, we could merge by timestamps.
    if (cloudData) {
        state = cloudData;
        localStorage.setItem('alisher_usta_state', JSON.stringify(state));
        renderAll();
    }
}

// Navigation Tabs
function initTabNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    window.switchTab = function(tabId) {
        tabContents.forEach(tab => {
            tab.classList.remove('active');
        });
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-tab') === tabId) {
                item.classList.add('active');
            }
        });
        
        const activeTab = document.getElementById(tabId);
        if (activeTab) {
            activeTab.classList.add('active');
            // Scroll tab content to top
            document.querySelector('.app-main').scrollTop = 0;
        }
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Profile button in header switches to settings tab
    const profileBtn = document.getElementById('header-profile-btn');
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            switchTab('tab-settings');
        });
    }
}

// Collapsible Forms Helper
function initCollapsibleForms() {
    const toggleBtns = document.querySelectorAll('.toggle-form-btn, .toggle-header');
    
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                targetEl.classList.toggle('collapsed');
                btn.classList.toggle('collapsed');
            }
        });
    });

    // Handle cancel button
    const cancelBtns = document.querySelectorAll('.cancel-form-btn');
    cancelBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                targetEl.classList.add('collapsed');
            }
            // Reset toggle button state if possible
            const toggleBtn = document.querySelector(`.toggle-form-btn[data-target="${targetId}"]`);
            if (toggleBtn) {
                toggleBtn.classList.remove('collapsed');
            }
        });
    });
}

// Rendering lists functions
function renderAll() {
    renderDashboard();
    renderApprentices();
    renderOrders();
    renderJobs();
    renderApprenticeJobs();
    updateApprenticeDropdown();
}

// 1. Dashboard Tab Rendering
function renderDashboard() {
    // Counts
    document.getElementById('stat-orders-count').textContent = `${state.orders.length} ta`;
    document.getElementById('stat-apprentices-count').textContent = `${state.apprentices.length} ta`;
    document.getElementById('stat-jobs-count').textContent = `${state.jobs.length + state.apprenticeJobs.length} ta`;

    // Recent orders
    const container = document.getElementById('dashboard-recent-orders');
    if (state.orders.length === 0) {
        container.innerHTML = '<p class="empty-state">Hozircha zakazlar yo\'q. Yangi zakaz qo\'shing.</p>';
        return;
    }

    // Sort by date descending and take top 3
    const recent = [...state.orders]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3);

    let html = '';
    recent.forEach(order => {
        html += `
            <div class="card recent-item-card" onclick="switchTab('tab-orders')">
                <div class="card-header-row" style="margin-bottom: 5px;">
                    <h3 style="font-size: 16px;">${order.name}</h3>
                    <span style="font-size: 12px; color: var(--accent-color); font-weight: bold;">
                        ${formatSom(order.grandTotal)}
                    </span>
                </div>
                <div style="font-size: 11px; color: var(--text-muted);">
                    Maydoni: ${order.area || 0} kv.m | Sana: ${new Date(order.date).toLocaleDateString('uz-UZ')}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// 2. Apprentices Tab Rendering
function initApprenticeSection() {
    const form = document.getElementById('apprentice-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('appr-name').value.trim();
        const level = document.getElementById('appr-level').value;
        const work = document.getElementById('appr-work').value.trim();
        const amount = document.getElementById('appr-amount').value.trim();
        const paymentInput = document.getElementById('appr-payment').value;
        const payment = paymentInput ? parseFloat(paymentInput) : 0;

        const newApprentice = {
            id: generateId(),
            name,
            level: level || '', // Optional
            work: work || '',   // Optional
            amount: amount || '', // Optional
            payment,            // Optional (defaults to 0)
            date: new Date().toISOString()
        };

        state.apprentices.push(newApprentice);
        await syncState();
        
        form.reset();
        document.getElementById('apprentice-form-container').classList.add('collapsed');
        renderAll();
    });
}

function renderApprentices() {
    const container = document.getElementById('apprentices-list');
    if (state.apprentices.length === 0) {
        container.innerHTML = '<p class="empty-state">Hech qanday shogird qo\'shilmagan.</p>';
        return;
    }

    let html = '';
    state.apprentices.forEach(appr => {
        let levelBadge = '';
        if (appr.level) {
            let className = '';
            if (appr.level === 'Usta') className = 'level-usta';
            else if (appr.level === "O'rta") className = 'level-orta';
            levelBadge = `<span class="card-badge ${className}">${appr.level}</span>`;
        }

        html += `
            <div class="card" id="appr-card-${appr.id}">
                <div class="card-header-row">
                    <h3>${appr.name}</h3>
                    ${levelBadge}
                </div>
                <div class="card-details">
                    ${appr.work ? `
                    <div class="detail-item">
                        <span class="detail-label">Hozirgi ish:</span>
                        <span class="detail-value">${appr.work}</span>
                    </div>` : ''}
                    ${appr.amount ? `
                    <div class="detail-item">
                        <span class="detail-label">Ish hajmi:</span>
                        <span class="detail-value">${appr.amount}</span>
                    </div>` : ''}
                    <div class="detail-item">
                        <span class="detail-label">Bitgach beriladigan haq:</span>
                        <span class="detail-value" style="color: var(--accent-color);">${formatSom(appr.payment)}</span>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="icon-only-btn" onclick="deleteApprentice('${appr.id}')" title="O'chirish">
                        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
                    </button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

window.deleteApprentice = async function(id) {
    if (confirm("Ushbu shogirdni o'chirmoqchimisiz?")) {
        state.apprentices = state.apprentices.filter(appr => appr.id !== id);
        // Also remove apprentice jobs associated with him if needed, or keep them. Let's keep them but show name text.
        await syncState();
        renderAll();
    }
};

// 3. Orders Tab Calculator Logic
function initOrderSection() {
    const addMatBtn = document.getElementById('add-material-btn');
    const saveOrderBtn = document.getElementById('save-order-btn');
    const clearOrderBtn = document.getElementById('clear-order-btn');
    
    // Width, Height, Service Rate listener for real-time calculation
    const dimensions = ['order-width', 'order-height', 'order-service-rate'];
    dimensions.forEach(id => {
        document.getElementById(id).addEventListener('input', runOrderCalculations);
    });

    // Add Material to Temp List
    addMatBtn.addEventListener('click', () => {
        const type = document.getElementById('mat-type').value.trim();
        const size = document.getElementById('mat-size').value.trim();
        const lengthVal = document.getElementById('mat-length').value;
        const priceVal = document.getElementById('mat-price').value;

        // Skip is possible, but we need at least type/size and length + price for calculation
        // Or if empty length/price we default to 0
        const length = lengthVal ? parseFloat(lengthVal) : 0;
        const price = priceVal ? parseFloat(priceVal) : 0;
        
        if (!type && !size && length === 0) {
            alert("Iltimos, kamida material nomi yoki o'lchamini kiritib qo'shing!");
            return;
        }

        const total = length * price;
        const material = {
            id: generateId(),
            type: type || 'Material',
            size: size || '-',
            length,
            price,
            total
        };

        tempMaterials.push(material);
        renderTempMaterialsTable();
        
        // Reset material input fields
        document.getElementById('mat-type').value = '';
        document.getElementById('mat-size').value = '';
        document.getElementById('mat-length').value = '';
        document.getElementById('mat-price').value = '';
        
        runOrderCalculations();
    });

    // Save Order
    saveOrderBtn.addEventListener('click', async () => {
        const name = document.getElementById('order-name').value.trim();
        if (!name) {
            alert("Iltimos, zakaz nomini kiriting!");
            return;
        }

        const width = parseFloat(document.getElementById('order-width').value) || 0;
        const height = parseFloat(document.getElementById('order-height').value) || 0;
        const serviceRate = parseFloat(document.getElementById('order-service-rate').value) || 0;
        
        const materialsTotal = tempMaterials.reduce((sum, mat) => sum + mat.total, 0);
        const area = width * height;
        const serviceTotal = area * serviceRate;
        const grandTotal = materialsTotal + serviceTotal;

        const newOrder = {
            id: generateId(),
            name,
            materials: [...tempMaterials],
            width,
            height,
            serviceRate,
            materialsTotal,
            area,
            serviceTotal,
            grandTotal,
            date: new Date().toISOString()
        };

        state.orders.push(newOrder);
        await syncState();

        // Clear wizard state
        resetOrderWizard();
        renderAll();
        alert("Zakaz muvaffaqiyatli saqlandi va arxivlandi!");
    });

    // Clear Button
    clearOrderBtn.addEventListener('click', () => {
        if (confirm("Kiritilgan ma'lumotlarni o'chirib tozalaymizmi?")) {
            resetOrderWizard();
        }
    });
}

function resetOrderWizard() {
    document.getElementById('order-name').value = '';
    document.getElementById('mat-type').value = '';
    document.getElementById('mat-size').value = '';
    document.getElementById('mat-length').value = '';
    document.getElementById('mat-price').value = '';
    
    document.getElementById('order-width').value = '';
    document.getElementById('order-height').value = '';
    document.getElementById('order-service-rate').value = '';
    
    tempMaterials = [];
    renderTempMaterialsTable();
    runOrderCalculations();
}

function renderTempMaterialsTable() {
    const tableBody = document.querySelector('#temp-materials-table tbody');
    if (tempMaterials.length === 0) {
        tableBody.innerHTML = `
            <tr class="empty-table-row">
                <td colspan="6" style="text-align: center;">Hozircha materiallar qo'shilmadi. Yuqoridan yozib qo'shing.</td>
            </tr>
        `;
        return;
    }

    let html = '';
    tempMaterials.forEach((mat, index) => {
        html += `
            <tr>
                <td><strong>${mat.type}</strong></td>
                <td>${mat.size}</td>
                <td>${mat.length} m</td>
                <td>${formatSom(mat.price)}</td>
                <td><strong>${formatSom(mat.total)}</strong></td>
                <td>
                    <button class="icon-only-btn" onclick="removeTempMaterial(${index})" title="O'chirish">
                        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
                    </button>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;
}

window.removeTempMaterial = function(index) {
    tempMaterials.splice(index, 1);
    renderTempMaterialsTable();
    runOrderCalculations();
};

function runOrderCalculations() {
    const materialsTotal = tempMaterials.reduce((sum, mat) => sum + mat.total, 0);
    
    const width = parseFloat(document.getElementById('order-width').value) || 0;
    const height = parseFloat(document.getElementById('order-height').value) || 0;
    const serviceRate = parseFloat(document.getElementById('order-service-rate').value) || 0;

    const area = width * height;
    const serviceTotal = area * serviceRate;
    const grandTotal = materialsTotal + serviceTotal;

    // Update summary interface elements
    document.getElementById('calc-materials-total').textContent = formatSom(materialsTotal);
    document.getElementById('calc-area').textContent = `${area.toFixed(2)} kv.m`;
    document.getElementById('calc-service-total').textContent = formatSom(serviceTotal);
    document.getElementById('calc-grand-total').textContent = formatSom(grandTotal);
}

function renderOrders() {
    const container = document.getElementById('orders-list-archive');
    if (state.orders.length === 0) {
        container.innerHTML = '<p class="empty-state">Saqlangan zakazlar mavjud emas.</p>';
        return;
    }

    // Sort by date descending
    const sortedOrders = [...state.orders].sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = '';
    sortedOrders.forEach(order => {
        let materialsHtml = '';
        if (order.materials && order.materials.length > 0) {
            materialsHtml = `
                <div class="toggle-header" data-target="materials-collapse-${order.id}" style="margin: 10px 0; font-size: 13px; color: var(--primary-color);">
                    <span>Materiallar ro'yxatini ko'rish (${order.materials.length} turda)</span>
                    <span class="chevron">▼</span>
                </div>
                <div id="materials-collapse-${order.id}" class="collapsible collapsed table-container" style="margin-top: 5px;">
                    <table class="materials-table" style="min-width: 100%; font-size: 11px;">
                        <thead>
                            <tr>
                                <th>Material</th>
                                <th>Razmer</th>
                                <th>Metr</th>
                                <th>Jami</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${order.materials.map(m => `
                                <tr>
                                    <td>${m.type}</td>
                                    <td>${m.size}</td>
                                    <td>${m.length} m</td>
                                    <td>${formatSom(m.total)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        html += `
            <div class="card" id="order-card-${order.id}">
                <div class="card-header-row">
                    <h3>${order.name}</h3>
                    <span style="font-size: 11px; color: var(--text-muted);">${new Date(order.date).toLocaleDateString('uz-UZ')}</span>
                </div>
                <div class="card-details">
                    <div class="detail-item">
                        <span class="detail-label">O'lchamlari (Eni x Bo'yi):</span>
                        <span class="detail-value">${order.width || 0} m x ${order.height || 0} m (${(order.area || 0).toFixed(2)} kv.m)</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Materiallar jami:</span>
                        <span class="detail-value">${formatSom(order.materialsTotal)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Xizmat haqi (${formatSom(order.serviceRate)} / kv.m):</span>
                        <span class="detail-value">${formatSom(order.serviceTotal)}</span>
                    </div>
                    <div class="detail-item" style="border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 8px; margin-top: 4px;">
                        <span class="detail-label"><strong>Mijozga jami narx:</strong></span>
                        <span class="detail-value" style="color: var(--accent-color); font-weight: bold; font-size: 15px;">${formatSom(order.grandTotal)}</span>
                    </div>
                </div>
                ${materialsHtml}
                <div class="card-actions">
                    <button class="icon-only-btn" onclick="deleteOrder('${order.id}')" title="O'chirish">
                        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Re-bind click event to the newly generated collapses
    setTimeout(() => {
        initCollapsibleForms();
    }, 100);
}

window.deleteOrder = async function(id) {
    if (confirm("Ushbu zakazni tarixdan o'chirmoqchimisiz?")) {
        state.orders = state.orders.filter(order => order.id !== id);
        await syncState();
        renderAll();
    }
};

// 4. Bajarilgan Ishlar (Jobs Log) Section Logic
function initJobsSection() {
    const form = document.getElementById('job-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('job-title').value.trim();
        const size = document.getElementById('job-size').value.trim();
        const materials = document.getElementById('job-materials').value.trim();
        const matCostVal = document.getElementById('job-mat-cost').value;
        const servicePriceVal = document.getElementById('job-service-price').value;
        
        const matCost = matCostVal ? parseFloat(matCostVal) : 0;
        const servicePrice = servicePriceVal ? parseFloat(servicePriceVal) : 0;
        const total = matCost + servicePrice;

        const newJob = {
            id: generateId(),
            title,
            size: size || '',
            materials: materials || '',
            matCost,
            servicePrice,
            total,
            date: new Date().toISOString()
        };

        state.jobs.push(newJob);
        await syncState();

        form.reset();
        document.getElementById('job-form-container').classList.add('collapsed');
        document.querySelector('.toggle-form-btn[data-target="job-form-container"]').classList.remove('collapsed');
        renderAll();
    });
}

function renderJobs() {
    const container = document.getElementById('jobs-list');
    if (state.jobs.length === 0) {
        container.innerHTML = '<p class="empty-state">Hozircha bajarilgan ishlar kiritilmagan.</p>';
        return;
    }

    const sortedJobs = [...state.jobs].sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = '';
    sortedJobs.forEach(job => {
        html += `
            <div class="card" id="job-card-${job.id}">
                <div class="card-header-row">
                    <h3>${job.title}</h3>
                    <span style="font-size: 11px; color: var(--text-muted);">${new Date(job.date).toLocaleDateString('uz-UZ')}</span>
                </div>
                <div class="card-details">
                    ${job.size ? `
                    <div class="detail-item">
                        <span class="detail-label">Ish maydoni / hajmi:</span>
                        <span class="detail-value">${job.size}</span>
                    </div>` : ''}
                    ${job.materials ? `
                    <div class="detail-item">
                        <span class="detail-label">Ishlatilgan materiallar:</span>
                        <span class="detail-value">${job.materials}</span>
                    </div>` : ''}
                    <div class="detail-item">
                        <span class="detail-label">Material jami narxi:</span>
                        <span class="detail-value">${formatSom(job.matCost)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Xizmat haqi:</span>
                        <span class="detail-value">${formatSom(job.servicePrice)}</span>
                    </div>
                    <div class="detail-item" style="border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 8px; margin-top: 4px;">
                        <span class="detail-label"><strong>Jami qiymat:</strong></span>
                        <span class="detail-value" style="color: var(--accent-color); font-weight: bold;">${formatSom(job.total)}</span>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="icon-only-btn" onclick="deleteJob('${job.id}')" title="O'chirish">
                        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
                    </button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

window.deleteJob = async function(id) {
    if (confirm("Ushbu ishni arxivdan o'chirmoqchimisiz?")) {
        state.jobs = state.jobs.filter(job => job.id !== id);
        await syncState();
        renderAll();
    }
};

// 5. Apprentice Jobs (Shogirdlar ishi) Section
function initApprenticeJobsSection() {
    const form = document.getElementById('appr-job-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const apprenticeId = document.getElementById('appr-select').value;
        const title = document.getElementById('appr-job-title').value.trim();
        const dimensions = document.getElementById('appr-job-dimensions').value.trim();
        const materials = document.getElementById('appr-job-materials').value.trim();
        const matCostVal = document.getElementById('appr-job-mat-cost').value;
        
        // Painting
        const paintColor = document.getElementById('paint-color').value.trim();
        const paintCostVal = document.getElementById('paint-cost').value;
        const paintServiceCostVal = document.getElementById('paint-service-cost').value;

        const apprentice = state.apprentices.find(a => a.id === apprenticeId);
        const apprenticeName = apprentice ? apprentice.name : "Noma'lum Shogird";

        const matCost = matCostVal ? parseFloat(matCostVal) : 0;
        const paintCost = paintCostVal ? parseFloat(paintCostVal) : 0;
        const paintServiceCost = paintServiceCostVal ? parseFloat(paintServiceCostVal) : 0;

        const materialsTotal = matCost;
        const paintTotal = paintCost;
        const serviceTotal = paintServiceCost;
        const grandTotal = materialsTotal + paintTotal + serviceTotal;

        const newApprJob = {
            id: generateId(),
            apprenticeId,
            apprenticeName,
            title,
            dimensions: dimensions || '',
            materials: materials || '',
            matCost,
            paintColor: paintColor || '',
            paintCost,
            paintServiceCost,
            materialsTotal,
            paintTotal,
            serviceTotal,
            grandTotal,
            date: new Date().toISOString()
        };

        state.apprenticeJobs.push(newApprJob);
        await syncState();

        form.reset();
        document.getElementById('appr-job-form-container').classList.add('collapsed');
        document.querySelector('.toggle-form-btn[data-target="appr-job-form-container"]').classList.remove('collapsed');
        renderAll();
    });
}

function updateApprenticeDropdown() {
    const select = document.getElementById('appr-select');
    if (!select) return;
    
    // Clear all except first
    select.innerHTML = '<option value="">Tanlang...</option>';
    
    state.apprentices.forEach(appr => {
        const opt = document.createElement('option');
        opt.value = appr.id;
        opt.textContent = appr.name;
        select.appendChild(opt);
    });
}

function renderApprenticeJobs() {
    const container = document.getElementById('appr-jobs-list');
    if (state.apprenticeJobs.length === 0) {
        container.innerHTML = '<p class="empty-state">Shogirdlar bajargan ishlar hali kiritilmagan.</p>';
        return;
    }

    const sorted = [...state.apprenticeJobs].sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = '';
    sorted.forEach(job => {
        let paintSectionHtml = '';
        if (job.paintColor || job.paintCost > 0 || job.paintServiceCost > 0) {
            paintSectionHtml = `
                <div class="sub-section-title" style="margin-top: 10px; font-size: 11px;">Bo'yoq (Kraska) ishlari</div>
                <div class="detail-item" style="font-size: 12px; padding-left: 10px; border-left: 1px solid var(--spark-color);">
                    <span class="detail-label">Rangi / Narxi:</span>
                    <span class="detail-value">${job.paintColor || '-'} (${formatSom(job.paintCost)})</span>
                </div>
                <div class="detail-item" style="font-size: 12px; padding-left: 10px; border-left: 1px solid var(--spark-color);">
                    <span class="detail-label">Kraska sepish xizmati:</span>
                    <span class="detail-value">${formatSom(job.paintServiceCost)}</span>
                </div>
            `;
        }

        html += `
            <div class="card" id="appr-job-card-${job.id}" style="border-left-color: var(--spark-color);">
                <div class="card-header-row">
                    <div>
                        <span class="card-badge level-orta" style="margin-bottom: 5px; display: inline-block;">${job.apprenticeName}</span>
                        <h3>${job.title}</h3>
                    </div>
                    <span style="font-size: 11px; color: var(--text-muted);">${new Date(job.date).toLocaleDateString('uz-UZ')}</span>
                </div>
                <div class="card-details">
                    ${job.dimensions ? `
                    <div class="detail-item">
                        <span class="detail-label">O'lchamlari (Eni x Bo'yi):</span>
                        <span class="detail-value">${job.dimensions} m</span>
                    </div>` : ''}
                    ${job.materials ? `
                    <div class="detail-item">
                        <span class="detail-label">Ishlatilgan material:</span>
                        <span class="detail-value">${job.materials}</span>
                    </div>` : ''}
                    <div class="detail-item">
                        <span class="detail-label">Material jami qiymati:</span>
                        <span class="detail-value">${formatSom(job.matCost)}</span>
                    </div>
                    ${paintSectionHtml}
                    <div class="detail-item" style="border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 8px; margin-top: 4px;">
                        <span class="detail-label"><strong>Jami Ish qiymati:</strong></span>
                        <span class="detail-value" style="color: var(--spark-color); font-weight: bold;">${formatSom(job.grandTotal)}</span>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="icon-only-btn" onclick="deleteApprenticeJob('${job.id}')" title="O'chirish">
                        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
                    </button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

window.deleteApprenticeJob = async function(id) {
    if (confirm("Shogird bajargan ushbu ishni o'chirmoqchimisiz?")) {
        state.apprenticeJobs = state.apprenticeJobs.filter(job => job.id !== id);
        await syncState();
        renderAll();
    }
};

// 6. Built-in Calculator Logic
function initCalculator() {
    const keys = document.querySelector('.calc-keys');
    const screen = document.getElementById('calc-screen');
    const history = document.getElementById('calc-history');
    
    let currentInput = "0";
    let pendingExpression = "";
    
    keys.addEventListener('click', (e) => {
        const btn = e.target;
        if (!btn.classList.contains('calc-btn')) return;
        
        const value = btn.getAttribute('value');
        
        if (btn.classList.contains('number')) {
            if (currentInput === "0" && value !== ".") {
                currentInput = value;
            } else {
                // Avoid multiple decimal points in one number
                if (value === "." && currentInput.includes(".")) return;
                currentInput += value;
            }
            screen.textContent = currentInput;
        } else if (btn.classList.contains('operator')) {
            if (value === "clear") {
                currentInput = "0";
                pendingExpression = "";
                screen.textContent = currentInput;
                history.textContent = "";
            } else if (value === "backspace") {
                if (currentInput.length > 1) {
                    currentInput = currentInput.slice(0, -1);
                } else {
                    currentInput = "0";
                }
                screen.textContent = currentInput;
            } else if (value === "=") {
                if (pendingExpression !== "") {
                    // Safe mathematical evaluation
                    let finalExpr = pendingExpression + currentInput;
                    try {
                        // Replace multiply/divide symbols to code equivalents
                        let codeExpr = finalExpr.replace(/×/g, '*').replace(/÷/g, '/');
                        // Evaluate securely
                        let result = Function(`"use strict"; return (${codeExpr})`)();
                        // Format result nicely
                        if (result % 1 !== 0) {
                            result = parseFloat(result.toFixed(4));
                        }
                        history.textContent = finalExpr + " =";
                        currentInput = String(result);
                        screen.textContent = currentInput;
                        pendingExpression = "";
                    } catch (err) {
                        screen.textContent = "Xatolik";
                        currentInput = "0";
                        pendingExpression = "";
                    }
                }
            } else {
                // Arithmetic operators: +, -, *, /
                let displayOp = btn.textContent;
                pendingExpression += currentInput + " " + displayOp + " ";
                history.textContent = pendingExpression;
                currentInput = "0";
                screen.textContent = currentInput;
            }
        }
    });
}

// 7. Settings & Backup Sync
function initSettingsSection() {
    const loginBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('google-logout-btn');
    const exportBtn = document.getElementById('export-data-btn');
    const importInput = document.getElementById('import-file-input');
    const clearAllBtn = document.getElementById('clear-all-data-btn');
    
    // Firebase Config Form
    const fbForm = document.getElementById('firebase-config-form');
    const resetFbBtn = document.getElementById('reset-fb-config-btn');
    
    // Load config state to settings inputs
    const fbStatus = getFirebaseStatus();
    if (fbStatus.config) {
        document.getElementById('fb-apiKey').value = fbStatus.isPlaceholder ? '' : fbStatus.config.apiKey;
        document.getElementById('fb-authDomain').value = fbStatus.isPlaceholder ? '' : fbStatus.config.authDomain;
        document.getElementById('fb-projectId').value = fbStatus.isPlaceholder ? '' : fbStatus.config.projectId;
        document.getElementById('fb-storageBucket').value = fbStatus.isPlaceholder ? '' : fbStatus.config.storageBucket;
        document.getElementById('fb-messagingSenderId').value = fbStatus.isPlaceholder ? '' : fbStatus.config.messagingSenderId;
        document.getElementById('fb-appId').value = fbStatus.isPlaceholder ? '' : fbStatus.config.appId;
    }

    // Google login triggering
    loginBtn.addEventListener('click', async () => {
        await loginWithGoogle();
    });

    // Google logout triggering
    logoutBtn.addEventListener('click', async () => {
        if (confirm("Hisobdan chiqishni xohlaysizmi? Oflayn kiritilgan ma'lumotlaringiz qurilmada qoladi.")) {
            await logoutUser();
        }
    });

    // Export Data (JSON)
    exportBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `alisher_usta_zaxira_${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    });

    // Import Data (JSON)
    importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedState = JSON.parse(event.target.result);
                if (importedState.apprentices || importedState.orders || importedState.jobs || importedState.apprenticeJobs) {
                    state = {
                        apprentices: importedState.apprentices || [],
                        orders: importedState.orders || [],
                        jobs: importedState.jobs || [],
                        apprenticeJobs: importedState.apprenticeJobs || []
                    };
                    await syncState();
                    renderAll();
                    alert("Zaxira ma'lumotlari muvaffaqiyatli tiklandi!");
                } else {
                    alert("Fayl formati mos kelmadi yoki ma'lumot topilmadi.");
                }
            } catch (err) {
                alert("Faylni o'qishda xatolik yuz berdi: " + err.message);
            }
        };
        reader.readAsText(file);
    });

    // Clear all data (Reset)
    clearAllBtn.addEventListener('click', async () => {
        if (confirm("DIQQAT! Barcha kiritilgan ma'lumotlar o'chib ketadi! Buni tasdiqlaysizmi?")) {
            if (confirm("Haqiqatan ham barcha ma'lumotlarni o'chirishni xohlaysizmi? Bu amalni orqaga qaytarib bo'lmaydi.")) {
                state = {
                    apprentices: [],
                    orders: [],
                    jobs: [],
                    apprenticeJobs: []
                };
                await syncState();
                renderAll();
                alert("Barcha ma'lumotlar o'chirildi.");
            }
        }
    });

    // Save custom Firebase config
    fbForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const apiKey = document.getElementById('fb-apiKey').value.trim();
        const authDomain = document.getElementById('fb-authDomain').value.trim();
        const projectId = document.getElementById('fb-projectId').value.trim();
        const storageBucket = document.getElementById('fb-storageBucket').value.trim();
        const messagingSenderId = document.getElementById('fb-messagingSenderId').value.trim();
        const appId = document.getElementById('fb-appId').value.trim();

        if (!apiKey || !projectId) {
            alert("API Key va Project ID maydonlari to'ldirilishi shart!");
            return;
        }

        const customConfig = {
            apiKey,
            authDomain,
            projectId,
            storageBucket,
            messagingSenderId,
            appId
        };

        localStorage.setItem('alisher_usta_firebase_config', JSON.stringify(customConfig));
        alert("Firebase sozlamalari saqlandi! Yangi tizimni ishga tushirish uchun ilova qayta yuklanadi.");
        window.location.reload();
    });

    // Reset Firebase Config to default
    resetFbBtn.addEventListener('click', () => {
        if (confirm("Firebase sozlamalarini standart (bepul beka-bulut) holatga qaytaramizmi?")) {
            localStorage.removeItem('alisher_usta_firebase_config');
            alert("Firebase sozlamalari o'chirildi. Ilova qayta yuklanadi.");
            window.location.reload();
        }
    });
}

// Register Service Worker for PWA (offline support)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then((reg) => console.log('Service Worker registered successfully!', reg.scope))
            .catch((err) => console.error('Service Worker registration failed:', err));
    });
}


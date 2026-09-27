/**
 * Shopping Tab Module
 * Helps prepare weekly shopping lists by selecting/including meal plans,
 * aggregating all food items with their total weights and costs.
 */

window.TableModule = window.TableModule || {};

window.TableModule.Shopping = (function () {
    const STORAGE_KEY_SHOPPING = 'mealPlannerShoppingState';

    // Internal Shopping State
    const state = {
        // Array of planKey strings representing included meal plans
        includedPlans: [],
        // Custom weight overrides by foodId: { [foodId]: number }
        weightOverrides: {},
        // Custom cost values by foodId: { [foodId]: number }
        costOverrides: {},
        // Excluded foodIds (removed manually from current shopping list)
        excludedFoods: {},
        // Current sort state for shopping table
        sortKey: 'weight',
        sortDir: 'desc',
        // Inline editing state: { foodId: string, field: 'weight' | 'cost' } | null
        editing: null
    };

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_SHOPPING);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed.includedPlans)) {
                    state.includedPlans = parsed.includedPlans
                        .map(p => (typeof p === 'string' ? p : p && p.planKey))
                        .filter(Boolean);
                }
                if (parsed.weightOverrides && typeof parsed.weightOverrides === 'object') state.weightOverrides = parsed.weightOverrides;
                if (parsed.costOverrides && typeof parsed.costOverrides === 'object') state.costOverrides = parsed.costOverrides;
                if (parsed.excludedFoods && typeof parsed.excludedFoods === 'object') state.excludedFoods = parsed.excludedFoods;
            }
        } catch (e) {
            console.error('Failed to load shopping state:', e);
        }
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY_SHOPPING, JSON.stringify({
                includedPlans: state.includedPlans,
                weightOverrides: state.weightOverrides,
                costOverrides: state.costOverrides,
                excludedFoods: state.excludedFoods
            }));
        } catch (e) {
            console.error('Failed to save shopping state:', e);
        }
    }

    // Retrieve foods array for a given planKey ('__current__' or saved plan name)
    function getFoodsForPlan(planKey) {
        const { DataStore } = window.TableModule;
        if (!DataStore) return [];

        if (planKey === '__current__') {
            const prevKey = DataStore.getSelectedPlanKey();
            DataStore.setSelectedPlanKey('__current__');
            const items = DataStore.getTableFoods();
            DataStore.setSelectedPlanKey(prevKey);
            return items || [];
        }

        const savedPlans = DataStore.getSavedPlans() || [];
        const plan = savedPlans.find(p => p.name === planKey);
        if (!plan) return [];

        if (Array.isArray(plan.tableFoods) && plan.tableFoods.length > 0) {
            return plan.tableFoods;
        }

        const list = [];
        if (plan.meals) {
            ['meal1', 'meal2', 'meal3'].forEach(k => {
                (plan.meals[k] || []).forEach(item => {
                    list.push({
                        foodId: item.foodId,
                        weight: item.weight
                    });
                });
            });
        }
        return list;
    }

    // Get all available plans from DataStore
    function getAllAvailablePlans() {
        const { DataStore } = window.TableModule;
        if (!DataStore) return [];

        const savedPlans = DataStore.getSavedPlans() || [];
        const plans = [];

        savedPlans.forEach(p => {
            const foods = getFoodsForPlan(p.name);
            plans.push({
                key: p.name,
                name: p.name,
                foodCount: foods.length
            });
        });

        // Also offer Current Active Plan if it has items and isn't empty
        const currentFoods = getFoodsForPlan('__current__');
        if (currentFoods.length > 0) {
            plans.unshift({
                key: '__current__',
                name: 'Current Active Plan',
                foodCount: currentFoods.length
            });
        }

        return plans;
    }

    // Include a meal plan
    function includePlan(planKey) {
        if (!planKey) return;
        if (!state.includedPlans.includes(planKey)) {
            state.includedPlans.push(planKey);
        }
        state.excludedFoods = {};
        state.weightOverrides = {};
        saveState();
        render();
    }

    // Remove a plan from included list
    function removeIncludedPlan(planKey) {
        state.includedPlans = state.includedPlans.filter(k => k !== planKey);
        state.excludedFoods = {};
        state.weightOverrides = {};
        saveState();
        render();
    }

    // Toggle plan inclusion
    function togglePlan(planKey) {
        if (state.includedPlans.includes(planKey)) {
            removeIncludedPlan(planKey);
        } else {
            includePlan(planKey);
        }
    }

    // Include all available saved plans
    function includeAllPlans() {
        const available = getAllAvailablePlans().filter(p => p.key !== '__current__');
        const targetPlans = available.length > 0 ? available : getAllAvailablePlans();

        targetPlans.forEach(p => {
            if (!state.includedPlans.includes(p.key)) {
                state.includedPlans.push(p.key);
            }
        });
        state.excludedFoods = {};
        state.weightOverrides = {};
        saveState();
        render();
    }

    // Clear all included plans and overrides
    function clearShoppingList() {
        state.includedPlans = [];
        state.weightOverrides = {};
        state.excludedFoods = {};
        state.editing = null;
        saveState();
        render();
    }

    // Aggregate food items across all included meal plans
    function getAggregatedShoppingItems() {
        const { DataStore } = window.TableModule;
        const aggregatedMap = new Map();

        // Filter out any plans that no longer exist
        const validAvailableKeys = new Set(getAllAvailablePlans().map(p => p.key));
        state.includedPlans = state.includedPlans.filter(key => validAvailableKeys.has(key));

        state.includedPlans.forEach(planKey => {
            const planFoods = getFoodsForPlan(planKey);

            planFoods.forEach(item => {
                if (!item || !item.foodId) return;
                if (state.excludedFoods[item.foodId]) return;

                const w = DataStore.safeNum(item.weight, 0);
                if (aggregatedMap.has(item.foodId)) {
                    const current = aggregatedMap.get(item.foodId);
                    current.calculatedWeight += w;
                } else {
                    const foodObj = DataStore.getFoodById(item.foodId);
                    const unitPrice = foodObj
                        ? (foodObj.price !== undefined ? DataStore.safeNum(foodObj.price, 0) : DataStore.safeNum(foodObj.cost, 0))
                        : 0;
                    aggregatedMap.set(item.foodId, {
                        foodId: item.foodId,
                        name: foodObj ? foodObj.name : item.foodId,
                        calculatedWeight: w,
                        unitCostPer100g: unitPrice
                    });
                }
            });
        });

        const rows = [];
        aggregatedMap.forEach(entry => {
            const finalWeight = state.weightOverrides[entry.foodId] !== undefined
                ? DataStore.safeNum(state.weightOverrides[entry.foodId], entry.calculatedWeight)
                : entry.calculatedWeight;

            // Default cost is 0 unless specified in food.cost or overridden by user
            const defaultCost = entry.unitCostPer100g > 0
                ? (entry.unitCostPer100g * (finalWeight / 100))
                : 0;

            const finalCost = state.costOverrides[entry.foodId] !== undefined
                ? DataStore.safeNum(state.costOverrides[entry.foodId], 0)
                : defaultCost;

            rows.push({
                foodId: entry.foodId,
                name: entry.name,
                weight: finalWeight,
                cost: finalCost
            });
        });

        // Sort rows
        if (state.sortKey) {
            const dir = state.sortDir === 'asc' ? 1 : -1;
            rows.sort((a, b) => {
                if (state.sortKey === 'food') {
                    return a.name.localeCompare(b.name) * dir;
                }
                if (state.sortKey === 'weight') {
                    return (a.weight - b.weight) * dir;
                }
                if (state.sortKey === 'cost') {
                    return (a.cost - b.cost) * dir;
                }
                return 0;
            });
        }

        return rows;
    }

    // Remove a specific food row from current shopping list
    function removeShoppingFood(foodId) {
        state.excludedFoods[foodId] = true;
        saveState();
        render();
    }

    // Inline editing handlers
    function startInlineEdit(foodId, field) {
        state.editing = { foodId, field };
        render();
        const input = document.getElementById('shopping-inline-input');
        if (input) {
            input.focus();
            input.select();
        }
    }

    function saveInlineEdit(foodId, field) {
        const { DataStore } = window.TableModule;
        const input = document.getElementById('shopping-inline-input');
        if (input) {
            const val = Math.max(0, DataStore.safeNum(input.value, 0));
            if (field === 'weight') {
                state.weightOverrides[foodId] = val;
            } else if (field === 'cost') {
                state.costOverrides[foodId] = val;
            }
            saveState();
        }
        state.editing = null;
        render();
    }

    function cancelInlineEdit() {
        state.editing = null;
        render();
    }

    // Render dropdown in Shopping toolbar
    function renderDropdown() {
        const { DataStore } = window.TableModule;
        const select = document.getElementById('shopping-plan-select');
        if (!select || !DataStore) return;

        const currentVal = select.value;
        const plans = getAllAvailablePlans();

        if (plans.length === 0) {
            select.innerHTML = `<option value="">No Meal Plans Available</option>`;
            return;
        }

        let html = '';
        plans.forEach(p => {
            const selected = p.key === currentVal ? 'selected' : '';
            html += `<option value="${DataStore.escapeHTML(p.key)}" ${selected}>${DataStore.escapeHTML(p.name)} (${p.foodCount} foods)</option>`;
        });
        select.innerHTML = html;
    }

    // Render Right Panel: Meal Plans Selector & Included Plans List
    function renderPlansPanel() {
        const { DataStore } = window.TableModule;
        const tbody = document.getElementById('shopping-plans-table-body');
        const badge = document.getElementById('shopping-included-plans-badge');
        if (!tbody || !DataStore) return;

        const plans = getAllAvailablePlans();
        const totalIncludedCount = state.includedPlans.length;

        if (badge) {
            badge.textContent = `${totalIncludedCount} ${totalIncludedCount === 1 ? 'plan' : 'plans'} included`;
        }

        if (plans.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="col-center" style="padding: 36px 16px; color: var(--text-secondary);">
                        No meal plans found. Create a meal plan in the <strong>Meal Plan Table</strong> tab first.
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        plans.forEach(plan => {
            const isIncluded = state.includedPlans.includes(plan.key);

            html += `
                <tr class="compare-plan-row ${isIncluded ? 'active-plan-row' : ''}" data-plan-key="${DataStore.escapeHTML(plan.key)}">
                    <td class="col-left col-plan-name">
                        <div class="compare-plan-name-cell">
                            <span class="compare-plan-name-text" title="${DataStore.escapeHTML(plan.name)}">${DataStore.escapeHTML(plan.name)}</span>
                            ${isIncluded ? `<span class="compare-active-pill">Included</span>` : ''}
                        </div>
                    </td>
                    <td class="col-num" style="color: var(--text-secondary);">${plan.foodCount} foods</td>
                    <td class="col-right" style="white-space: nowrap; text-align: right;">
                        <div class="shopping-plan-actions">
                            ${isIncluded ? `
                                <button type="button" class="btn-table-remove" data-action="remove-plan" data-plan-key="${DataStore.escapeHTML(plan.key)}" title="Remove plan from shopping list">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            ` : `
                                <button type="button" class="btn-secondary-action shopping-include-btn" data-action="inc-plan" data-plan-key="${DataStore.escapeHTML(plan.key)}">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                    <span>Include</span>
                                </button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    // Render Left Panel: Aggregated Shopping Items Table (Food, Weight, Cost)
    function renderShoppingTable() {
        const { DataStore } = window.TableModule;
        const tbody = document.getElementById('shopping-table-body');
        const tfoot = document.getElementById('shopping-table-foot');
        const itemCountBadge = document.getElementById('shopping-item-count');
        if (!tbody || !tfoot || !DataStore) return;

        const items = getAggregatedShoppingItems();

        if (itemCountBadge) {
            itemCountBadge.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;
        }

        updateSortHeadersUI();

        if (items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="col-center" style="padding: 60px 20px; color: var(--text-secondary); font-size: var(--font-size-base);">
                        No meal plans included yet. Select a meal plan above or click <strong>+ Include</strong> on the right to generate your shopping list.
                    </td>
                </tr>
            `;
            tfoot.innerHTML = '';
            return;
        }

        let totalWeight = 0;
        let totalCost = 0;
        let bodyHTML = '';

        items.forEach(item => {
            totalWeight += item.weight;
            totalCost += item.cost;

            const isEditingWeight = state.editing && state.editing.foodId === item.foodId && state.editing.field === 'weight';
            const isEditingCost = state.editing && state.editing.foodId === item.foodId && state.editing.field === 'cost';

            bodyHTML += `
                <tr class="food-row" data-food-id="${DataStore.escapeHTML(item.foodId)}">
                    <!-- Food Name -->
                    <td class="col-left col-food">
                        <div class="food-name-cell">
                            <span class="food-title" title="${DataStore.escapeHTML(item.name)}">${DataStore.escapeHTML(item.name)}</span>
                        </div>
                    </td>

                    <!-- Weight -->
                    <td class="col-weight">
                        ${isEditingWeight ? `
                            <div class="weight-edit-inline">
                                <input type="number" class="weight-input-inline" id="shopping-inline-input" min="0" max="50000" step="1" value="${Math.round(item.weight)}">
                                <span class="unit-text">g</span>
                                <button type="button" class="btn-save-weight" title="Save Weight" data-action="save-edit" data-food-id="${DataStore.escapeHTML(item.foodId)}" data-field="weight">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </button>
                                <button type="button" class="btn-cancel-weight" title="Cancel" data-action="cancel-edit">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        ` : `
                            <div class="weight-cell">
                                <span class="weight-val">${Math.round(item.weight)}g</span>
                                <button type="button" class="btn-edit-weight" title="Edit weight" data-action="start-edit" data-food-id="${DataStore.escapeHTML(item.foodId)}" data-field="weight">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                            </div>
                        `}
                    </td>

                    <!-- Cost -->
                    <td class="col-num col-cost">
                        ${isEditingCost ? `
                            <div class="weight-edit-inline">
                                <span class="unit-text">₹</span>
                                <input type="number" class="weight-input-inline" id="shopping-inline-input" min="0" max="100000" step="1" value="${Math.round(item.cost)}">
                                <button type="button" class="btn-save-weight" title="Save Cost" data-action="save-edit" data-food-id="${DataStore.escapeHTML(item.foodId)}" data-field="cost">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </button>
                                <button type="button" class="btn-cancel-weight" title="Cancel" data-action="cancel-edit">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        ` : `
                            <div class="weight-cell">
                                <span class="cost-val">₹${Math.round(item.cost)}</span>
                                <button type="button" class="btn-edit-weight" title="Edit cost" data-action="start-edit" data-food-id="${DataStore.escapeHTML(item.foodId)}" data-field="cost">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                            </div>
                        `}
                    </td>

                    <!-- Action: Remove Item -->
                    <td class="col-action">
                        <button type="button" class="btn-table-remove" data-action="remove-food" data-food-id="${DataStore.escapeHTML(item.foodId)}" title="Remove item from shopping list" aria-label="Remove item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = bodyHTML;

        tfoot.innerHTML = `
            <tr class="table-grand-totals-row">
                <td class="col-left">
                    <div class="grand-total-label">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                        TOTALS
                    </div>
                </td>
                <td class="col-weight"><strong>${Math.round(totalWeight)}g</strong></td>
                <td class="col-num col-cost"><span class="price-pill">₹${Math.round(totalCost)}</span></td>
                <td class="col-action"></td>
            </tr>
        `;
    }

    function updateSortHeadersUI() {
        const headers = document.querySelectorAll('th.sortable-shopping[data-shopping-sort]');
        headers.forEach(th => {
            const key = th.getAttribute('data-shopping-sort');
            const indicator = th.querySelector('.sort-indicator');
            if (key === state.sortKey) {
                th.classList.add('active-sort');
                if (indicator) indicator.textContent = state.sortDir === 'asc' ? ' ▲' : ' ▼';
            } else {
                th.classList.remove('active-sort');
                if (indicator) indicator.textContent = '';
            }
        });
    }

    function render() {
        renderDropdown();
        renderPlansPanel();
        renderShoppingTable();
    }

    function initEvents() {
        // Add selected plan from dropdown
        const btnAddPlan = document.getElementById('btn-shopping-add-plan');
        if (btnAddPlan) {
            btnAddPlan.addEventListener('click', () => {
                const select = document.getElementById('shopping-plan-select');
                if (select && select.value) {
                    includePlan(select.value);
                }
            });
        }

        // Include All Plans button
        const btnAddAll = document.getElementById('btn-shopping-add-all');
        if (btnAddAll) {
            btnAddAll.addEventListener('click', () => {
                includeAllPlans();
            });
        }

        // Clear Shopping List button
        const btnClear = document.getElementById('btn-shopping-clear');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                clearShoppingList();
            });
        }

        // Delegated click events on Right Panel (Plans list)
        const plansTbody = document.getElementById('shopping-plans-table-body');
        if (plansTbody) {
            plansTbody.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-action]');
                if (btn) {
                    const action = btn.getAttribute('data-action');
                    const planKey = btn.getAttribute('data-plan-key');
                    if (action === 'inc-plan') includePlan(planKey);
                    else if (action === 'remove-plan') removeIncludedPlan(planKey);
                    return;
                }
                const row = e.target.closest('tr[data-plan-key]');
                if (row) {
                    togglePlan(row.getAttribute('data-plan-key'));
                }
            });
        }

        // Delegated click and keydown events on Left Panel (Shopping Items Table)
        const shoppingTbody = document.getElementById('shopping-table-body');
        if (shoppingTbody) {
            shoppingTbody.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-action]');
                if (!btn) return;
                const action = btn.getAttribute('data-action');
                const foodId = btn.getAttribute('data-food-id');
                const field = btn.getAttribute('data-field');

                if (action === 'start-edit') startInlineEdit(foodId, field);
                else if (action === 'save-edit') saveInlineEdit(foodId, field);
                else if (action === 'cancel-edit') cancelInlineEdit();
                else if (action === 'remove-food') removeShoppingFood(foodId);
            });

            shoppingTbody.addEventListener('keydown', (e) => {
                if (e.target.id === 'shopping-inline-input') {
                    if (e.key === 'Enter' && state.editing) {
                        e.preventDefault();
                        saveInlineEdit(state.editing.foodId, state.editing.field);
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelInlineEdit();
                    }
                }
            });
        }

        // Sortable column headers in Shopping Table
        const sortHeaders = document.querySelectorAll('th.sortable-shopping[data-shopping-sort]');
        sortHeaders.forEach(th => {
            th.addEventListener('click', () => {
                const key = th.getAttribute('data-shopping-sort');
                if (state.sortKey === key) {
                    state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
                } else {
                    state.sortKey = key;
                    state.sortDir = key === 'food' ? 'asc' : 'desc';
                }
                renderShoppingTable();
            });
        });
    }

    function init() {
        loadState();
        initEvents();
        render();
    }

    return {
        init,
        refresh: render
    };
})();

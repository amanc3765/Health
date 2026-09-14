/**
 * Meal Plan Table - Table Renderer Module
 * Renders table body rows, sticky grand totals footer, and handles inline weight editing.
 */

window.TableModule = window.TableModule || {};

window.TableModule.TableRenderer = (function () {
    let editingIndex = null;

    function getTableElements() {
        return {
            tableBody: document.getElementById('table-body'),
            tableFoot: document.getElementById('table-foot')
        };
    }

    function render() {
        const { tableBody, tableFoot } = getTableElements();
        if (!tableBody || !tableFoot) return;

        const { DataStore, DragDrop, ColumnSort } = window.TableModule;
        const items = DataStore.getTableFoods();

        // Update Left Panel Header Display
        const currentPlanDisplayName = document.getElementById('current-plan-display-name');
        if (currentPlanDisplayName) {
            const currentKey = DataStore.getSelectedPlanKey();
            currentPlanDisplayName.textContent = currentKey === '__current__' ? 'Current Active Plan' : currentKey;
        }
        const currentPlanItemCount = document.getElementById('current-plan-item-count');
        if (currentPlanItemCount) {
            currentPlanItemCount.textContent = `${items.length} ${items.length === 1 ? 'food' : 'foods'}`;
        }

        // Empty state
        if (items.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="col-center" style="padding: 60px 20px; color: var(--text-secondary); font-size: var(--font-size-base);">
                        No foods in this meal plan yet. Click <strong>+ New Meal Plan</strong> or <strong>Add Food</strong> above to get started.
                    </td>
                </tr>
            `;
            tableFoot.innerHTML = '';
            if (ColumnSort) ColumnSort.updateHeaderUI();
            renderCompareTable();
            return;
        }

        // Compute row HTML and aggregate grand totals
        const grandTotals = {
            weight: 0,
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
            price: 0
        };

        let bodyHTML = '';

        items.forEach((item, index) => {
            const food = DataStore.getFoodById(item.foodId);
            const foodName = food ? food.name : item.foodId;
            const nutr = DataStore.calculateRowNutrition(food, item.weight);

            grandTotals.weight += nutr.weight;
            grandTotals.calories += nutr.calories;
            grandTotals.protein += nutr.protein;
            grandTotals.carbs += nutr.carbs;
            grandTotals.fat += nutr.fat;
            grandTotals.fiber += nutr.fiber;
            grandTotals.price += nutr.price;

            const isEditing = editingIndex === index;

            bodyHTML += `
            <tr class="food-row" draggable="true" data-index="${index}">
                <!-- Food Item with drag handle and 'i' button at the start -->
                <td class="col-left col-food">
                    <div class="food-name-cell">
                        <span class="drag-handle" title="Drag to reorder row">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="9" cy="5" r="1.5"></circle>
                                <circle cx="9" cy="12" r="1.5"></circle>
                                <circle cx="9" cy="19" r="1.5"></circle>
                                <circle cx="15" cy="5" r="1.5"></circle>
                                <circle cx="15" cy="12" r="1.5"></circle>
                                <circle cx="15" cy="19" r="1.5"></circle>
                            </svg>
                        </span>
                        <button type="button" class="food-info-btn" data-food-id="${DataStore.escapeHTML(item.foodId)}" title="View 100g Nutrition from foods.json" aria-label="Nutrition Info">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                        </button>
                        <span class="food-title" title="${DataStore.escapeHTML(foodName)}">${DataStore.escapeHTML(foodName)}</span>
                    </div>
                </td>

                <!-- Weight Column with Inline Pencil Editing -->
                <td class="col-weight">
                    ${isEditing ? `
                        <div class="weight-edit-inline">
                            <input type="number" class="weight-input-inline" id="inline-weight-input" min="1" max="5000" step="1" value="${nutr.weight}">
                            <span class="unit-text">g</span>
                            <button type="button" class="btn-save-weight" title="Save Weight" onclick="window.saveInlineWeight(${index})">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                            <button type="button" class="btn-cancel-weight" title="Cancel" onclick="window.cancelInlineWeight()">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    ` : `
                        <div class="weight-cell">
                            <span class="weight-val">${Math.round(nutr.weight)}g</span>
                            <button type="button" class="btn-edit-weight" data-index="${index}" title="Edit weight with pencil" onclick="window.startInlineWeight(${index})">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                        </div>
                    `}
                </td>

                <!-- Calories -->
                <td class="col-num col-cal">${Math.round(nutr.calories)}</td>

                <!-- Protein -->
                <td class="col-num col-pro">${nutr.protein.toFixed(1)}g</td>

                <!-- Carbs -->
                <td class="col-num col-carb">${nutr.carbs.toFixed(1)}g</td>

                <!-- Fat -->
                <td class="col-num col-fat">${nutr.fat.toFixed(1)}g</td>

                <!-- Fiber -->
                <td class="col-num col-fiber">${nutr.fiber > 0 ? nutr.fiber.toFixed(1) + 'g' : '<span class="dash-text">—</span>'}</td>

                <!-- Action: Remove Row -->
                <td class="col-action">
                    <button type="button" class="btn-table-remove" data-index="${index}" draggable="false" onclick="window.removeFoodFromTablePlan(${index})" title="Remove item from plan" aria-label="Remove item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </td>
            </tr>
            `;
        });

        tableBody.innerHTML = bodyHTML;

        // Render Grand Totals sticky footer
        tableFoot.innerHTML = `
            <tr class="table-grand-totals-row">
                <td class="col-left">
                    <div class="grand-total-label">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                        TOTALS
                    </div>
                </td>
                <td class="col-weight"><strong>${Math.round(grandTotals.weight)}g</strong></td>
                <td class="col-num col-cal"><strong>${Math.round(grandTotals.calories)} kcal</strong></td>
                <td class="col-num col-pro"><strong>${grandTotals.protein.toFixed(1)}g</strong></td>
                <td class="col-num col-carb"><strong>${grandTotals.carbs.toFixed(1)}g</strong></td>
                <td class="col-num col-fat"><strong>${grandTotals.fat.toFixed(1)}g</strong></td>
                <td class="col-num col-fiber"><strong>${grandTotals.fiber.toFixed(1)}g</strong></td>
                <td class="col-center"><span class="price-pill" title="Estimated cost">₹${Math.round(grandTotals.price)}</span></td>
            </tr>
        `;

        // Update sort indicators
        if (ColumnSort) ColumnSort.updateHeaderUI();

        // Attach drag-and-drop row reordering
        if (DragDrop) DragDrop.attachListeners(render);

        // Manage keyboard interaction and focus for inline editing
        if (editingIndex !== null) {
            const input = document.getElementById('inline-weight-input');
            if (input) {
                input.focus();
                input.select();
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        saveInlineWeight(editingIndex);
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelInlineWeight();
                    }
                });
            }
        }

        // Render Right Comparison Table (All Meal Plans)
        renderCompareTable();
    }

    function renderCompareTable() {
        const compareTableBody = document.getElementById('compare-table-body');
        if (!compareTableBody) return;

        const { DataStore, ColumnSort } = window.TableModule;
        if (!DataStore || typeof DataStore.getAllPlansSummary !== 'function') return;

        let allPlans = DataStore.getAllPlansSummary();
        const countBadge = document.getElementById('all-plans-count-badge');
        if (countBadge) {
            countBadge.textContent = `${allPlans.length} ${allPlans.length === 1 ? 'plan' : 'plans'}`;
        }

        if (allPlans.length === 0) {
            compareTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="col-center" style="padding: 40px 16px; color: var(--text-secondary);">
                        No meal plans available to compare.
                    </td>
                </tr>
            `;
            return;
        }

        if (ColumnSort && typeof ColumnSort.sortPlansList === 'function') {
            allPlans = ColumnSort.sortPlansList(allPlans);
        }

        let rowsHTML = '';
        allPlans.forEach(plan => {
            const isSelected = plan.isSelected;
            const cal = Math.round(plan.totals.calories);
            const pro = plan.totals.protein.toFixed(1);
            const carb = plan.totals.carbs.toFixed(1);
            const fat = plan.totals.fat.toFixed(1);
            const fiber = plan.totals.fiber > 0 ? plan.totals.fiber.toFixed(1) + 'g' : '<span class="dash-text">—</span>';

            rowsHTML += `
            <tr class="compare-plan-row ${isSelected ? 'active-plan-row' : ''}" data-plan-key="${DataStore.escapeHTML(plan.key)}" title="Click to view and edit this plan on the left">
                <td class="col-left col-plan-name">
                    <div class="compare-plan-name-cell">
                        <span class="compare-plan-name-text" title="${DataStore.escapeHTML(plan.name)}">${DataStore.escapeHTML(plan.name)}</span>
                        ${isSelected ? '<span class="compare-active-pill">Active</span>' : ''}
                    </div>
                </td>
                <td class="col-num col-cal">${cal} kcal</td>
                <td class="col-num col-pro">${pro}g</td>
                <td class="col-num col-carb">${carb}g</td>
                <td class="col-num col-fat">${fat}g</td>
                <td class="col-num col-fiber">${fiber}</td>
            </tr>
            `;
        });

        compareTableBody.innerHTML = rowsHTML;

        // Click row to select plan
        compareTableBody.querySelectorAll('.compare-plan-row').forEach(row => {
            row.addEventListener('click', () => {
                const planKey = row.dataset.planKey;
                if (planKey && window.MealPlanTable && typeof window.MealPlanTable.setSelectedPlan === 'function') {
                    window.MealPlanTable.setSelectedPlan(planKey);
                }
            });
        });

        if (ColumnSort && typeof ColumnSort.updateCompareHeaderUI === 'function') {
            ColumnSort.updateCompareHeaderUI();
        }
    }

    function initCompareSortListeners() {
        const { ColumnSort } = window.TableModule;
        if (ColumnSort && typeof ColumnSort.initHeaderListeners === 'function') {
            ColumnSort.initHeaderListeners(render);
        }
    }

    // Inline weight edit actions
    function startInlineWeight(index) {
        editingIndex = index;
        render();
    }

    function cancelInlineWeight() {
        editingIndex = null;
        render();
    }

    function saveInlineWeight(index) {
        const input = document.getElementById('inline-weight-input');
        if (!input) return;

        const val = parseFloat(input.value);
        if (isNaN(val) || val <= 0) {
            alert('Please enter a valid weight in grams (> 0).');
            return;
        }

        const { DataStore } = window.TableModule;
        DataStore.updateFoodWeight(index, val);
        editingIndex = null;
        render();
    }

    function removeFood(index) {
        const idx = typeof index === 'number' ? index : parseInt(index, 10);
        if (isNaN(idx) || idx < 0) return;
        const { DataStore } = window.TableModule;
        if (DataStore && typeof DataStore.removeFood === 'function') {
            DataStore.removeFood(idx);
        }
        editingIndex = null;
        render();
    }

    // Attach to window for inline onclick attributes in HTML
    window.startInlineWeight = (arg1, arg2) => startInlineWeight(arg2 !== undefined ? arg2 : arg1);
    window.saveInlineWeight = (arg1, arg2) => saveInlineWeight(arg2 !== undefined ? arg2 : arg1);
    window.cancelInlineWeight = cancelInlineWeight;
    window.removeFoodFromTablePlan = (arg1, arg2) => {
        const target = arg2 !== undefined ? arg2 : arg1;
        removeFood(target);
    };

    return {
        render,
        renderCompareTable,
        initCompareSortListeners,
        startInlineWeight,
        saveInlineWeight,
        cancelInlineWeight,
        removeFood
    };
})();

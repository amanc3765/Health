/**
 * Meal Plan Table - Modals Module
 * Handles 'Create New Meal Plan' and 'Add Food to Plan' modals.
 */

window.TableModule = window.TableModule || {};

window.TableModule.Modals = (function () {
    let onPlanUpdatedCallback = null;

    // --- Create Plan Modal ---
    function openCreatePlan() {
        const modal = document.getElementById('table-create-plan-modal');
        const input = document.getElementById('table-new-plan-name-input');
        const copyCheck = document.getElementById('table-copy-active-plan-check');
        const selectExisting = document.getElementById('table-existing-plan-select');
        const { DataStore } = window.TableModule;

        if (selectExisting) {
            DataStore.loadFromStorage();
            const savedPlans = DataStore.getSavedPlans() || [];
            let optionsHTML = '<option value="">Choose plan</option>';
            savedPlans.forEach(plan => {
                optionsHTML += `<option value="${DataStore.escapeHTML(plan.name)}">${DataStore.escapeHTML(plan.name)}</option>`;
            });
            selectExisting.innerHTML = optionsHTML;

            const currentKey = DataStore.getSelectedPlanKey();
            if (currentKey && currentKey !== '__current__' && savedPlans.some(p => p.name === currentKey)) {
                selectExisting.value = currentKey;
                if (input) input.value = currentKey;
            } else {
                selectExisting.value = '';
                if (input) input.value = '';
            }
        }

        if (copyCheck) copyCheck.checked = true;
        if (modal) modal.classList.remove('hidden');
        setTimeout(() => input && input.focus(), 50);
    }

    function closeCreatePlan() {
        const modal = document.getElementById('table-create-plan-modal');
        if (modal) modal.classList.add('hidden');
    }

    function confirmCreatePlan() {
        const input = document.getElementById('table-new-plan-name-input');
        const copyCheck = document.getElementById('table-copy-active-plan-check');
        const selectExisting = document.getElementById('table-existing-plan-select');
        const name = (input ? input.value.trim() : '') || (selectExisting ? selectExisting.value.trim() : '');

        if (!name) {
            alert('Please enter or select a name for the meal plan.');
            return;
        }

        const { DataStore, ColumnSort } = window.TableModule;
        const shouldCopy = copyCheck ? copyCheck.checked : true;

        try {
            const result = DataStore.createOrUpdatePlan(name, shouldCopy, false);
            if (result.exists) {
                if (confirm(`Plan "${name}" already exists. Overwrite?`)) {
                    DataStore.createOrUpdatePlan(name, shouldCopy, true);
                } else {
                    return;
                }
            }
            if (ColumnSort) ColumnSort.reset();
            closeCreatePlan();
            if (typeof onPlanUpdatedCallback === 'function') {
                onPlanUpdatedCallback();
            }
            if (window.renderSavedPlans) {
                window.renderSavedPlans();
            }
        } catch (err) {
            alert(err.message || 'Failed to save meal plan.');
        }
    }

    // --- Add Food Modal ---
    function openAddFood() {
        const modal = document.getElementById('table-add-food-modal');
        const selectFood = document.getElementById('table-add-food-select');
        const inputWeight = document.getElementById('table-add-food-weight');
        const { DataStore } = window.TableModule;

        if (selectFood) {
            const foods = DataStore.getFoods();
            const sortedFoods = [...foods].sort((a, b) => a.name.localeCompare(b.name));

            selectFood.innerHTML = sortedFoods.map(f => {
                const cal = Math.round(DataStore.safeNum(f.calories));
                const pro = DataStore.safeNum(f.protein).toFixed(1);
                return `<option value="${DataStore.escapeHTML(f.id)}">${DataStore.escapeHTML(f.name)} (${cal} kcal/100g, ${pro}g P)</option>`;
            }).join('');

            if (sortedFoods.length > 0 && inputWeight) {
                inputWeight.value = sortedFoods[0].default_weight || 100;
            }
        }

        if (modal) modal.classList.remove('hidden');
    }

    function closeAddFood() {
        const modal = document.getElementById('table-add-food-modal');
        if (modal) modal.classList.add('hidden');
    }

    function confirmAddFood() {
        const selectFood = document.getElementById('table-add-food-select');
        const inputWeight = document.getElementById('table-add-food-weight');

        const foodId = selectFood ? selectFood.value : '';
        const weight = inputWeight ? parseFloat(inputWeight.value) : 100;

        if (!foodId) return;
        if (isNaN(weight) || weight <= 0) {
            alert('Please enter a valid weight in grams (> 0).');
            return;
        }

        const { DataStore, ColumnSort } = window.TableModule;
        DataStore.addFood(foodId, weight);
        if (ColumnSort) ColumnSort.reset();

        closeAddFood();
        if (typeof onPlanUpdatedCallback === 'function') {
            onPlanUpdatedCallback();
        }
    }

    // Initialize Modal Event Listeners
    function initEvents(onPlanUpdated) {
        onPlanUpdatedCallback = onPlanUpdated;

        // Create Plan Modal buttons & keyboard shortcuts
        const btnNewPlan = document.getElementById('btn-table-new-plan');
        const btnCancelCreate = document.getElementById('btn-cancel-create-table-plan');
        const btnConfirmCreate = document.getElementById('btn-confirm-create-table-plan');
        const modalCreate = document.getElementById('table-create-plan-modal');
        const inputPlanName = document.getElementById('table-new-plan-name-input');

        if (btnNewPlan) btnNewPlan.addEventListener('click', openCreatePlan);
        if (btnCancelCreate) btnCancelCreate.addEventListener('click', closeCreatePlan);
        if (btnConfirmCreate) btnConfirmCreate.addEventListener('click', confirmCreatePlan);

        const selectExistingPlan = document.getElementById('table-existing-plan-select');
        if (selectExistingPlan) {
            selectExistingPlan.addEventListener('change', (e) => {
                if (inputPlanName) {
                    inputPlanName.value = e.target.value || '';
                }
            });
        }

        if (inputPlanName) {
            inputPlanName.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') confirmCreatePlan();
                if (e.key === 'Escape') closeCreatePlan();
            });
            inputPlanName.addEventListener('input', (e) => {
                if (!selectExistingPlan) return;
                const val = e.target.value.trim().toLowerCase();
                const { DataStore } = window.TableModule;
                const matching = (DataStore.getSavedPlans() || []).find(p => p.name.toLowerCase() === val);
                selectExistingPlan.value = matching ? matching.name : '';
            });
        }
        if (modalCreate) {
            modalCreate.addEventListener('click', (e) => {
                if (e.target === modalCreate) closeCreatePlan();
            });
        }

        // Add Food Modal buttons & keyboard shortcuts
        const btnAddFood = document.getElementById('btn-table-add-food');
        const btnCancelAdd = document.getElementById('btn-cancel-table-add-food');
        const btnConfirmAdd = document.getElementById('btn-confirm-table-add-food');
        const modalAddFood = document.getElementById('table-add-food-modal');
        const selectFood = document.getElementById('table-add-food-select');
        const inputWeight = document.getElementById('table-add-food-weight');

        if (btnAddFood) btnAddFood.addEventListener('click', openAddFood);
        if (btnCancelAdd) btnCancelAdd.addEventListener('click', closeAddFood);
        if (btnConfirmAdd) btnConfirmAdd.addEventListener('click', confirmAddFood);

        if (selectFood) {
            selectFood.addEventListener('change', (e) => {
                const { DataStore } = window.TableModule;
                const food = DataStore.getFoodById(e.target.value);
                if (food && inputWeight) {
                    inputWeight.value = food.default_weight || 100;
                }
            });
        }

        if (inputWeight) {
            inputWeight.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') confirmAddFood();
                if (e.key === 'Escape') closeAddFood();
            });
        }

        if (modalAddFood) {
            modalAddFood.addEventListener('click', (e) => {
                if (e.target === modalAddFood) closeAddFood();
            });
        }
    }

    return {
        openCreatePlan,
        closeCreatePlan,
        confirmCreatePlan,
        openAddFood,
        closeAddFood,
        confirmAddFood,
        initEvents
    };
})();

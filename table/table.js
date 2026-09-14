/**
 * Meal Plan Table - Main Controller Module
 * Coordinates data store, rendering, modals, popover, and toolbar actions.
 */

window.TableModule = window.TableModule || {};

window.TableModule.Controller = (function () {
    const { DataStore, TableRenderer, ColumnSort, NutritionPopover, Modals } = window.TableModule;

    // Render Plan Select Dropdown and toggle toolbar action buttons
    function renderPlanSelectDropdown() {
        const select = document.getElementById('table-plan-select');
        if (!select) return;

        const currentKey = DataStore.getSelectedPlanKey();
        const savedPlans = DataStore.getSavedPlans();

        let optionsHTML = `<option value="__current__" ${currentKey === '__current__' ? 'selected' : ''}>Current Active Plan</option>`;

        savedPlans.forEach(plan => {
            const isSelected = currentKey === plan.name ? 'selected' : '';
            optionsHTML += `<option value="${DataStore.escapeHTML(plan.name)}" ${isSelected}>${DataStore.escapeHTML(plan.name)}</option>`;
        });

        select.innerHTML = optionsHTML;

        // Toggle "Delete" button visibility
        const isSavedPlan = currentKey !== '__current__';
        const btnDeletePlan = document.getElementById('btn-table-delete-plan');
        if (btnDeletePlan) btnDeletePlan.style.display = isSavedPlan ? 'inline-flex' : 'none';
    }

    // Full UI Refresh
    function refreshView() {
        renderPlanSelectDropdown();
        TableRenderer.render();
    }

    // Initialize the Table module
    async function init() {
        await DataStore.loadFoods();
        DataStore.loadFromStorage();

        // Check if a specific plan was requested in URL query params
        const urlParams = new URLSearchParams(window.location.search);
        const planParam = urlParams.get('plan');
        if (planParam && DataStore.getSavedPlans().some(p => p.name === planParam)) {
            DataStore.setSelectedPlanKey(planParam);
        }

        // Setup submodules
        NutritionPopover.initEvents();
        ColumnSort.initHeaderListeners(() => TableRenderer.render());
        if (TableRenderer && typeof TableRenderer.initCompareSortListeners === 'function') {
            TableRenderer.initCompareSortListeners();
        }
        Modals.initEvents(refreshView);

        setupToolbarEvents();
        setupStorageSync();

        refreshView();
    }

    // Setup Toolbar Action Events
    function setupToolbarEvents() {
        // Plan selector dropdown change
        const select = document.getElementById('table-plan-select');
        if (select) {
            select.addEventListener('change', (e) => {
                DataStore.setSelectedPlanKey(e.target.value);
                if (ColumnSort) ColumnSort.reset();
                refreshView();
            });
        }


        // "Delete Plan" button
        const btnDeletePlan = document.getElementById('btn-table-delete-plan');
        if (btnDeletePlan) {
            btnDeletePlan.addEventListener('click', () => {
                const currentKey = DataStore.getSelectedPlanKey();
                if (currentKey === '__current__') return;

                if (confirm(`Are you sure you want to delete meal plan "${currentKey}"?`)) {
                    DataStore.deletePlan(currentKey);
                    if (ColumnSort) ColumnSort.reset();
                    refreshView();
                }
            });
        }
    }

    // Listen for storage changes across browser tabs
    function setupStorageSync() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'mealPlannerSavedPlans' || e.key === 'mealPlannerState' || !e.key) {
                DataStore.loadFromStorage();
                refreshView();
            }
        });
    }

    // Set selected plan programmatically
    function setSelectedPlan(planKey) {
        DataStore.setSelectedPlanKey(planKey);
        if (ColumnSort) ColumnSort.reset();
        refreshView();
    }

    return {
        init,
        refresh: refreshView,
        setSelectedPlan
    };
})();

// Expose global window.MealPlanTable interface for tab switching and external control
window.MealPlanTable = {
    init: window.TableModule.Controller.init,
    refresh: window.TableModule.Controller.refresh,
    setSelectedPlan: window.TableModule.Controller.setSelectedPlan
};

// Auto-initialize if table elements exist on DOM load
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('table-plan-select') || document.getElementById('table-body')) {
        window.MealPlanTable.init();
    }
});

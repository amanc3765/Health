/**
 * Meal Plan Table - Column Sorting Module
 * Sorts table rows by clicking column headers and maintains sort indicator state
 * for both the Food Table (left) and All Meal Plans Comparison Table (right).
 */

window.TableModule = window.TableModule || {};

window.TableModule.ColumnSort = (function () {
    let currentFoodSort = null; // { column: 'calories', direction: 'desc' }
    let currentPlanSort = { column: 'calories', direction: 'desc' };

    function getSortState() {
        return currentFoodSort;
    }

    function getCompareSortState() {
        return currentPlanSort;
    }

    function reset() {
        currentFoodSort = null;
        updateHeaderUI();
    }

    function resetCompare() {
        currentPlanSort = { column: 'calories', direction: 'desc' };
        updateCompareHeaderUI();
    }

    // Sort Food Table (Left Table)
    function sort(column, onSortedCallback) {
        const { DataStore } = window.TableModule;
        let direction = 'asc';

        if (currentFoodSort && currentFoodSort.column === column) {
            direction = currentFoodSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            direction = column === 'food' ? 'asc' : 'desc';
        }

        currentFoodSort = { column, direction };

        const items = DataStore.getTableFoods();

        items.sort((a, b) => {
            const foodA = DataStore.getFoodById(a.foodId);
            const foodB = DataStore.getFoodById(b.foodId);
            const nutrA = DataStore.calculateRowNutrition(foodA, a.weight);
            const nutrB = DataStore.calculateRowNutrition(foodB, b.weight);

            let valA, valB;

            switch (column) {
                case 'food':
                    valA = (foodA ? foodA.name : a.foodId).toLowerCase();
                    valB = (foodB ? foodB.name : b.foodId).toLowerCase();
                    return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'weight':
                    valA = nutrA.weight;
                    valB = nutrB.weight;
                    break;
                case 'calories':
                    valA = nutrA.calories;
                    valB = nutrB.calories;
                    break;
                case 'protein':
                    valA = nutrA.protein;
                    valB = nutrB.protein;
                    break;
                case 'carbs':
                    valA = nutrA.carbs;
                    valB = nutrB.carbs;
                    break;
                case 'fat':
                    valA = nutrA.fat;
                    valB = nutrB.fat;
                    break;
                case 'fiber':
                    valA = nutrA.fiber;
                    valB = nutrB.fiber;
                    break;
                default:
                    return 0;
            }

            return direction === 'asc' ? valA - valB : valB - valA;
        });

        // Persist newly sorted order so it stays preserved
        DataStore.saveTableFoods(items);
        updateHeaderUI();

        if (typeof onSortedCallback === 'function') {
            onSortedCallback();
        }
    }

    // Sort All Meal Plans Comparison Table (Right Table)
    function sortPlans(column, onSortedCallback) {
        let direction = 'desc';

        if (currentPlanSort && currentPlanSort.column === column) {
            direction = currentPlanSort.direction === 'desc' ? 'asc' : 'desc';
        } else {
            direction = column === 'name' ? 'asc' : 'desc';
        }

        currentPlanSort = { column, direction };
        updateCompareHeaderUI();

        if (typeof onSortedCallback === 'function') {
            onSortedCallback();
        }
    }

    function sortPlansList(plans) {
        if (!currentPlanSort || !currentPlanSort.column || !Array.isArray(plans)) return plans;

        const { column, direction } = currentPlanSort;
        const sorted = [...plans];

        sorted.sort((a, b) => {
            if (column === 'name') {
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                return direction === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
            }

            const valA = (a.totals && a.totals[column] !== undefined) ? parseFloat(a.totals[column]) || 0 : 0;
            const valB = (b.totals && b.totals[column] !== undefined) ? parseFloat(b.totals[column]) || 0 : 0;

            if (valA === valB) {
                return (a.name || '').localeCompare(b.name || '');
            }

            return direction === 'asc' ? valA - valB : valB - valA;
        });

        return sorted;
    }

    function updateHeaderUI() {
        document.querySelectorAll('.meal-plan-table:not(.compare-plans-table) th.sortable').forEach(th => {
            const col = th.dataset.sort;
            const indicator = th.querySelector('.sort-indicator');
            if (!indicator) return;

            if (currentFoodSort && currentFoodSort.column === col) {
                indicator.textContent = currentFoodSort.direction === 'asc' ? ' ▲' : ' ▼';
                th.classList.add('active-sort');
            } else {
                indicator.textContent = '';
                th.classList.remove('active-sort');
            }
        });
    }

    function updateCompareHeaderUI() {
        document.querySelectorAll('.compare-plans-table th[data-compare-sort], .compare-plans-table th.sortable-compare').forEach(th => {
            const col = th.dataset.compareSort || th.dataset.sort;
            const indicator = th.querySelector('.sort-indicator');
            if (!indicator) return;

            if (currentPlanSort && currentPlanSort.column === col) {
                indicator.textContent = currentPlanSort.direction === 'asc' ? ' ▲' : ' ▼';
                th.classList.add('active-sort');
            } else {
                indicator.textContent = '';
                th.classList.remove('active-sort');
            }
        });
    }

    let listenersInitialized = false;

    function initHeaderListeners(onSortHandler) {
        if (listenersInitialized) return;
        listenersInitialized = true;

        // Global Event Delegation for all sortable headers across both tables
        document.addEventListener('click', (e) => {
            // 1. Right table: compare plans table headers
            const compareTh = e.target.closest('.compare-plans-table th[data-compare-sort], .compare-plans-table th.sortable-compare');
            if (compareTh) {
                const col = compareTh.dataset.compareSort || compareTh.dataset.sort;
                if (col) {
                    sortPlans(col, () => {
                        const { TableRenderer } = window.TableModule;
                        if (TableRenderer && typeof TableRenderer.renderCompareTable === 'function') {
                            TableRenderer.renderCompareTable();
                        } else if (typeof onSortHandler === 'function') {
                            onSortHandler();
                        }
                    });
                    return;
                }
            }

            // 2. Left table: current meal plan food headers
            const foodTh = e.target.closest('.meal-plan-table:not(.compare-plans-table) th.sortable');
            if (foodTh) {
                const col = foodTh.dataset.sort;
                if (col) {
                    sort(col, onSortHandler);
                }
            }
        });
    }

    // Attach convenience function to window
    window.sortTableModuleCompare = (col) => {
        sortPlans(col, () => {
            const { TableRenderer } = window.TableModule;
            if (TableRenderer && typeof TableRenderer.renderCompareTable === 'function') {
                TableRenderer.renderCompareTable();
            }
        });
    };

    return {
        getSortState,
        getCompareSortState,
        reset,
        resetCompare,
        sort,
        sortPlans,
        sortPlansList,
        updateHeaderUI,
        updateCompareHeaderUI,
        initHeaderListeners
    };
})();

// Auto-initialize header listeners as soon as DOM is interactive
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.TableModule.ColumnSort.initHeaderListeners();
        });
    } else {
        window.TableModule.ColumnSort.initHeaderListeners();
    }
}

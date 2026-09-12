/**
 * Meal Plan Table - Column Sorting Module
 * Sorts table rows by clicking column headers and maintains sort indicator state.
 */

window.TableModule = window.TableModule || {};

window.TableModule.ColumnSort = (function () {
    let currentSort = null; // { column: 'calories', direction: 'desc' }

    function getSortState() {
        return currentSort;
    }

    function reset() {
        currentSort = null;
        updateHeaderUI();
    }

    function sort(column, onSortedCallback) {
        const { DataStore } = window.TableModule;
        let direction = 'asc';

        if (currentSort && currentSort.column === column) {
            direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            direction = column === 'food' ? 'asc' : 'desc';
        }

        currentSort = { column, direction };

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

    function updateHeaderUI() {
        document.querySelectorAll('.meal-plan-table th.sortable').forEach(th => {
            const col = th.dataset.sort;
            const indicator = th.querySelector('.sort-indicator');
            if (!indicator) return;

            if (currentSort && currentSort.column === col) {
                indicator.textContent = currentSort.direction === 'asc' ? ' ▲' : ' ▼';
                th.classList.add('active-sort');
            } else {
                indicator.textContent = '';
                th.classList.remove('active-sort');
            }
        });
    }

    function initHeaderListeners(onSortHandler) {
        document.querySelectorAll('.meal-plan-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (col) {
                    sort(col, onSortHandler);
                }
            });
        });
    }

    return {
        getSortState,
        reset,
        sort,
        updateHeaderUI,
        initHeaderListeners
    };
})();

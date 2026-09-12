/**
 * Meal Plan Table - Data Store Module
 * Manages foods dataset, localStorage persistence, plan states, and nutrition math.
 */

window.TableModule = window.TableModule || {};

window.TableModule.DataStore = (function () {
    const STORAGE_KEY_STATE = 'mealPlannerState';
    const STORAGE_KEY_SAVED = 'mealPlannerSavedPlans';
    const STORAGE_KEY_SELECTED = 'mealPlannerSelectedTablePlan';

    // Internal State
    const state = {
        foods: [],
        savedPlans: [],
        currentActiveMeals: {
            meal1: [],
            meal2: [],
            meal3: []
        },
        currentActiveTableFoods: null,
        selectedPlanKey: '__current__'
    };

    // Helper: Escape HTML to avoid XSS
    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Helper: Safely parse numbers
    function safeNum(val, fallback = 0) {
        const num = parseFloat(val);
        return isNaN(num) ? fallback : num;
    }

    // Load Foods Dataset (resolves path regardless of whether in root or /table/)
    async function loadFoods() {
        const paths = [
            'data/foods.json',
            '../data/foods.json',
            '/data/foods.json'
        ];

        for (const p of paths) {
            try {
                const res = await fetch(`${p}?t=${Date.now()}`);
                if (res.ok) {
                    state.foods = await res.json();
                    return state.foods;
                }
            } catch (e) {
                // Continue to next fallback
            }
        }

        console.error('Failed to load foods database from all tested paths.');
        state.foods = [];
        return [];
    }

    // Load state from localStorage
    function loadFromStorage() {
        // 1. Saved Plans
        try {
            const saved = localStorage.getItem(STORAGE_KEY_SAVED);
            state.savedPlans = saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error loading saved plans:', e);
            state.savedPlans = [];
        }

        // 2. Active Plan
        try {
            const active = localStorage.getItem(STORAGE_KEY_STATE);
            if (active) {
                const parsed = JSON.parse(active);
                if (parsed.meals) {
                    state.currentActiveMeals = {
                        meal1: parsed.meals.meal1 || [],
                        meal2: parsed.meals.meal2 || [],
                        meal3: parsed.meals.meal3 || []
                    };
                }
                if (Array.isArray(parsed.tableFoods)) {
                    state.currentActiveTableFoods = parsed.tableFoods;
                } else if (parsed.meals) {
                    const list = [];
                    ['meal1', 'meal2', 'meal3'].forEach(k => {
                        (parsed.meals[k] || []).forEach(item => {
                            list.push({ ...item, mealType: k });
                        });
                    });
                    state.currentActiveTableFoods = list;
                }
            }
        } catch (e) {
            console.error('Error loading active plan:', e);
        }

        // 3. Selected Plan Key
        const savedKey = localStorage.getItem(STORAGE_KEY_SELECTED);
        if (savedKey && (savedKey === '__current__' || state.savedPlans.some(p => p.name === savedKey))) {
            state.selectedPlanKey = savedKey;
        } else {
            state.selectedPlanKey = '__current__';
        }
    }

    // Get current plan's table foods list (strictly preserves manual order)
    function getTableFoods() {
        let items = null;
        let mealsObj = null;

        if (state.selectedPlanKey === '__current__') {
            items = state.currentActiveTableFoods;
            mealsObj = state.currentActiveMeals;
        } else {
            const plan = state.savedPlans.find(p => p.name === state.selectedPlanKey);
            if (plan) {
                items = plan.tableFoods;
                mealsObj = plan.meals;
            }
        }

        if (Array.isArray(items)) {
            return [...items];
        }

        // Fallback: build from meals object
        const list = [];
        if (mealsObj) {
            ['meal1', 'meal2', 'meal3'].forEach(k => {
                if (Array.isArray(mealsObj[k])) {
                    mealsObj[k].forEach(item => {
                        list.push({
                            foodId: item.foodId,
                            weight: item.weight,
                            buy: !!item.buy,
                            splitDay: !!item.splitDay,
                            mealType: k
                        });
                    });
                }
            });
        }

        if (state.selectedPlanKey === '__current__') {
            state.currentActiveTableFoods = list;
        } else {
            const plan = state.savedPlans.find(p => p.name === state.selectedPlanKey);
            if (plan) plan.tableFoods = list;
        }

        return list;
    }

    // Save food items and preserve exact sequence
    function saveTableFoods(items) {
        // Synchronize backward-compatible meal buckets for Planner
        const mealsObj = { meal1: [], meal2: [], meal3: [] };
        items.forEach(item => {
            const mealKey = item.mealType || 'meal1';
            if (!mealsObj[mealKey]) mealsObj[mealKey] = [];
            mealsObj[mealKey].push({
                foodId: item.foodId,
                weight: item.weight,
                buy: !!item.buy,
                splitDay: !!item.splitDay
            });
        });

        if (state.selectedPlanKey === '__current__') {
            state.currentActiveTableFoods = [...items];
            state.currentActiveMeals = mealsObj;

            try {
                let existing = {};
                const saved = localStorage.getItem(STORAGE_KEY_STATE);
                if (saved) existing = JSON.parse(saved);
                existing.meals = mealsObj;
                existing.tableFoods = items;
                localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(existing));
            } catch (e) {
                console.error('Failed to save active plan:', e);
            }
        } else {
            const planIndex = state.savedPlans.findIndex(p => p.name === state.selectedPlanKey);
            if (planIndex >= 0) {
                state.savedPlans[planIndex].tableFoods = [...items];
                state.savedPlans[planIndex].meals = mealsObj;
                localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(state.savedPlans));
            }
        }
    }

    // Reorder items by moving an item from sourceIndex to targetIndex
    function reorderFoods(sourceIndex, targetIndex) {
        const items = getTableFoods();
        if (sourceIndex < 0 || sourceIndex >= items.length) return false;

        const [moved] = items.splice(sourceIndex, 1);

        if (sourceIndex < targetIndex) {
            targetIndex -= 1;
        }
        if (targetIndex < 0) targetIndex = 0;
        if (targetIndex > items.length) targetIndex = items.length;

        items.splice(targetIndex, 0, moved);
        saveTableFoods(items);
        return true;
    }

    // Add food item
    function addFood(foodId, weight) {
        const items = getTableFoods();
        items.push({
            foodId: foodId,
            weight: safeNum(weight, 100),
            buy: false,
            splitDay: false,
            mealType: 'meal1'
        });
        saveTableFoods(items);
    }

    // Update weight of an item
    function updateFoodWeight(index, newWeight) {
        const items = getTableFoods();
        if (items[index]) {
            items[index].weight = safeNum(newWeight, 100);
            saveTableFoods(items);
            return true;
        }
        return false;
    }

    // Remove item at index
    function removeFood(index) {
        const items = getTableFoods();
        if (items[index]) {
            items.splice(index, 1);
            saveTableFoods(items);
            return true;
        }
        return false;
    }

    // Create or update a meal plan (supports overwriting existing)
    function createOrUpdatePlan(name, copyCurrent = false, overwrite = false) {
        const trimmed = name.trim();
        if (!trimmed) throw new Error('Plan name cannot be empty.');
        if (trimmed === '__current__') throw new Error('Cannot use "__current__" as a plan name.');

        const existingIndex = state.savedPlans.findIndex(p => p.name.toLowerCase() === trimmed.toLowerCase());
        if (existingIndex >= 0 && !overwrite) {
            return { exists: true, planName: state.savedPlans[existingIndex].name };
        }

        let newTableFoods = [];
        let newMeals = { meal1: [], meal2: [], meal3: [] };

        if (copyCurrent) {
            newTableFoods = [...getTableFoods()];
            newMeals = JSON.parse(JSON.stringify(state.currentActiveMeals));
        } else if (existingIndex >= 0 && state.savedPlans[existingIndex].tableFoods) {
            newTableFoods = state.savedPlans[existingIndex].tableFoods;
            newMeals = state.savedPlans[existingIndex].meals || { meal1: [], meal2: [], meal3: [] };
        }

        const planData = {
            name: existingIndex >= 0 ? state.savedPlans[existingIndex].name : trimmed,
            date: new Date().toISOString(),
            tableFoods: newTableFoods,
            meals: newMeals,
            goals: (existingIndex >= 0 && state.savedPlans[existingIndex].goals) || { calories: 2000, protein: 150, carbs: 200, fat: 65 }
        };

        if (existingIndex >= 0) {
            state.savedPlans[existingIndex] = planData;
        } else {
            state.savedPlans.push(planData);
        }

        localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(state.savedPlans));
        setSelectedPlanKey(planData.name);
        return { exists: false, plan: planData };
    }

    function createPlan(name, copyCurrent = false) {
        return createOrUpdatePlan(name, copyCurrent, false);
    }

    // Delete a saved meal plan
    function deletePlan(name) {
        state.savedPlans = state.savedPlans.filter(p => p.name !== name);
        localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(state.savedPlans));
        if (state.selectedPlanKey === name) {
            setSelectedPlanKey('__current__');
        }
    }

    // Set saved plan as current active plan
    function setActivePlan(name) {
        const plan = state.savedPlans.find(p => p.name === name);
        if (!plan) return false;

        const items = plan.tableFoods || getTableFoods();
        state.currentActiveTableFoods = [...items];
        state.currentActiveMeals = JSON.parse(JSON.stringify(plan.meals || { meal1: [], meal2: [], meal3: [] }));

        try {
            let activeState = {};
            const saved = localStorage.getItem(STORAGE_KEY_STATE);
            if (saved) activeState = JSON.parse(saved);
            activeState.meals = state.currentActiveMeals;
            activeState.tableFoods = state.currentActiveTableFoods;
            if (plan.goals) activeState.goals = plan.goals;
            if (plan.profile) activeState.profile = plan.profile;
            localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(activeState));
        } catch (e) {
            console.error('Failed to set active plan in storage:', e);
        }

        setSelectedPlanKey('__current__');
        return true;
    }

    // Set selected plan key
    function setSelectedPlanKey(key) {
        state.selectedPlanKey = key;
        localStorage.setItem(STORAGE_KEY_SELECTED, key);
    }

    // Calculate row nutrition scaled by weight
    function calculateRowNutrition(food, weight) {
        const safeWeight = safeNum(weight, 100);
        const ratio = safeWeight / 100;

        return {
            weight: safeWeight,
            calories: food ? safeNum(food.calories) * ratio : 0,
            protein: food ? safeNum(food.protein) * ratio : 0,
            carbs: food ? safeNum(food.carbs) * ratio : 0,
            fat: food ? safeNum(food.fat) * ratio : 0,
            fiber: (food && food.fiber !== undefined) ? safeNum(food.fiber) * ratio : 0,
            price: food ? safeNum(food.price) * ratio : 0
        };
    }

    // Calculate grand totals across an array of food entries
    function calculateGrandTotals(items) {
        const totals = {
            weight: 0,
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
            price: 0
        };

        items.forEach(item => {
            const food = state.foods.find(f => f.id === item.foodId);
            const row = calculateRowNutrition(food, item.weight);
            totals.weight += row.weight;
            totals.calories += row.calories;
            totals.protein += row.protein;
            totals.carbs += row.carbs;
            totals.fat += row.fat;
            totals.fiber += row.fiber;
            totals.price += row.price;
        });

        return totals;
    }

    // Public API
    return {
        loadFoods,
        loadFromStorage,
        getFoods: () => state.foods,
        getFoodById: (id) => state.foods.find(f => f.id === id),
        getSavedPlans: () => state.savedPlans,
        getSelectedPlanKey: () => state.selectedPlanKey,
        setSelectedPlanKey,
        getTableFoods,
        saveTableFoods,
        reorderFoods,
        addFood,
        updateFoodWeight,
        removeFood,
        createPlan,
        createOrUpdatePlan,
        deletePlan,
        setActivePlan,
        calculateRowNutrition,
        calculateGrandTotals,
        escapeHTML,
        safeNum
    };
})();

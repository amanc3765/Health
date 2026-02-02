document.addEventListener('DOMContentLoaded', () => {
    // State
    const state = {
        foods: [],
        meals: {
            breakfast: [],
            lunch: [],
            snacks: [],
            dinner: []
        },
        goals: {
            calories: 2130,
            protein: 130,
            carbs: 284,
            fat: 61
        },
        profile: {
            weight: 86,
            height: 172,
            age: 30,
            gender: 'male',
            activity: '1.2',
            goalType: 'cut'
        }
    };

    // DOM Elements
    const elements = {
        foodList: document.getElementById('food-list'),
        mealColumns: document.querySelectorAll('.meal-column'),
        inputs: {
            calories: document.getElementById('goal-calories'),
            protein: document.getElementById('goal-protein'),
            carbs: document.getElementById('goal-carbs'),
            fat: document.getElementById('goal-fat')
        },
        profileInputs: {
            weight: document.getElementById('user-weight'),
            height: document.getElementById('user-height'),
            age: document.getElementById('user-age'),
            gender: document.getElementById('user-gender'),
            activity: document.getElementById('user-activity'),
            goal: document.getElementById('user-goal')
        },
        summaries: {
            calories: document.getElementById('summary-calories'),
            protein: document.getElementById('summary-protein'),
            carbs: document.getElementById('summary-carbs'),
            fat: document.getElementById('summary-fat')
        },
        btnCalculate: document.getElementById('btn-calculate'),
        btnReset: document.getElementById('btn-reset'),
        toggleSettings: document.getElementById('toggle-settings'),
        settingsPanel: document.getElementById('settings-panel')
    };

    // Initialization
    init();

    async function init() {
        // Theme
        document.body.classList.add('dark-mode');

        await loadFoods();
        setupEventListeners();
        loadFromLocalStorage(); // Load saved state
        // calculateAndSetGoals(); // Disabled to respect manual defaults
        renderFoodList();
        renderMeals();
        updateTotals();
    }

    async function loadFoods() {
        try {
            // Add timestamp to prevent caching
            const response = await fetch(`data/foods.json?t=${Date.now()}`);
            state.foods = await response.json();
        } catch (error) {
            console.error('Failed to load foods:', error);
            state.foods = [];
        }
    }

    // Storage Logic
    function saveToLocalStorage() {
        localStorage.setItem('mealPlannerState', JSON.stringify({
            meals: state.meals,
            goals: state.goals,
            profile: state.profile
        }));
    }

    function loadFromLocalStorage() {
        const saved = localStorage.getItem('mealPlannerState');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.meals) state.meals = parsed.meals;
                if (parsed.goals) state.goals = parsed.goals;
                if (parsed.profile) state.profile = parsed.profile;

                // Restore profile inputs
                if (elements.profileInputs.weight) elements.profileInputs.weight.value = state.profile.weight;
                if (elements.profileInputs.height) elements.profileInputs.height.value = state.profile.height;
                if (elements.profileInputs.age) elements.profileInputs.age.value = state.profile.age;
                if (elements.profileInputs.gender) elements.profileInputs.gender.value = state.profile.gender;
                if (elements.profileInputs.activity) elements.profileInputs.activity.value = state.profile.activity;
                if (elements.profileInputs.goal) elements.profileInputs.goal.value = state.profile.goalType;

                // Restore goal inputs
                if (elements.inputs.calories) elements.inputs.calories.value = state.goals.calories;
                if (elements.inputs.protein) elements.inputs.protein.value = state.goals.protein;
                if (elements.inputs.carbs) elements.inputs.carbs.value = state.goals.carbs;
                if (elements.inputs.fat) elements.inputs.fat.value = state.goals.fat;
            } catch (e) {
                console.error('Failed to load state', e);
            }
        }
    }

    function resetPlanner() {
        state.meals = {
            breakfast: [],
            lunch: [],
            snacks: [],
            dinner: []
        };
        saveToLocalStorage();
        renderMeals();
        updateTotals();
    }

    // Logic: Calculate Goals
    function calculateAndSetGoals() {
        // Get values from inputs (or state defaults)
        const weight = parseFloat(elements.profileInputs.weight.value) || 86;
        const height = parseFloat(elements.profileInputs.height.value) || 172;
        const age = parseFloat(elements.profileInputs.age.value) || 30;
        const gender = elements.profileInputs.gender.value;
        const activity = parseFloat(elements.profileInputs.activity.value) || 1.2;
        const goalType = elements.profileInputs.goal.value;

        // Update profile state
        state.profile = { weight, height, age, gender, activity, goalType };

        // Mifflin-St Jeor Equation
        let bmr = (10 * weight) + (6.25 * height) - (5 * age);
        if (gender === 'male') {
            bmr += 5;
        } else {
            bmr -= 161;
        }

        const tdee = bmr * activity;
        let targetCalories = tdee;

        if (goalType === 'cut') targetCalories -= 500;
        else if (goalType === 'bulk') targetCalories += 300;

        targetCalories = Math.round(targetCalories);

        // Macro Split (Moderate: 30% P / 35% C / 35% F for simplicity, or 2g/kg protein)
        // Let's use a standard "Gym" split: 2g Protein per kg bodyweight, 0.8g Fat per kg, rest Carbs.

        let protein = Math.round(weight * 2); // 2g per kg
        let fat = Math.round(weight * 0.8);   // 0.8g per kg

        // Calculate remaining calories for carbs
        const proteinCals = protein * 4;
        const fatCals = fat * 9;
        let carbCals = targetCalories - proteinCals - fatCals;

        // Safety check if carbs negative (unlikely with these numbers)
        if (carbCals < 0) carbCals = 0;

        let carbs = Math.round(carbCals / 4);

        // Update State & UI
        state.goals = { calories: targetCalories, protein, carbs, fat };

        elements.inputs.calories.value = targetCalories;
        elements.inputs.protein.value = protein;
        elements.inputs.carbs.value = carbs;
        elements.inputs.fat.value = fat;

        updateTotals();
        saveToLocalStorage();
    }

    // Rendering
    function renderFoodList() {
        elements.foodList.innerHTML = state.foods.map(food => `
            <div class="food-item" draggable="true" data-id="${food.id}">
                <div class="food-item-name">${food.name}</div>
                <div class="food-item-macros">${food.calories} kcal / 100g</div>
            </div>
        `).join('');

        // Add drag listeners to new items
        document.querySelectorAll('.food-item').forEach(item => {
            item.addEventListener('dragstart', handleDragStart);
        });
    }

    function renderMeals() {
        Object.keys(state.meals).forEach(mealType => {
            const container = document.getElementById(`meal-${mealType}`);
            container.innerHTML = '';

            state.meals[mealType].forEach((item, index) => {
                const food = state.foods.find(f => f.id === item.foodId);
                if (!food) return;

                const macros = calculateMacros(food, item.weight);

                const card = document.createElement('div');
                card.className = 'meal-food-card';
                // Drag start for reordering/copying could be added here
                card.draggable = true;
                // We transmit indices to allow checking source
                card.dataset.meal = mealType;
                card.dataset.index = index;

                card.innerHTML = `
                    <div class="meal-food-header">
                        <span class="meal-food-name">${food.name}</span>
                        <div style="display: flex; align-items: center; gap: 4px;">
                             <button class="copy-handle icon-btn" title="Duplicate (Click) or Copy to other meal (Drag)">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                             </button>
                             <button class="remove-btn icon-btn danger-icon-btn" onclick="removeFood('${mealType}', ${index})" title="Remove">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                             </button>
                        </div>
                    </div>
                    <div class="meal-food-inputs">
                        <input type="number" value="${item.weight}" min="0" onchange="updateFoodWeight('${mealType}', ${index}, this.value)">
                        <span>g</span>
                    </div>
                    <div class="meal-food-stats">
                        <div class="chip chip-cal">${Math.round(macros.calories)}</div>
                        <div class="chip chip-pro">${Math.round(macros.protein)}P</div>
                        <div class="chip chip-carb">${Math.round(macros.carbs)}C</div>
                        <div class="chip chip-fat">${Math.round(macros.fat)}F</div>
                    </div>
                `;

                // Copy Button (Click to Duplicate In-Place)
                const copyBtn = card.querySelector('.copy-handle');
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Duplicate current item in the same meal
                    state.meals[mealType].splice(index + 1, 0, {
                        foodId: item.foodId,
                        weight: item.weight
                    });
                    saveToLocalStorage();
                    renderMeals();
                    updateTotals();
                });

                // Keep Drag-to-Copy on the handle as well
                copyBtn.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData('application/json', JSON.stringify({
                        type: 'copy',
                        mealType: mealType,
                        index: index,
                        foodId: item.foodId,
                        weight: item.weight
                    }));
                    e.dataTransfer.effectAllowed = 'copy';
                });

                // Card Drag Start (MOVE)
                card.addEventListener('dragstart', (e) => {
                    // Ignore if dragging the copy handle (let its own listener handle it)
                    if (e.target.classList && e.target.classList.contains('copy-handle')) return;

                    e.dataTransfer.setData('application/json', JSON.stringify({
                        type: 'move',
                        mealType: mealType,
                        index: index,
                        foodId: item.foodId,
                        weight: item.weight
                    }));
                    e.dataTransfer.effectAllowed = 'move';
                    card.classList.add('dragging');
                });

                card.addEventListener('dragend', () => {
                    card.classList.remove('dragging');
                });

                container.appendChild(card);
            });
        });
    }

    function updateTotals() {
        const daily = { calories: 0, protein: 0, carbs: 0, fat: 0 };
        const mealTotals = {
            breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            lunch: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            snacks: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            dinner: { calories: 0, protein: 0, carbs: 0, fat: 0 }
        };

        // Calculate totals
        Object.keys(state.meals).forEach(mealType => {
            state.meals[mealType].forEach(item => {
                const food = state.foods.find(f => f.id === item.foodId);
                if (food) {
                    const macros = calculateMacros(food, item.weight);
                    daily.calories += macros.calories;
                    daily.protein += macros.protein;
                    daily.carbs += macros.carbs;
                    daily.fat += macros.fat;

                    mealTotals[mealType].calories += macros.calories;
                    mealTotals[mealType].protein += macros.protein;
                    mealTotals[mealType].carbs += macros.carbs;
                    mealTotals[mealType].fat += macros.fat;
                }
            });
        });

        // Update UI
        // Meal Totals
        Object.keys(mealTotals).forEach(mealType => {
            const el = document.getElementById(`total-${mealType}`);
            const m = mealTotals[mealType];
            el.innerHTML = `
                <div class="chip chip-cal" title="Calories">${Math.round(m.calories)}</div>
                <div class="chip chip-pro" title="Protein">${Math.round(m.protein)}P</div>
                <div class="chip chip-carb" title="Carbs">${Math.round(m.carbs)}C</div>
                <div class="chip chip-fat" title="Fat">${Math.round(m.fat)}F</div>
            `;
        });

        // Daily Summaries
        updateSummaryRow(elements.summaries.calories, daily.calories, state.goals.calories, '');
        updateSummaryRow(elements.summaries.protein, daily.protein, state.goals.protein, 'g');
        updateSummaryRow(elements.summaries.carbs, daily.carbs, state.goals.carbs, 'g');
        updateSummaryRow(elements.summaries.fat, daily.fat, state.goals.fat, 'g');
    }

    function updateSummaryRow(element, current, goal, unit) {
        if (!element) return;
        const fill = element.querySelector('.progress-bar-fill');
        const value = element.querySelector('.value');

        const percentage = Math.min((current / goal) * 100, 100);
        const isExceeded = current > goal;

        fill.style.width = `${percentage}%`;
        fill.classList.toggle('exceeded', isExceeded);

        value.textContent = `${Math.round(current)} / ${goal}${unit}`;
        value.classList.toggle('exceeded', isExceeded);
    }

    // Config / Helpers
    window.removeFood = (mealType, index) => {
        state.meals[mealType].splice(index, 1);
        saveToLocalStorage();
        renderMeals();
        updateTotals();
    };

    window.updateFoodWeight = (mealType, index, weight) => {
        const newWeight = parseFloat(weight) || 0;
        state.meals[mealType][index].weight = newWeight;
        saveToLocalStorage();
        renderMeals(); // Re-render to update macro text on card
        updateTotals();
    };



    function calculateMacros(food, weight) {
        const ratio = weight / 100;
        return {
            calories: food.calories * ratio,
            protein: food.protein * ratio,
            carbs: food.carbs * ratio,
            fat: food.fat * ratio
        };
    }

    // Drag and Drop Logic
    function handleDragStart(e) {
        // Distinguish between dragging new food vs existing food
        if (e.target.dataset.id) {
            // New food from list
            e.dataTransfer.setData('text/plain', e.target.dataset.id);
            e.dataTransfer.effectAllowed = 'copy';
        }
    }

    function setupEventListeners() {
        // Goal Inputs
        Object.keys(elements.inputs).forEach(key => {
            elements.inputs[key].addEventListener('change', (e) => {
                state.goals[key] = parseFloat(e.target.value) || 0;
                saveToLocalStorage();
                updateTotals();
            });
        });

        // Settings Buttons
        if (elements.toggleSettings) {
            elements.toggleSettings.addEventListener('click', () => {
                elements.settingsPanel.classList.toggle('hidden');
            });
        }

        if (elements.btnCalculate) {
            elements.btnCalculate.addEventListener('click', () => {
                calculateAndSetGoals();
            });
        }

        if (elements.btnReset) {
            elements.btnReset.addEventListener('click', resetPlanner);
        }

        // Drop Zones
        elements.mealColumns.forEach(col => {
            col.addEventListener('dragover', (e) => {
                e.preventDefault();
                // Respect the effectAllowed set during dragstart
                // If it's 'move', we must set dropEffect to 'move' to allow the drop
                const effect = e.dataTransfer.effectAllowed;
                e.dataTransfer.dropEffect = (effect === 'move' || effect === 'copyMove') ? 'move' : 'copy';
                col.querySelector('.meal-items').classList.add('drag-over');
            });

            col.addEventListener('dragleave', (e) => {
                col.querySelector('.meal-items').classList.remove('drag-over');
            });

            col.addEventListener('drop', (e) => {
                e.preventDefault();
                col.querySelector('.meal-items').classList.remove('drag-over');

                // Try JSON first (existing card)
                const jsonData = e.dataTransfer.getData('application/json');
                const textData = e.dataTransfer.getData('text/plain');
                const targetMealType = col.dataset.meal;

                if (jsonData) {
                    try {
                        const data = JSON.parse(jsonData);
                        if (data.type === 'existing' || data.type === 'copy') {
                            // Copying logic (or move if we wanted)
                            // User asked to "Copy" via drag? Or perhaps just move?
                            // Usually drag within app is Move, but User asked for Copy button.
                            // Let's implement Move for Drag, Copy for Button.

                            // Remove from old if different
                            // Actually, standard DND behavior:
                            // If same list -> reorder (not verified step)
                            // If diff list -> move

                            // For simplicity: Add to new, remove from old (Move)
                            // If user holds Ctrl, it's a Copy. 

                            // Let's simplfy: Just Add (Copy) if different meal, 
                            // because cleaning up old index after async modification is tricky without unique IDs.
                            // Better: Just implement 'Add New' logic if textData available.
                            // For 'existing' type, let's just do a Copy to be safe, 
                            // or Move. Let's do Copy as it is safer.

                            // Copy Logic
                            state.meals[targetMealType].push({
                                foodId: data.foodId,
                                weight: data.weight
                            });
                        } else if (data.type === 'move') {
                            // Move Logic
                            if (state.meals[data.mealType]) {
                                state.meals[data.mealType].splice(data.index, 1);
                            }
                            state.meals[targetMealType].push({
                                foodId: data.foodId,
                                weight: data.weight
                            });
                        }
                    } catch (e) { console.log('JSON parse error', e); }
                } else if (textData) {
                    // New Food
                    addFoodToMeal(textData, targetMealType);
                }

                // Update UI and Storage after any drop operation
                if (jsonData) {
                    saveToLocalStorage();
                    renderMeals();
                    updateTotals();
                }

            });
        });
    }

    function addFoodToMeal(foodId, mealType) {
        state.meals[mealType].push({
            foodId,
            weight: 100 // Default weight
        });
        saveToLocalStorage();
        renderMeals();
        updateTotals();
    }

    function addFoodToMeal(foodId, mealType) {
        state.meals[mealType].push({
            foodId,
            weight: 100 // Default weight
        });
        saveToLocalStorage();
        renderMeals();
        updateTotals();
    }
});

/**
 * Meal Plan Table - Nutrition Popover Module
 * Displays 100g reference nutrition from foods.json when clicking the 'i' button.
 */

window.TableModule = window.TableModule || {};

window.TableModule.NutritionPopover = (function () {
    let activeFoodId = null;
    let popoverEl = null;

    function getPopoverElement() {
        if (!popoverEl) {
            popoverEl = document.getElementById('food-100g-popover');
            if (!popoverEl) {
                popoverEl = document.createElement('div');
                popoverEl.id = 'food-100g-popover';
                popoverEl.className = 'food-100g-popover';
                document.body.appendChild(popoverEl);
            }
        }
        return popoverEl;
    }

    function show(triggerEl, foodId) {
        const popover = getPopoverElement();
        const { DataStore } = window.TableModule;
        const food = DataStore.getFoodById(foodId);
        if (!food) return;

        // Toggle off if clicking the same trigger
        if (activeFoodId === foodId && popover.classList.contains('visible')) {
            hide();
            return;
        }

        activeFoodId = foodId;

        const cal = DataStore.safeNum(food.calories);
        const pro = DataStore.safeNum(food.protein);
        const carb = DataStore.safeNum(food.carbs);
        const fat = DataStore.safeNum(food.fat);
        const fiber = food.fiber !== undefined ? DataStore.safeNum(food.fiber) : null;
        const ratio = food.calorie_to_protein_ratio !== undefined && food.calorie_to_protein_ratio !== null
            ? DataStore.safeNum(food.calorie_to_protein_ratio).toFixed(1)
            : '—';
        const defaultWeight = food.default_weight || 100;
        const price = food.price !== undefined ? `₹${food.price}` : '—';

        popover.innerHTML = `
            <div class="popover-header">
                <div>
                    <h4 class="popover-title">${DataStore.escapeHTML(food.name)}</h4>
                    <span class="popover-badge">Actual Nutrition per 100g (foods.json)</span>
                </div>
                <button type="button" class="popover-close-btn" title="Close" aria-label="Close">&times;</button>
            </div>
            <div class="popover-grid">
                <div class="popover-stat-card chip-cal">
                    <span class="popover-stat-val">${cal}</span>
                    <span class="popover-stat-lbl">Calories (kcal)</span>
                </div>
                <div class="popover-stat-card chip-pro">
                    <span class="popover-stat-val">${pro}g</span>
                    <span class="popover-stat-lbl">Protein</span>
                </div>
                <div class="popover-stat-card chip-carb">
                    <span class="popover-stat-val">${carb}g</span>
                    <span class="popover-stat-lbl">Carbs</span>
                </div>
                <div class="popover-stat-card chip-fat">
                    <span class="popover-stat-val">${fat}g</span>
                    <span class="popover-stat-lbl">Fat</span>
                </div>
                <div class="popover-stat-card">
                    <span class="popover-stat-val">${fiber !== null ? fiber + 'g' : '—'}</span>
                    <span class="popover-stat-lbl">Fiber</span>
                </div>
                <div class="popover-stat-card">
                    <span class="popover-stat-val">${ratio}</span>
                    <span class="popover-stat-lbl">Cal / Pro Ratio</span>
                </div>
            </div>
            <div class="popover-footer">
                <span>Default Weight: <strong>${defaultWeight}g</strong></span>
                <span>Price: <strong>${price}</strong></span>
            </div>
        `;

        // Close button listener
        const closeBtn = popover.querySelector('.popover-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                hide();
            });
        }

        // Screen positioning and boundary checks
        const rect = triggerEl.getBoundingClientRect();
        const popoverWidth = 290;
        let left = rect.right + 10;
        let top = rect.top - 20;

        if (left + popoverWidth > window.innerWidth - 10) {
            left = rect.left - popoverWidth - 10;
        }
        if (left < 10) left = 10;
        if (top < 10) top = 10;
        if (top + 280 > window.innerHeight) {
            top = Math.max(10, window.innerHeight - 300);
        }

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
        popover.classList.add('visible');
    }

    function hide() {
        if (popoverEl) {
            popoverEl.classList.remove('visible');
            activeFoodId = null;
        }
    }

    function initEvents() {
        // Delegate info button clicks
        document.addEventListener('click', (e) => {
            const infoBtn = e.target.closest('.food-info-btn');
            if (infoBtn) {
                e.stopPropagation();
                e.preventDefault();
                const foodId = infoBtn.dataset.foodId;
                show(infoBtn, foodId);
                return;
            }

            // Outside click closes popover
            const popover = getPopoverElement();
            if (popover && !popover.contains(e.target) && !e.target.closest('.food-info-btn')) {
                hide();
            }
        });

        // Close on scroll or Esc key
        window.addEventListener('scroll', hide, true);
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hide();
        });
    }

    return {
        show,
        hide,
        initEvents
    };
})();

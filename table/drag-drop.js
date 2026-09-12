/**
 * Meal Plan Table - Drag and Drop Reordering Module
 * Provides smooth drag-and-drop row sorting with top/bottom drop position indicator.
 */

window.TableModule = window.TableModule || {};

window.TableModule.DragDrop = (function () {
    let draggedIndex = null;

    function clearDragClasses() {
        document.querySelectorAll('.food-row.dragging, .drag-over-top, .drag-over-bottom').forEach(el => {
            el.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
        });
    }

    function attachListeners(onReorderedCallback) {
        const rows = document.querySelectorAll('.meal-plan-table tbody tr.food-row');
        const { DataStore, ColumnSort } = window.TableModule;

        rows.forEach(row => {
            row.addEventListener('dragstart', (e) => {
                // Prevent drag if interacting with buttons, inputs, or child controls
                if (e.target.closest('button') || e.target.closest('input')) {
                    e.preventDefault();
                    return;
                }
                const index = parseInt(row.dataset.index, 10);
                draggedIndex = index;
                e.dataTransfer.setData('text/plain', index.toString());
                e.dataTransfer.effectAllowed = 'move';
                row.classList.add('dragging');
            });

            row.addEventListener('dragend', () => {
                draggedIndex = null;
                clearDragClasses();
            });

            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                const rect = row.getBoundingClientRect();
                const relY = e.clientY - rect.top;

                if (relY < rect.height / 2) {
                    row.classList.add('drag-over-top');
                    row.classList.remove('drag-over-bottom');
                } else {
                    row.classList.add('drag-over-bottom');
                    row.classList.remove('drag-over-top');
                }
            });

            row.addEventListener('dragleave', (e) => {
                // Ignore if cursor moved to a nested child element inside the same row
                if (e.relatedTarget && row.contains(e.relatedTarget)) {
                    return;
                }
                row.classList.remove('drag-over-top', 'drag-over-bottom');
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                const isTop = row.classList.contains('drag-over-top');
                clearDragClasses();

                let sourceIndex = draggedIndex;
                if (sourceIndex === null || sourceIndex === undefined) {
                    const raw = e.dataTransfer.getData('text/plain');
                    sourceIndex = parseInt(raw, 10);
                }
                draggedIndex = null;

                if (isNaN(sourceIndex) || sourceIndex === null) return;

                let targetIndex = parseInt(row.dataset.index, 10);
                if (!isTop) {
                    targetIndex += 1;
                }

                if (sourceIndex === targetIndex || (isTop && sourceIndex === targetIndex - 1)) {
                    return;
                }

                const moved = DataStore.reorderFoods(sourceIndex, targetIndex);
                if (moved) {
                    if (ColumnSort) ColumnSort.reset();
                    if (typeof onReorderedCallback === 'function') {
                        onReorderedCallback();
                    }
                }
            });
        });
    }

    return {
        attachListeners
    };
})();

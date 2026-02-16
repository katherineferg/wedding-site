/**
 * Sandbox Module
 *
 * Renders the component tree inside the builder's main workspace. Each
 * component node is rendered as a collapsible card with a header, slot
 * containers, drop zones, and reorder handles.
 *
 * @module sandbox
 */

import { debugLog } from "../constants";
import { builderState } from "../state";
import type { ComponentInfo, ComponentNode, SlotDefinition } from "../types";
import { createDeleteButton } from "../utils/buttonHelpers";
import { createSlider } from "../utils/sliderHelpers";
import { openComponentPicker } from "./componentPicker";
import {
  canDropInSlot,
  handleDragEnd,
  handleDragStart,
  handleReorderDrop,
  parseDragData,
} from "./dragDrop";

/** Re-render callback for state changes */
let onRenderCallback: (() => void) | null = null;

/** Set the render callback */
export function setRenderCallback(callback: () => void): void {
  onRenderCallback = callback;
}

/** Render the sandbox with current component tree */
export function renderSandbox(sandbox: HTMLElement): void {
  sandbox.innerHTML = "";
  const tree = builderState.componentTree;

  // Render each root component (should just be custom-section)
  tree.forEach((node, index) => {
    const element = renderComponentNode(node, index);

    sandbox.appendChild(element);
  });

  updateSelection();
}

/** Render a single component node */
function renderComponentNode(node: ComponentNode, index: number): HTMLElement {
  const componentInfo = builderState.getComponentInfo(node._component);

  if (!componentInfo) {
    const fragment = document.createDocumentFragment();

    return fragment as unknown as HTMLElement;
  }

  const container = document.createElement("div");

  container.className = "sandbox-item";
  container.draggable = !node._isRootComponent;
  container.dataset.componentId = node.id;
  container.dataset.index = String(index);
  container.dataset.category = componentInfo.category;

  if (builderState.selectedComponentId === node.id) {
    container.classList.add("selected");
  }

  if (node._isRootComponent) {
    container.classList.add("root-component");
  }

  // Header
  const header = createComponentHeader(node, componentInfo);

  container.appendChild(header);

  // Slots
  if (componentInfo.slots && componentInfo.slots.length > 0) {
    const slotsContainer = document.createElement("div");

    slotsContainer.className = "sandbox-item-slots";

    for (const slot of componentInfo.slots) {
      const slotEl = createSlotElement(node, slot);

      slotsContainer.appendChild(slotEl);
    }

    container.appendChild(slotsContainer);
  }

  // Drag events
  container.addEventListener("dragstart", handleDragStart as EventListener);
  container.addEventListener("dragend", handleDragEnd as EventListener);

  // Selection
  container.addEventListener("click", (e) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).closest(".sandbox-item-btn")) return;
    selectComponent(node.id);
  });

  return container;
}

/** Create component header with name and actions */
function createComponentHeader(node: ComponentNode, componentInfo: ComponentInfo): HTMLElement {
  const header = document.createElement("div");

  header.className = "sandbox-item-header";

  const name = document.createElement("div");

  name.className = "sandbox-item-name";

  name.appendChild(document.createTextNode(componentInfo.displayName));

  const actions = document.createElement("div");

  actions.className = "sandbox-item-actions";

  // Delete button (not for root)
  if (!node._isRootComponent) {
    const deleteBtn = createDeleteButton(() => {
      deleteComponent(node.id);
    });

    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    actions.appendChild(deleteBtn);
  }

  header.appendChild(name);
  header.appendChild(actions);

  return header;
}

/** Create a slot element with mode toggle and content */
function createSlotElement(node: ComponentNode, slot: SlotDefinition): HTMLElement {
  const slotContainer = document.createElement("div");

  slotContainer.className = "slot-container";

  // Header with toggle
  const header = document.createElement("div");

  header.className = "slot-header-switchable";

  const label = document.createElement("span");

  label.className = "slot-label";
  label.textContent = slot.label;

  // Mode toggle
  const modeKey = `_${slot.propName}_mode`;

  if (!node[modeKey]) {
    node[modeKey] = "components";
  }
  const currentMode = node[modeKey] as string;

  const toggleWrapper = document.createElement("div");

  toggleWrapper.className = "slot-toggle-wrapper";

  const toggleLabel = document.createElement("span");

  toggleLabel.className = "slot-toggle-label";
  toggleLabel.textContent = "Editor freeform";

  const toggle = createModeToggle(currentMode === "prop", () => {
    builderState.toggleSlotMode(node.id, slot.propName);
    // Delay render to allow slider animation to complete (350ms)
    setTimeout(() => triggerRender(), 350);
  });

  toggleWrapper.appendChild(toggleLabel);
  toggleWrapper.appendChild(toggle);

  header.appendChild(label);
  header.appendChild(toggleWrapper);
  slotContainer.appendChild(header);

  // Content
  const content = document.createElement("div");

  content.className = "slot-content";
  content.dataset.slotName = slot.propName;
  content.dataset.parentId = node.id;

  if (currentMode === "prop") {
    renderSlotAsProp(content, slot);
  } else {
    renderSlotAsComponents(content, node, slot);
  }

  slotContainer.appendChild(content);

  return slotContainer;
}

/** Create mode toggle switch */
function createModeToggle(checked: boolean, onChange: () => void): HTMLElement {
  const slider = createSlider(checked, onChange);

  slider.title = "Toggle between visual editing and freeform data editing";
  return slider;
}

/** Render slot in prop mode (freeform) */
function renderSlotAsProp(container: HTMLElement, slot: SlotDefinition): void {
  const message = document.createElement("div");

  message.className = "slot-data-mode-message";
  message.innerHTML = `
    <p><strong>${slot.label}</strong> is in data editing mode</p>
    <p class="slot-data-hint">Edit the structure in the properties panel on the right →</p>
  `;
  container.appendChild(message);
}

/** Render slot with component children */
function renderSlotAsComponents(
  container: HTMLElement,
  node: ComponentNode,
  slot: SlotDefinition
): void {
  const nestedNodes = (node[slot.propName] as ComponentNode[]) || [];

  // Always create a drop zone at the top (for empty or populated slots)
  container.appendChild(createReorderDropZone(node, slot, 0));

  if (nestedNodes.length > 0) {
    nestedNodes.forEach((nestedNode, idx) => {
      const element = renderComponentNode(nestedNode, idx);

      container.appendChild(element);
      container.appendChild(createReorderDropZone(node, slot, idx + 1));
    });
  }

  // Add button at bottom
  container.appendChild(createDropZoneButton(node, slot, nestedNodes.length));
}

/** Create add component button */
function createDropZoneButton(
  parentNode: ComponentNode,
  slot: SlotDefinition,
  insertIndex: number
): HTMLElement {
  if (!parentNode[slot.propName]) {
    parentNode[slot.propName] = [];
  }

  const button = document.createElement("button");

  button.type = "button";
  button.className = "drop-zone-button";
  button.dataset.insertIndex = String(insertIndex);
  button.dataset.parentId = parentNode.id;
  button.dataset.slotName = slot.propName;

  const icon = document.createElement("span");

  icon.className = "drop-zone-icon";
  icon.textContent = "+";

  const text = document.createElement("span");

  text.className = "drop-zone-text";
  text.textContent = `Add to ${slot.label}`;

  button.appendChild(icon);
  button.appendChild(text);

  // Click to open picker
  button.addEventListener("click", () => {
    openComponentPicker(insertIndex, parentNode.id, slot.propName, slot, triggerRender);
  });

  // Drag support
  button.addEventListener("dragover", (e) => {
    const dragSource = builderState.dragSource;

    if (!dragSource) return;

    if (dragSource.type === "palette") {
      e.preventDefault();
      e.stopPropagation();
      button.classList.remove("drop-not-allowed");
    } else if (dragSource.type === "reorder" && dragSource.nodeId) {
      e.preventDefault();
      e.stopPropagation();

      // Check for circular dependency
      if (builderState.isNodeAncestorOf(dragSource.nodeId, parentNode.id)) {
        button.classList.add("drop-not-allowed");
        return;
      }

      // Check slot restrictions
      const nodeToMove = builderState.findComponentNode(dragSource.nodeId);

      if (nodeToMove) {
        const componentInfo = builderState.getComponentInfo(nodeToMove._component);

        if (componentInfo && !canDropInSlot(componentInfo, slot)) {
          button.classList.add("drop-not-allowed");
          return;
        }
      }

      button.classList.remove("drop-not-allowed");
    }
  });

  button.addEventListener("dragleave", (e) => {
    if (!button.contains(e.relatedTarget as Node)) {
      button.classList.remove("drop-not-allowed");
    }
  });

  button.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't allow drop if marked as not allowed
    if (button.classList.contains("drop-not-allowed")) {
      button.classList.remove("drop-not-allowed");
      return;
    }

    button.classList.remove("drop-not-allowed");

    const data = parseDragData(e);

    if (data?.type === "palette" && data.componentPath) {
      const componentInfo = builderState.getComponentInfo(data.componentPath);

      if (!componentInfo) return;

      if (!canDropInSlot(componentInfo, slot)) return;

      // Use state manager to add component (this will emit treeChange)
      const componentNode = builderState.addComponentToSlot(
        componentInfo,
        parentNode.id,
        slot.propName,
        insertIndex
      );

      // Select the newly added component
      builderState.selectedComponentId = componentNode.id;

      triggerRender();
    } else if (data?.type === "reorder" && data.nodeId) {
      handleReorderDrop(data.nodeId, parentNode.id, slot.propName, insertIndex);
      triggerRender();
    }
  });

  return button;
}

/** Create invisible reorder drop zone */
function createReorderDropZone(
  parentNode: ComponentNode,
  slot: SlotDefinition,
  insertIndex: number
): HTMLElement {
  if (!parentNode[slot.propName]) {
    parentNode[slot.propName] = [];
  }

  const dropZone = document.createElement("div");

  dropZone.className = "reorder-drop-zone";
  dropZone.dataset.insertIndex = String(insertIndex);
  dropZone.dataset.parentId = parentNode.id;
  dropZone.dataset.slotName = slot.propName;

  dropZone.addEventListener("dragover", (e) => {
    if (builderState.dragSource?.type === "reorder") {
      e.preventDefault();
      e.stopPropagation();

      const nodeId = builderState.dragSource.nodeId;

      if (!nodeId) return;

      // Check for circular dependency (dropping into itself or its descendants)
      if (builderState.isNodeAncestorOf(nodeId, parentNode.id)) {
        dropZone.classList.add("drop-not-allowed");
        dropZone.classList.remove("active");
        return;
      }

      // Check if drop is allowed based on slot restrictions
      if (slot.allowedComponents && slot.allowedComponents.length > 0) {
        const nodeToMove = builderState.findComponentNode(nodeId);

        if (nodeToMove) {
          const componentInfo = builderState.getComponentInfo(nodeToMove._component);

          if (componentInfo && !canDropInSlot(componentInfo, slot)) {
            dropZone.classList.add("drop-not-allowed");
            dropZone.classList.remove("active");
            return;
          }
        }
      }

      dropZone.classList.remove("drop-not-allowed");
      dropZone.classList.add("active");
    }
  });

  dropZone.addEventListener("dragleave", (e) => {
    if (!dropZone.contains(e.relatedTarget as Node)) {
      dropZone.classList.remove("active", "drop-not-allowed");
    }
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't allow drop if marked as not allowed
    if (dropZone.classList.contains("drop-not-allowed")) {
      dropZone.classList.remove("drop-not-allowed");
      return;
    }

    dropZone.classList.remove("active", "drop-not-allowed");

    const data = parseDragData(e);

    if (data?.type === "reorder" && data.nodeId) {
      handleReorderDrop(data.nodeId, parentNode.id, slot.propName, insertIndex);
      triggerRender();
    }
  });

  return dropZone;
}

/** Update selection state in DOM */
function updateSelection(): void {
  document.querySelectorAll(".sandbox-item").forEach((item) => {
    const el = item as HTMLElement;

    el.classList.toggle("selected", el.dataset.componentId === builderState.selectedComponentId);
  });
}

/** Select a component */
function selectComponent(id: string): void {
  debugLog("Selecting component:", id);
  builderState.selectedComponentId = id;
  updateSelection();
}

/** Delete a component */
function deleteComponent(id: string): void {
  builderState.deleteComponent(id);
  triggerRender();
}

/** Trigger a re-render */
function triggerRender(): void {
  onRenderCallback?.();
}

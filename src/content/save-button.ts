const BUTTON_SIZE = 34;
const BUTTON_MARGIN = 8;

export type SaveButtonState = "saving" | "saved" | "skipped" | "failed";

export type SaveButton = {
  element: HTMLButtonElement;
  hide: () => void;
  setState: (state: SaveButtonState) => void;
  showForViewportRect: (rect: DOMRect) => void;
};

export function createSaveButton(): SaveButton {
  const host = document.createElement("div");
  host.id = "x-image-downloader-root";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        z-index: 2147483647;
        pointer-events: none;
      }

      button {
        position: absolute;
        width: ${BUTTON_SIZE}px;
        height: ${BUTTON_SIZE}px;
        display: none;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.9);
        color: white;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
        cursor: pointer;
        pointer-events: auto;
        font: 700 18px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      button:hover {
        background: rgba(2, 6, 23, 0.96);
      }
    </style>
    <button type="button" title="Save image" aria-label="Save image">↓</button>
  `;

  const button = shadow.querySelector("button");

  if (!button) {
    throw new Error("Failed to create save button.");
  }

  return {
    element: button,
    hide: () => {
      button.style.display = "none";
    },
    setState: (state) => {
      setButtonState(button, state);
    },
    showForViewportRect: (rect) => {
      const viewportTop = Math.max(BUTTON_MARGIN, rect.top + BUTTON_MARGIN);
      const viewportLeft = Math.min(
        window.innerWidth - BUTTON_SIZE - BUTTON_MARGIN,
        rect.right - BUTTON_SIZE - BUTTON_MARGIN,
      );

      button.style.top = `${window.scrollY + viewportTop}px`;
      button.style.left = `${window.scrollX + Math.max(BUTTON_MARGIN, viewportLeft)}px`;
      button.style.display = "flex";
    },
  };
}

function setButtonState(button: HTMLButtonElement, state: SaveButtonState): void {
  if (state === "saving") {
    button.textContent = "...";
    return;
  }

  if (state === "saved") {
    button.textContent = "✓";
  } else if (state === "skipped") {
    button.textContent = "-";
  } else {
    button.textContent = "!";
  }

  window.setTimeout(() => {
    button.textContent = "↓";
  }, 900);
}

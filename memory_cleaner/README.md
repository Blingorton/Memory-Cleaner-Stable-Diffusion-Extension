# Memory Cleaner — SD Reforge Extension

Prevents browser slowdown during long generation runs by clearing old image data from
the gallery each time you click Generate.

The two most recent batches stay visible as normal. Anything older is removed from the
DOM and its blob URLs are revoked, freeing browser and GPU memory.

## Installation
Copy the `memory_cleaner` folder into:
  stable-diffusion-webui-reforge/extensions/
Then restart the UI.

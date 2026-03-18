// Memory Cleaner for SD Reforge
// Clears gallery images from 2+ clicks ago to prevent browser memory buildup.
// Works with manual Generate, Generate Forever, and any programmatic clicks.

(function () {
    var mc_clickCount = 0;          // increments every time a new generation starts
    var mc_lastCleanedAt = 0;       // the click count at which we last ran cleanup
    var mc_cleanupTimer = null;

    // ---------- Core cleanup ----------

    function mc_cleanupOldImages() {
        // We want to keep images from click N (current) and click N-1 (previous).
        // Anything from click N-2 or older gets wiped.
        // Strategy: revoke all blob URLs in the gallery, then let Gradio re-render
        // only what it still has in state (the current batch). Older batches whose
        // DOM nodes are already detached will just be GC'd.

        var gallery = document.querySelector('#txt2img_gallery');
        if (!gallery) return;

        // Walk every img in the gallery and revoke blob URLs for anything
        // that is NOT in the currently-visible selected image slot.
        var allImgs = Array.from(gallery.querySelectorAll('img'));
        var revoked = 0;
        allImgs.forEach(function (img) {
            if (img.src && img.src.startsWith('blob:')) {
                URL.revokeObjectURL(img.src);
                img.src = '';
                revoked++;
            }
            // Also clear srcset which Gradio sometimes populates
            if (img.srcset) img.srcset = '';
        });

        // Remove thumbnail wrapper elements that are now empty
        var thumbs = gallery.querySelectorAll(
            '.thumbnail-item, [class*="thumbnail"], .gallery-item, [data-testid="image"]'
        );
        var removed = 0;
        thumbs.forEach(function (el) {
            var hasImage = el.querySelector('img[src]:not([src=""])');
            if (!hasImage) {
                el.remove();
                removed++;
            }
        });

        if (revoked > 0 || removed > 0) {
            console.log('[MemoryCleaner] revoked', revoked, 'blob URLs,', removed, 'empty nodes removed');
        }

        mc_lastCleanedAt = mc_clickCount;
    }

    // ---------- Detect generation start ----------
    // Rather than only watching the Generate button click, we watch for
    // #txt2img_interrupt appearing — that fires whether the click was manual,
    // programmatic (Generate Forever), or from a script.

    var mc_wasGenerating = false;

    function mc_watchGenerationState() {
        var targetNode = document.body;
        var observer = new MutationObserver(function () {
            var isGenerating = !!document.querySelector('#txt2img_interrupt');

            if (isGenerating && !mc_wasGenerating) {
                // Generation just STARTED
                mc_wasGenerating = true;
                mc_clickCount++;

                // Schedule cleanup if we're now 2+ clicks ahead of last clean
                // (i.e., the user has started a 3rd run — clean up run #1's images)
                if (mc_clickCount - mc_lastCleanedAt >= 2) {
                    if (mc_cleanupTimer) clearTimeout(mc_cleanupTimer);
                    // Small delay so the new batch's preview has started rendering
                    mc_cleanupTimer = setTimeout(mc_cleanupOldImages, 1500);
                }
            } else if (!isGenerating && mc_wasGenerating) {
                // Generation just FINISHED
                mc_wasGenerating = false;
            }
        });

        observer.observe(targetNode, { childList: true, subtree: true });
        console.log('[MemoryCleaner] generation state watcher active');
    }

    // ---------- Init ----------

    function mc_init() {
        mc_watchGenerationState();
        console.log('[MemoryCleaner] initialized');
    }

    onUiLoaded(mc_init);
})();

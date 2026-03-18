// Memory Cleaner for SD Reforge
// Tracks blob URLs produced each generation run and revokes them
// once they are 2 runs old AND no longer referenced by any live img element.
// Works with manual Generate, Generate Forever, and any programmatic clicks.

(function () {
    // Ring buffer: index 0 = current run's URLs, index 1 = previous run's URLs.
    // On run N+1 starting, index 1 is evicted (revoked if not live), then
    // index 0 becomes index 1, and a fresh Set goes into index 0.
    var mc_urlRing = [new Set(), new Set()]; // [current, previous]
    var mc_wasGenerating = false;

    // ---------- Snapshot URLs currently live in the gallery ----------

    function mc_getLiveUrls() {
        var live = new Set();
        document.querySelectorAll('#txt2img_gallery img').forEach(function (img) {
            if (img.src && img.src.startsWith('blob:')) live.add(img.src);
            if (img.srcset) {
                img.srcset.split(',').forEach(function (part) {
                    var url = part.trim().split(' ')[0];
                    if (url.startsWith('blob:')) live.add(url);
                });
            }
        });
        return live;
    }

    // ---------- Collect all blob URLs currently in the gallery into current slot ----------

    function mc_snapshotCurrentUrls() {
        mc_getLiveUrls().forEach(function (url) {
            mc_urlRing[0].add(url);
        });
    }

    // ---------- Rotate ring and evict the oldest slot ----------

    function mc_rotateAndEvict() {
        // Anything in slot 1 (two runs old) that is not currently live can be revoked
        var liveNow = mc_getLiveUrls();
        var evicted = 0;
        mc_urlRing[1].forEach(function (url) {
            if (!liveNow.has(url)) {
                URL.revokeObjectURL(url);
                evicted++;
            }
        });
        if (evicted > 0) {
            console.log('[MemoryCleaner] revoked', evicted, 'stale blob URLs');
        }

        // Rotate: old slot 0 becomes slot 1, fresh Set becomes slot 0
        mc_urlRing[1] = mc_urlRing[0];
        mc_urlRing[0] = new Set();
    }

    // ---------- Detect generation start/end via interrupt button ----------

    function mc_watchGenerationState() {
        var mc_checkPending = false;

        function mc_checkState() {
            mc_checkPending = false;
            // Reforge shows #txt2img_interrupt (and hides it via .hidden or display:none)
            // when generation is running. Check for its visible presence.
            var interruptBtn = document.querySelector('#txt2img_interrupt');
            var isGenerating = !!interruptBtn &&
                getComputedStyle(interruptBtn).display !== 'none' &&
                getComputedStyle(interruptBtn).visibility !== 'hidden';

            if (isGenerating && !mc_wasGenerating) {
                mc_wasGenerating = true;
                mc_rotateAndEvict();
            } else if (!isGenerating && mc_wasGenerating) {
                mc_wasGenerating = false;
                mc_snapshotCurrentUrls();
            }
        }

        // Watch document.body but debounce via requestAnimationFrame so we
        // run at most once per frame regardless of mutation volume.
        var observer = new MutationObserver(function () {
            if (!mc_checkPending) {
                mc_checkPending = true;
                requestAnimationFrame(mc_checkState);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
        console.log('[MemoryCleaner] generation state watcher active');
    }

    // ---------- Init ----------

    function mc_init() {
        mc_watchGenerationState();
        console.log('[MemoryCleaner] initialized');
    }

    onUiLoaded(mc_init);
})();

import { useEffect, useRef } from 'react';

export function useBackgroundCleanup() {
  const workerRef = useRef<Worker | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 1. Initialize background worker
    const worker = new Worker('/workers/cleanup-worker.js');
    workerRef.current = worker;

    worker.onmessage = (event) => {
      if (event.data.success) {
        console.log('Veilo Local Database Cleanup successfully complete.');
      } else {
        console.warn('Veilo Local Database Cleanup completed with errors:', event.data.error);
      }
    };

    // 2. Pause/Resume message dispatchers
    const pauseWorker = () => {
      worker.postMessage({ action: 'PAUSE' });
    };

    const resumeWorker = () => {
      worker.postMessage({ action: 'RESUME' });
    };

    // 3. Scroll debounce: pauses on scroll start, resumes 1.5s after scrolling stops
    const handleScrollActivity = () => {
      pauseWorker();
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        resumeWorker();
      }, 1500);
    };

    const handleTouchStart = () => {
      pauseWorker();
    };

    const handleTouchEnd = () => {
      // Small buffer to let touch inertia animations finish before resuming
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        resumeWorker();
      }, 1000);
    };

    // 4. Run cleanup on Tab/App minimizing
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        worker.postMessage({
          action: 'RUN_CLEANUP',
          adaptiveThresholds: {
            groupMax: 300,
            directMax: 400,
            mediaLimit: 50
          }
        });
      } else if (document.visibilityState === 'visible') {
        // Safe check to ensure worker is ready when returning to active screen
        resumeWorker();
      }
    };

    // Attach listeners across window and document
    window.addEventListener('scroll', handleScrollActivity, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('scroll', handleScrollActivity);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      worker.terminate();
    };
  }, []);
}

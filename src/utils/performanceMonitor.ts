export const measurePerformance = (label: string, fn: () => void) => {
  const start = performance.now();
  fn();
  const end = performance.now();
  console.log(`Performance [${label}]: ${end - start}ms`);
};

export const usePerformanceMonitor = (componentName: string) => {
  const start = performance.now();
  return () => {
    const end = performance.now();
    const duration = end - start;
    // Log if exceeds targets (2s for list, 1s for details)
    if (duration > 1000) {
      console.warn(`Performance Warning [${componentName}]: took ${duration}ms`);
    } else {
      console.debug(`Performance [${componentName}]: ${duration}ms`);
    }
  };
};

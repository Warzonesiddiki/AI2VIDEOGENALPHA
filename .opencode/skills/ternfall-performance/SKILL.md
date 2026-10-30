---
name: ternfall-performance
description: Investigate performance and resource limits in large local plans, media and React views.
---

# Ternfall Performance

1. Measure before changing behavior. Trace data volume, serialization, copies, synchronous SQLite work, decode costs and browser rendering.
2. Establish conservative bounds for inputs, concurrent work, output and disk scratch; distinguish pagination on the wire from backend streaming.
3. Test responsiveness and memory with isolated representative fixtures, including failure and cancellation. Avoid weakening integrity validation for speed.
4. Document dataset, hardware, browser and remaining scaling assumptions; do not extrapolate one benchmark to production capacity.

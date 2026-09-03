# ADR 002 — Preserve source disagreement

**Status:** accepted

Weighted averaging can make two confident, incompatible sources look like one precise middle estimate. When any two intervals in a cell do not overlap, stress tests retain the full minimum-to-maximum span and mark it disputed.

The engine becomes less decisive when evidence conflicts. One poor outlier can widen the result, so inclusion, reliability and source-removal experiments stay visible.

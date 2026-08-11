// Package metrics exposes Prometheus collectors.
//
// Phase 0: relies on the default process / Go runtime collectors registered
// by promhttp.Handler(). Phase 1 adds request_duration_seconds, request_total,
// db_query_duration_seconds, redis_op_duration_seconds, etc.
package metrics

// Registered is a sentinel kept so callers can reference the package without
// pulling in additional dependencies. It is intentionally unused.
var Registered = true

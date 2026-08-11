// Package logger wraps zap with the conventions used by apps/api.
//
// Output format: structured JSON in production, console-friendly in development.
// Field names are stable across log lines so log aggregators can rely on them.
package logger

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// New returns a configured *zap.Logger.
func New(env string) (*zap.Logger, error) {
	if env == "production" {
		cfg := zap.NewProductionConfig()
		cfg.EncoderConfig.TimeKey = "ts"
		cfg.EncoderConfig.LevelKey = "level"
		cfg.EncoderConfig.MessageKey = "msg"
		cfg.EncoderConfig.CallerKey = "caller"
		cfg.EncoderConfig.StacktraceKey = "stacktrace"
		return cfg.Build(zap.AddCallerSkip(0))
	}

	// Development: human-readable console.
	cfg := zap.NewDevelopmentConfig()
	cfg.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	cfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	return cfg.Build()
}

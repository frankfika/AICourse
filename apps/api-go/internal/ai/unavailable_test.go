package ai

import (
	"context"
	"errors"
	"testing"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/stretchr/testify/require"
)

func requireUnavailable(t *testing.T, err error) {
	t.Helper()
	var appErr *errs.AppError
	require.Error(t, err)
	require.True(t, errors.As(err, &appErr))
	require.Equal(t, 503, appErr.StatusCode)
	require.Equal(t, "SERVICE_UNAVAILABLE", appErr.Code)
}

func TestUnavailableCapabilitiesNeverReturnFakeSuccess(t *testing.T) {
	service := &Service{}

	probe, err := service.TestConnection(context.Background())
	require.Nil(t, probe)
	requireUnavailable(t, err)

	course, err := service.GenerateCourse(context.Background(), GenerateCourseInput{Topic: "RAG"})
	require.Zero(t, course)
	requireUnavailable(t, err)

	degree, err := service.GenerateDegree(context.Background(), GenerateDegreeInput{Topic: "AI Engineering"})
	require.Zero(t, degree)
	requireUnavailable(t, err)
}

func TestUnavailableGenerationStillValidatesInput(t *testing.T) {
	service := &Service{}

	_, err := service.GenerateCourse(context.Background(), GenerateCourseInput{})
	var appErr *errs.AppError
	require.ErrorAs(t, err, &appErr)
	require.Equal(t, 400, appErr.StatusCode)

	_, err = service.GenerateDegree(context.Background(), GenerateDegreeInput{})
	require.ErrorAs(t, err, &appErr)
	require.Equal(t, 400, appErr.StatusCode)
}

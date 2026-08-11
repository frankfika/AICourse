package cms

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/go-sql-driver/mysql"
)

func TestAppSettingViewUsesNestJSFieldName(t *testing.T) {
	b, err := json.Marshal(AppSettingView{Key: "feature.x", Value: json.RawMessage(`true`)})
	if err != nil {
		t.Fatalf("marshal AppSettingView: %v", err)
	}

	var got map[string]json.RawMessage
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("decode AppSettingView: %v", err)
	}
	if _, ok := got["valueJson"]; !ok {
		t.Fatalf("AppSettingView must expose Prisma/NestJS field valueJson: %s", b)
	}
	if _, ok := got["value"]; ok {
		t.Fatalf("AppSettingView must not expose site-setting field value: %s", b)
	}
}

func TestWriteErrorMapsMySQLDuplicateToConflict(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want int
	}{
		{"direct duplicate", &mysql.MySQLError{Number: 1062, Message: "Duplicate entry"}, 409},
		{"wrapped duplicate", fmt.Errorf("insert cms row: %w", &mysql.MySQLError{Number: 1062, Message: "Duplicate entry"}), 409},
		{"other mysql error", &mysql.MySQLError{Number: 1064, Message: "syntax error"}, 500},
		{"generic error", errors.New("database unavailable"), 500},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := writeError("create cms resource", tc.err)
			var appErr *errs.AppError
			if !errors.As(got, &appErr) {
				t.Fatalf("writeError() = %T, want *errs.AppError", got)
			}
			if appErr.StatusCode != tc.want {
				t.Fatalf("status = %d, want %d", appErr.StatusCode, tc.want)
			}
		})
	}
}

func TestNullableViewFieldsSerializeAsNull(t *testing.T) {
	cases := []struct {
		name string
		view any
		keys []string
	}{
		{"app setting", AppSettingView{}, []string{"description"}},
		{"site setting", SiteSettingView{}, []string{"description"}},
		{"page setting", PageSettingView{}, []string{"description"}},
		{"enum translation", EnumTranslationView{}, []string{"colorClass", "icon"}},
		{"industry", IndustryView{}, []string{"description", "icon", "methodology"}},
		{"testimonial", TestimonialView{}, []string{"avatar"}},
		{"top nav", TopNavItemView{}, []string{"icon"}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			b, err := json.Marshal(tc.view)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			var got map[string]json.RawMessage
			if err := json.Unmarshal(b, &got); err != nil {
				t.Fatalf("decode: %v", err)
			}
			for _, key := range tc.keys {
				value, ok := got[key]
				if !ok {
					t.Errorf("nullable Prisma field %q was omitted: %s", key, b)
					continue
				}
				if string(value) != "null" {
					t.Errorf("nullable Prisma field %q = %s, want null", key, value)
				}
			}
		})
	}
}

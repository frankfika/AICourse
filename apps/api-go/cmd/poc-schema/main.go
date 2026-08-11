// poc-schema — Phase 0 T4: Prisma→sqlc end-to-end smoke test.
//
// Goal: prove the schema translation is loss-less by:
//  1. Connecting to the scratch MySQL with the DDL applied
//  2. Calling GetUserByID with a fake UUID → expect sql.ErrNoRows
//  3. Calling CreateUser with a fresh row
//  4. Calling GetUserByID again → expect the row to come back
//  5. Cleaning up the row before exit
//
// Output is a single PASS / FAIL line, suitable for CI consumption.
package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"

	_ "github.com/go-sql-driver/mysql"
)

func main() {
	exit := run()
	os.Exit(exit)
}

func run() int {
	dsn := os.Getenv("POC_DATABASE_URL")
	if dsn == "" {
		// Match the docker-compose default; override via env if needed.
		dsn = "ai_academy:ai_academy_pass@tcp(127.0.0.1:3307)/ai_academy_go_poc?parseTime=true"
	}

	conn, err := sql.Open("mysql", dsn)
	if err != nil {
		fmt.Printf("FAIL sql.Open: %v\n", err)
		return 1
	}
	defer conn.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := conn.PingContext(ctx); err != nil {
		fmt.Printf("FAIL ping: %v\n", err)
		return 1
	}

	q := db.New(conn)
	fakeID := uuid.NewString()
	email := fmt.Sprintf("poc-%s@example.invalid", uuid.NewString()[:8])

	// Step 1: GetUserByID for a brand-new UUID must yield ErrNoRows.
	if _, err := q.GetUserByID(ctx, fakeID); !errors.Is(err, sql.ErrNoRows) {
		fmt.Printf("FAIL GetUserByID pre-create: want sql.ErrNoRows, got %v\n", err)
		return 1
	}
	fmt.Println("step 1/4 ok — pre-create GetUserByID returned ErrNoRows")

	// Step 2: CreateUser.
	now := time.Now().UTC()
	_, err = q.CreateUser(ctx, db.CreateUserParams{
		ID:                    fakeID,
		Email:                 email,
		PasswordHash:          "poc-placeholder-hash",
		Name:                  "PoC Schema",
		Role:                  db.UsersRoleStudent,
		AvatarUrl:             sql.NullString{Valid: false},
		PasswordResetRequired: false,
		Points:                0,
		Level:                 1,
		CreatedAt:             now,
		UpdatedAt:             now,
	})
	if err != nil {
		fmt.Printf("FAIL CreateUser: %v\n", err)
		return 1
	}
	fmt.Println("step 2/4 ok — CreateUser succeeded")

	// Step 3: GetUserByID for the same UUID must return the row.
	got, err := q.GetUserByID(ctx, fakeID)
	if err != nil {
		fmt.Printf("FAIL GetUserByID post-create: %v\n", err)
		return 1
	}
	if got.ID != fakeID {
		fmt.Printf("FAIL GetUserByID post-create: want id=%s, got %s\n", fakeID, got.ID)
		return 1
	}
	if got.Email != email {
		fmt.Printf("FAIL GetUserByID post-create: want email=%s, got %s\n", email, got.Email)
		return 1
	}
	if string(got.Role) != "student" {
		fmt.Printf("FAIL GetUserByID post-create: want role=student, got %s\n", got.Role)
		return 1
	}
	if got.CreatedAt.IsZero() {
		fmt.Printf("FAIL GetUserByID post-create: created_at is zero\n")
		return 1
	}
	fmt.Printf("step 3/4 ok — GetUserByID returned id=%s email=%s role=%s createdAt=%s\n",
		got.ID, got.Email, got.Role, got.CreatedAt.Format(time.RFC3339Nano))

	// Step 4: cleanup so reruns stay idempotent.
	if _, err := conn.ExecContext(ctx, "DELETE FROM users WHERE id = ?", fakeID); err != nil {
		fmt.Printf("FAIL cleanup: %v\n", err)
		return 1
	}
	fmt.Println("step 4/4 ok — cleanup row removed")

	fmt.Println("PASS — Prisma→sqlc schema translation round-trips a real MySQL row")
	return 0
}
